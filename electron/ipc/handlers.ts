import { ipcMain, shell } from 'electron';
import { z } from 'zod';
import { getDb } from '../db';
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';
import { generateInvoicePdf, InvoicePdfData } from '../services/invoicePdf';
import { encryptSecret, decryptSecret } from '../services/safeStore';
import { getSyncStatus, executeDeltaSync } from '../services/syncEngine';
import { listBackups, createDatabaseBackup, restoreDatabase } from '../services/backupManager';

export interface MainSession {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'staff';
  loginTime: number;
}

let activeSession: MainSession | null = null;
const failedAttemptsMap: Record<string, { count: number; lockedUntil: number }> = {};

export function currentSession(): MainSession | null {
  return activeSession;
}

export function requireRole(allowedRoles: ('owner' | 'staff')[]) {
  if (!activeSession) {
    throw new Error('Unauthorized: Authentication required');
  }
  if (!allowedRoles.includes(activeSession.role)) {
    throw new Error(`Forbidden: Insufficient privileges for role ${activeSession.role}`);
  }
}

export function logAudit(action: string, entity: string, entityId?: string, detailJson?: any) {
  try {
    const db = getDb();
    const auditId = uuidv7();
    const userId = activeSession ? activeSession.id : null;
    db.prepare(`
      INSERT INTO audit_log (id, user_id, action, entity, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(auditId, userId, action, entity, entityId || null, detailJson ? JSON.stringify(detailJson) : null, new Date().toISOString());
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

function getDeviceId(db: any): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('device_id') as any;
  return row?.value || 'MAIN';
}

function generateInvoiceNumber(db: any): string {
  const deviceId = getDeviceId(db);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const prefix = `INV-${deviceId}-${dateStr}-`;

  const lastSale = db.prepare(`
    SELECT invoice_no FROM sales 
    WHERE invoice_no LIKE ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(`${prefix}%`) as any;

  let seq = 1;
  if (lastSale?.invoice_no) {
    const parts = lastSale.invoice_no.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${seq.toString().padStart(4, '0')}`;
}

export function registerIpcHandlers() {
  // Demo Ping IPC call
  ipcMain.handle('api:ping', async () => {
    return { status: 'OK', timestamp: new Date().toISOString() };
  });

  // Auth Handlers
  ipcMain.handle('api:auth:login', async (_event, rawArgs) => {
    const schema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    });
    const { username, password } = schema.parse(rawArgs);

    const now = Date.now();
    const attempt = failedAttemptsMap[username] || { count: 0, lockedUntil: 0 };
    if (attempt.lockedUntil > now) {
      const waitSec = Math.ceil((attempt.lockedUntil - now) / 1000);
      throw new Error(`Account locked due to multiple failed attempts. Retry in ${waitSec}s.`);
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1 AND deleted_at IS NULL').get(username) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      attempt.count += 1;
      if (attempt.count >= 5) {
        attempt.lockedUntil = now + 30000; // 30s lockout
      }
      failedAttemptsMap[username] = attempt;
      logAudit('LOGIN_FAILED', 'users', undefined, { username, reason: 'Invalid credentials' });
      return { success: false, error: 'Invalid username or password' };
    }

    delete failedAttemptsMap[username];

    activeSession = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      loginTime: now,
    };

    logAudit('LOGIN_SUCCESS', 'users', user.id, { username });

    return {
      success: true,
      session: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    };
  });

  ipcMain.handle('api:auth:logout', async () => {
    if (activeSession) {
      logAudit('LOGOUT', 'users', activeSession.id);
    }
    activeSession = null;
    return true;
  });

  ipcMain.handle('api:auth:getSession', async () => {
    if (!activeSession) return null;
    return {
      id: activeSession.id,
      username: activeSession.username,
      name: activeSession.name,
      role: activeSession.role,
    };
  });

  // --- SHELL HANDLERS ---
  // The window-open handler denies every new window (see security.ts), so the
  // renderer cannot reach an external link on its own. This opens one in the
  // user's real browser instead.
  ipcMain.handle('api:shell:openExternal', async (_event, rawUrl) => {
    requireRole(['owner', 'staff']);
    const url = z.string().min(1).max(2048).parse(rawUrl);

    // Only ever hand http(s) to the OS. shell.openExternal will happily launch
    // file:, ms-msdt:, and other protocol handlers, which is a well-known
    // remote-code-execution route if a URL ever came from untrusted data.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('That link is not a valid URL.');
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Refusing to open a ${parsed.protocol} link.`);
    }

    await shell.openExternal(parsed.toString());
    return true;
  });

  // --- CATEGORIES HANDLERS ---
  ipcMain.handle('api:categories:list', async () => {
    requireRole(['owner', 'staff']);
    const db = getDb();
    return db.prepare('SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name ASC').all();
  });

  ipcMain.handle('api:categories:create', async (_event, rawName) => {
    requireRole(['owner']);
    const name = z.string().min(1).parse(rawName).trim();
    const db = getDb();
    const id = uuidv7();
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT id FROM categories WHERE name = ? AND deleted_at IS NULL').get(name);
    if (existing) {
      throw new Error(`Category "${name}" already exists.`);
    }

    db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, name, now, now);
    logAudit('CREATE_CATEGORY', 'categories', id, { name });
    return { id, name };
  });

  ipcMain.handle('api:categories:update', async (_event, rawId, rawName) => {
    requireRole(['owner']);
    const id = z.string().min(1).parse(rawId);
    const name = z.string().min(1).parse(rawName).trim();
    const db = getDb();

    const current = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    if (!current) {
      throw new Error('That category no longer exists.');
    }

    const clash = db
      .prepare('SELECT id FROM categories WHERE name = ? AND id != ? AND deleted_at IS NULL')
      .get(name, id);
    if (clash) {
      throw new Error(`Category "${name}" already exists.`);
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE categories SET name = ?, updated_at = ? WHERE id = ?').run(name, now, id);
    logAudit('UPDATE_CATEGORY', 'categories', id, { from: current.name, to: name });
    return { id, name };
  });

  ipcMain.handle('api:categories:delete', async (_event, rawId) => {
    requireRole(['owner']);
    const id = z.string().min(1).parse(rawId);
    const db = getDb();

    const category = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id) as any;
    if (!category) {
      throw new Error('That category no longer exists.');
    }

    // A category holding sellable stock must not disappear: the stock would
    // still exist but would no longer be reachable by browsing.
    const withStock = db
      .prepare('SELECT COUNT(*) c FROM products WHERE category_id = ? AND deleted_at IS NULL AND stock_qty > 0')
      .get(id) as any;
    if (withStock.c > 0) {
      throw new Error(
        `"${category.name}" still has ${withStock.c} product${withStock.c === 1 ? '' : 's'} in stock. Move or sell them first.`
      );
    }

    const now = new Date().toISOString();
    const detach = db.prepare(
      'UPDATE products SET category_id = NULL, updated_at = ? WHERE category_id = ? AND deleted_at IS NULL'
    );
    const remove = db.prepare('UPDATE categories SET deleted_at = ?, updated_at = ? WHERE id = ?');

    // Zero-stock products keep existing; they just lose the category, rather
    // than being left pointing at a row that is gone.
    const tx = db.transaction(() => {
      const res = detach.run(now, id);
      remove.run(now, now, id);
      return res.changes as number;
    });
    const detached = tx();

    logAudit('DELETE_CATEGORY', 'categories', id, { name: category.name, detachedProducts: detached });
    return { id, detachedProducts: detached };
  });

  // --- PRODUCTS HANDLERS ---
  ipcMain.handle('api:products:list', async (_event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      category_id: z.string().optional(),
      search: z.string().optional(),
      low_stock: z.boolean().optional(),
    }).optional();
    const filters = schema.parse(rawArgs) || {};

    const db = getDb();
    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (filters.category_id) {
      sql += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }
    if (filters.search) {
      sql += ' AND (p.name LIKE ? OR p.name_bn LIKE ? OR p.barcode LIKE ? OR p.brand LIKE ?)';
      const term = `%${filters.search.trim()}%`;
      params.push(term, term, term, term);
    }
    if (filters.low_stock) {
      sql += ' AND p.stock_qty <= p.low_stock_threshold';
    }

    sql += ' ORDER BY p.name ASC';
    const products = db.prepare(sql).all(...params) as any[];

    if (activeSession?.role === 'staff') {
      return products.map(p => {
        const { cost_price_paisa, ...rest } = p;
        return rest;
      });
    }

    return products;
  });

  ipcMain.handle('api:products:getByBarcode', async (_event, rawBarcode) => {
    requireRole(['owner', 'staff']);
    const barcode = z.string().parse(rawBarcode).trim();
    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.barcode = ? AND p.deleted_at IS NULL
    `).get(barcode) as any;

    if (!product) return null;

    if (activeSession?.role === 'staff') {
      const { cost_price_paisa, ...rest } = product;
      return rest;
    }
    return product;
  });

  ipcMain.handle('api:products:getById', async (_event, rawId) => {
    requireRole(['owner', 'staff']);
    const id = z.string().parse(rawId);
    const db = getDb();
    const product = db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.id = ? AND p.deleted_at IS NULL
    `).get(id) as any;

    if (!product) return null;

    if (activeSession?.role === 'staff') {
      const { cost_price_paisa, ...rest } = product;
      return rest;
    }
    return product;
  });

  ipcMain.handle('api:products:create', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({
      barcode: z.string().optional().nullable(),
      name: z.string().min(1),
      name_bn: z.string().optional().nullable(),
      category_id: z.string().optional().nullable(),
      brand: z.string().optional().nullable(),
      unit: z.string().default('pcs'),
      cost_price_paisa: z.number().int().min(0),
      sell_price_paisa: z.number().int().min(0),
      stock_qty: z.number().int().min(0).default(0),
      low_stock_threshold: z.number().int().min(0).default(5),
      is_serial_tracked: z.boolean().default(false),
    });

    const data = schema.parse(rawData);
    const db = getDb();

    let barcode = data.barcode?.trim() || '';
    if (!barcode) {
      barcode = `INT-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    } else {
      const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND deleted_at IS NULL').get(barcode);
      if (existing) {
        throw new Error(`Barcode "${barcode}" is already assigned to another product.`);
      }
    }

    const id = uuidv7();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`
        INSERT INTO products (
          id, barcode, name, name_bn, category_id, brand, unit,
          cost_price_paisa, sell_price_paisa, stock_qty, low_stock_threshold,
          is_serial_tracked, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, barcode, data.name.trim(), data.name_bn?.trim() || null, data.category_id || null, data.brand?.trim() || null, data.unit,
        data.cost_price_paisa, data.sell_price_paisa, data.stock_qty, data.low_stock_threshold,
        data.is_serial_tracked ? 1 : 0, now, now
      );

      if (data.stock_qty > 0) {
        db.prepare(`
          INSERT INTO stock_transactions (
            id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at
          ) VALUES (?, ?, 'initial', ?, 'products', ?, 'Initial stock setup', ?, ?, ?)
        `).run(uuidv7(), id, data.stock_qty, id, activeSession?.id || 'system', now, now);
      }
    })();

    logAudit('CREATE_PRODUCT', 'products', id, { name: data.name, barcode });
    return { id, barcode, ...data };
  });

  ipcMain.handle('api:products:update', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({
      id: z.string().min(1),
      barcode: z.string().optional().nullable(),
      name: z.string().min(1),
      name_bn: z.string().optional().nullable(),
      category_id: z.string().optional().nullable(),
      brand: z.string().optional().nullable(),
      unit: z.string().default('pcs'),
      cost_price_paisa: z.number().int().min(0),
      sell_price_paisa: z.number().int().min(0),
      low_stock_threshold: z.number().int().min(0).default(5),
      is_serial_tracked: z.boolean().default(false),
    });

    const data = schema.parse(rawData);
    const db = getDb();

    const existingProduct = db.prepare('SELECT * FROM products WHERE id = ? AND deleted_at IS NULL').get(data.id) as any;
    if (!existingProduct) {
      throw new Error('Product not found or deleted.');
    }

    if (data.barcode && data.barcode !== existingProduct.barcode) {
      const duplicate = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ? AND deleted_at IS NULL').get(data.barcode, data.id);
      if (duplicate) {
        throw new Error(`Barcode "${data.barcode}" is already assigned to another product.`);
      }
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE products SET
        barcode = ?, name = ?, name_bn = ?, category_id = ?, brand = ?, unit = ?,
        cost_price_paisa = ?, sell_price_paisa = ?, low_stock_threshold = ?,
        is_serial_tracked = ?, updated_at = ?
      WHERE id = ?
    `).run(
      data.barcode || existingProduct.barcode, data.name.trim(), data.name_bn?.trim() || null,
      data.category_id || null, data.brand?.trim() || null, data.unit,
      data.cost_price_paisa, data.sell_price_paisa, data.low_stock_threshold,
      data.is_serial_tracked ? 1 : 0, now, data.id
    );

    logAudit('UPDATE_PRODUCT', 'products', data.id, { name: data.name });
    return { success: true };
  });

  ipcMain.handle('api:products:delete', async (_event, rawId) => {
    requireRole(['owner']);
    const id = z.string().min(1).parse(rawId);
    const db = getDb();
    const now = new Date().toISOString();

    const result = db.prepare('UPDATE products SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
    if (result.changes === 0) {
      throw new Error('Product not found or already deleted');
    }

    logAudit('DELETE_PRODUCT', 'products', id);
    return { success: true };
  });

  ipcMain.handle('api:products:stockIn', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({

      product_id: z.string().min(1),
      qty: z.number().int().positive(),
      reason: z.string().optional(),
    });

    const data = schema.parse(rawData);
    const db = getDb();
    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';

    let newStock = 0;
    db.transaction(() => {
      const product = db.prepare('SELECT stock_qty, name FROM products WHERE id = ? AND deleted_at IS NULL').get(data.product_id) as any;
      if (!product) throw new Error('Product not found');

      newStock = product.stock_qty + data.qty;
      db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?').run(data.qty, now, data.product_id);

      db.prepare(`
        INSERT INTO stock_transactions (
          id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at
        ) VALUES (?, ?, 'purchase', ?, 'products', ?, ?, ?, ?, ?)
      `).run(uuidv7(), data.product_id, data.qty, data.product_id, data.reason || 'Quick stock-in', userId, now, now);
    })();

    logAudit('STOCK_IN', 'products', data.product_id, { addedQty: data.qty, newStock });
    return { success: true, newStock };
  });

  ipcMain.handle('api:products:stockAdjustment', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({
      product_id: z.string().min(1),
      qty_delta: z.number().int(),
      reason: z.string().min(1),
    });

    const data = schema.parse(rawData);
    const db = getDb();
    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';

    let newStock = 0;
    db.transaction(() => {
      const product = db.prepare('SELECT stock_qty FROM products WHERE id = ? AND deleted_at IS NULL').get(data.product_id) as any;
      if (!product) throw new Error('Product not found');

      if (product.stock_qty + data.qty_delta < 0) {
        throw new Error('Stock adjustment would result in negative stock quantity.');
      }

      newStock = product.stock_qty + data.qty_delta;
      db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?').run(data.qty_delta, now, data.product_id);

      db.prepare(`
        INSERT INTO stock_transactions (
          id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at
        ) VALUES (?, ?, 'adjustment', ?, 'products', ?, ?, ?, ?, ?)
      `).run(uuidv7(), data.product_id, data.qty_delta, data.product_id, data.reason, userId, now, now);
    })();

    logAudit('STOCK_ADJUSTMENT', 'products', data.product_id, { qtyDelta: data.qty_delta, reason: data.reason, newStock });
    return { success: true, newStock };
  });

  ipcMain.handle('api:products:bulkImport', async (_event, rawPayload) => {
    requireRole(['owner']);
    const schema = z.object({
      mode: z.enum(['dry_run', 'commit']),
      rows: z.array(z.object({
        barcode: z.string().optional().nullable(),
        name: z.string(),
        name_bn: z.string().optional().nullable(),
        category_name: z.string().optional().nullable(),
        brand: z.string().optional().nullable(),
        unit: z.string().optional().default('pcs'),
        cost_price_taka: z.number().min(0),
        sell_price_taka: z.number().min(0),
        stock_qty: z.number().int().min(0).optional().default(0),
        low_stock_threshold: z.number().int().min(0).optional().default(5),
      })),
    });

    const payload = schema.parse(rawPayload);
    const db = getDb();

    const errors: string[] = [];
    const validRows: any[] = [];
    const barcodeSeenInFile = new Set<string>();

    const existingBarcodesRows = db.prepare('SELECT barcode FROM products WHERE barcode IS NOT NULL AND deleted_at IS NULL').all() as { barcode: string }[];
    const dbBarcodes = new Set(existingBarcodesRows.map(r => r.barcode));

    payload.rows.forEach((row, idx) => {
      const lineNo = idx + 1;
      const name = row.name?.trim();
      if (!name) {
        errors.push(`Row ${lineNo}: Product name is required.`);
      }

      let bc = row.barcode?.trim();
      if (bc) {
        if (barcodeSeenInFile.has(bc)) {
          errors.push(`Row ${lineNo}: Duplicate barcode "${bc}" in import file.`);
        } else if (dbBarcodes.has(bc)) {
          errors.push(`Row ${lineNo}: Barcode "${bc}" already exists in database.`);
        } else {
          barcodeSeenInFile.add(bc);
        }
      }

      if (row.cost_price_taka < 0 || isNaN(row.cost_price_taka)) {
        errors.push(`Row ${lineNo}: Invalid cost price.`);
      }
      if (row.sell_price_taka < 0 || isNaN(row.sell_price_taka)) {
        errors.push(`Row ${lineNo}: Invalid sell price.`);
      }

      if (errors.length === 0 || payload.mode === 'commit') {
        validRows.push({
          ...row,
          name,
          barcode: bc || null,
          cost_price_paisa: Math.round(row.cost_price_taka * 100),
          sell_price_paisa: Math.round(row.sell_price_taka * 100),
        });
      }
    });

    if (payload.mode === 'dry_run' || errors.length > 0) {
      return {
        success: errors.length === 0,
        totalRows: payload.rows.length,
        validRowsCount: validRows.length,
        errors,
      };
    }

    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';

    const categoryCache = new Map<string, string>();
    const existingCats = db.prepare('SELECT id, name FROM categories WHERE deleted_at IS NULL').all() as { id: string; name: string }[];
    existingCats.forEach(c => categoryCache.set(c.name.toLowerCase(), c.id));

    let importedCount = 0;

    db.transaction(() => {
      for (const row of validRows) {
        let categoryId: string | null = null;
        if (row.category_name) {
          const catNameLower = row.category_name.trim().toLowerCase();
          if (categoryCache.has(catNameLower)) {
            categoryId = categoryCache.get(catNameLower)!;
          } else {
            categoryId = uuidv7();
            db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(categoryId, row.category_name.trim(), now, now);
            categoryCache.set(catNameLower, categoryId);
          }
        }

        const barcode = row.barcode || `INT-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
        const productId = uuidv7();

        db.prepare(`
          INSERT INTO products (
            id, barcode, name, name_bn, category_id, brand, unit,
            cost_price_paisa, sell_price_paisa, stock_qty, low_stock_threshold,
            is_serial_tracked, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
        `).run(
          productId, barcode, row.name, row.name_bn || null, categoryId, row.brand || null, row.unit || 'pcs',
          row.cost_price_paisa, row.sell_price_paisa, row.stock_qty || 0, row.low_stock_threshold || 5,
          now, now
        );

        if ((row.stock_qty || 0) > 0) {
          db.prepare(`
            INSERT INTO stock_transactions (
              id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at
            ) VALUES (?, ?, 'initial', ?, 'products', ?, 'CSV Bulk Import', ?, ?, ?)
          `).run(uuidv7(), productId, row.stock_qty, productId, userId, now, now);
        }

        importedCount++;
      }
    })();

    logAudit('BULK_IMPORT', 'products', undefined, { count: importedCount });
    return {
      success: true,
      imported: importedCount,
      errors: [],
    };
  });

  // --- SALES & INVOICING HANDLERS ---
  ipcMain.handle('api:sales:create', async (_event, rawPayload) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      customer_id: z.string().optional().nullable(),
      subtotal_paisa: z.number().int().min(0),
      discount_paisa: z.number().int().min(0).default(0),
      total_paisa: z.number().int().min(0),
      items: z.array(z.object({
        product_id: z.string().min(1),
        qty: z.number().int().positive(),
        unit_price_paisa: z.number().int().min(0),
        discount_paisa: z.number().int().min(0).default(0),
        serial_number_id: z.string().optional().nullable(),
      })).min(1),
      payments: z.array(z.object({
        method: z.enum(['cash', 'bkash', 'nagad', 'card']),
        amount_paisa: z.number().int().min(0),
      })).min(1),
      total_paid_paisa: z.number().int().min(0),
      change_paisa: z.number().int().min(0).default(0),
      layout: z.enum(['80mm', 'a5']).default('80mm'),
    });

    const payload = schema.parse(rawPayload);
    const db = getDb();
    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';
    const deviceId = getDeviceId(db);

    if (activeSession?.role === 'staff') {
      const maxAllowedDiscount = Math.round(payload.subtotal_paisa * 0.10);
      if (payload.discount_paisa > maxAllowedDiscount) {
        throw new Error(`Discount of ৳${(payload.discount_paisa / 100).toFixed(2)} exceeds staff authorization limit (max 10%). Owner approval required.`);
      }
    }

    const saleId = uuidv7();
    const invoiceNo = generateInvoiceNumber(db);

    let customerInfo: any = null;
    if (payload.customer_id) {
      customerInfo = db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(payload.customer_id);
    }

    const invoiceItems: any[] = [];

    db.transaction(() => {
      // 1. Insert Sales Record
      db.prepare(`
        INSERT INTO sales (
          id, invoice_no, status, customer_id, subtotal_paisa, discount_paisa, total_paisa,
          user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleId, invoiceNo, payload.customer_id || null, payload.subtotal_paisa,
        payload.discount_paisa, payload.total_paisa, userId, deviceId, now, now
      );

      // 2. Decrement Stock with Race-Safe Condition & Insert Sale Items
      const updateStockStmt = db.prepare(`
        UPDATE products 
        SET stock_qty = stock_qty - ?, updated_at = ? 
        WHERE id = ? AND stock_qty >= ?
      `);
      const insertItemStmt = db.prepare(`
        INSERT INTO sale_items (
          id, sale_id, product_id, qty, unit_price_paisa, discount_paisa, serial_number_id,
          unit_cost_paisa, device_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertStockTxStmt = db.prepare(`
        INSERT INTO stock_transactions (
          id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, 'sale', ?, 'sales', ?, ?, ?, ?, ?, ?)
      `);

      for (const item of payload.items) {
        const product = db.prepare('SELECT name, name_bn, stock_qty, cost_price_paisa FROM products WHERE id = ? AND deleted_at IS NULL').get(item.product_id) as any;
        if (!product) {
          throw new Error(`Product ${item.product_id} not found.`);
        }

        const res = updateStockStmt.run(item.qty, now, item.product_id, item.qty);
        if (res.changes === 0) {
          throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock_qty}, Requested: ${item.qty}`);
        }

        const saleItemId = uuidv7();
        // Cost is frozen onto the line here. Reporting used to read the
        // product's current cost, so a later purchase at a higher price
        // rewrote the profit on sales that had already been completed.
        insertItemStmt.run(
          saleItemId, saleId, item.product_id, item.qty, item.unit_price_paisa,
          item.discount_paisa, item.serial_number_id || null,
          product.cost_price_paisa ?? 0, deviceId, now, now
        );

        insertStockTxStmt.run(
          uuidv7(), item.product_id, -item.qty, saleId, `Sale ${invoiceNo}`, userId, deviceId, now, now
        );

        invoiceItems.push({
          name: product.name,
          nameBn: product.name_bn,
          qty: item.qty,
          unitPricePaisa: item.unit_price_paisa,
          discountPaisa: item.discount_paisa,
          totalPaisa: (item.unit_price_paisa * item.qty) - item.discount_paisa,
        });
      }

      // 3. Insert Split Payments Rows
      const insertPaymentStmt = db.prepare(`
        INSERT INTO payments (
          id, sale_id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, ?, 'in', ?, ?, 'sale_payment', ?, ?, ?, ?)
      `);

      for (const payment of payload.payments) {
        if (payment.amount_paisa > 0) {
          let netAmount = payment.amount_paisa;
          // If cash was tendered with excess change returned, record net cash retained in drawer
          if (payment.method === 'cash' && payload.change_paisa > 0) {
            netAmount = Math.max(0, payment.amount_paisa - payload.change_paisa);
          }
          if (netAmount > 0) {
            insertPaymentStmt.run(
              uuidv7(), saleId, payload.customer_id || null, payment.method, netAmount,
              userId, deviceId, now, now
            );
          }
        }
      }
    })();

    logAudit('CREATE_SALE', 'sales', saleId, { invoiceNo, totalPaisa: payload.total_paisa });

    const shopName = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_name') as any)?.value || 'Mechanical Parts Shop';
    const shopAddress = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_address') as any)?.value || 'Dhaka, Bangladesh';
    const invoiceFooter = (db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_footer') as any)?.value || 'Thank you for your business!';

    const duePaisa = Math.max(0, payload.total_paisa - payload.total_paid_paisa);

    const pdfData: InvoicePdfData = {
      shopName,
      shopAddress,
      invoiceFooter,
      invoiceNo,
      date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString(),
      cashierName: activeSession?.name || 'Staff',
      customerName: customerInfo?.name,
      customerPhone: customerInfo?.phone,
      items: invoiceItems,
      subtotalPaisa: payload.subtotal_paisa,
      discountPaisa: payload.discount_paisa,
      totalPaisa: payload.total_paisa,
      payments: payload.payments.map(p => ({ method: p.method, amountPaisa: p.amount_paisa })),
      totalPaidPaisa: payload.total_paid_paisa,
      changePaisa: payload.change_paisa,
      duePaisa,
    };

    let pdfBase64 = '';
    try {
      pdfBase64 = await generateInvoicePdf(pdfData, payload.layout);
    } catch (pdfErr) {
      console.error('Invoice PDF generation warning:', pdfErr);
    }

    return {
      success: true,
      sale_id: saleId,
      invoice_no: invoiceNo,
      pdfBase64,
    };
  });

  ipcMain.handle('api:sales:getByInvoice', async (_event, rawInvoiceNo) => {
    requireRole(['owner', 'staff']);
    const invoiceNo = z.string().min(1).parse(rawInvoiceNo).trim();
    const db = getDb();

    const sale = db.prepare(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.invoice_no = ? OR s.id = ?
    `).get(invoiceNo, invoiceNo) as any;

    if (!sale) return null;

    const items = db.prepare(`
      SELECT si.*, p.name as product_name, p.name_bn as product_name_bn, p.barcode, p.unit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(sale.id) as any[];

    const payments = db.prepare(`
      SELECT * FROM payments WHERE sale_id = ?
    `).all(sale.id) as any[];

    const returns = db.prepare(`
      SELECT r.*, ri.sale_item_id, ri.qty as returned_qty, ri.amount_paisa
      FROM returns r
      LEFT JOIN return_items ri ON r.id = ri.return_id
      WHERE r.sale_id = ?
    `).all(sale.id) as any[];

    return {
      ...sale,
      items,
      payments,
      returns,
    };
  });

  ipcMain.handle('api:sales:list', async (_event, limitRaw) => {
    requireRole(['owner', 'staff']);
    const limit = typeof limitRaw === 'number' ? limitRaw : 50;
    const db = getDb();

    return db.prepare(`
      SELECT s.*, c.name as customer_name, u.name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.deleted_at IS NULL AND s.status != 'held'
      ORDER BY s.created_at DESC
      LIMIT ?
    `).all(limit);
  });

  ipcMain.handle('api:sales:holdSale', async (_event, rawData) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      cartData: z.any(),
      customerName: z.string().optional(),
      note: z.string().optional(),
    });
    const { cartData, customerName, note } = schema.parse(rawData);
    const db = getDb();
    const id = uuidv7();
    const now = new Date().toISOString();
    const invoiceNo = `HOLD-${Date.now().toString().slice(-6)}`;

    db.prepare(`
      INSERT INTO sales (
        id, invoice_no, status, subtotal_paisa, discount_paisa, total_paisa,
        user_id, device_id, created_at, updated_at
      ) VALUES (?, ?, 'held', 0, 0, 0, ?, ?, ?, ?)
    `).run(id, invoiceNo, activeSession?.id || 'system', getDeviceId(db), now, now);

    logAudit('HOLD_SALE', 'held_sales', id, { cartData, customerName, note });
    return { id, invoiceNo };
  });

  ipcMain.handle('api:sales:getHeldSales', async () => {
    requireRole(['owner', 'staff']);
    const db = getDb();
    const rows = db.prepare(`
      SELECT s.*, a.detail_json
      FROM sales s
      LEFT JOIN audit_log a ON a.entity = 'held_sales' AND a.entity_id = s.id
      WHERE s.status = 'held' AND s.deleted_at IS NULL
      ORDER BY s.created_at DESC
    `).all() as any[];

    return rows.map(r => ({
      ...r,
      detail: r.detail_json ? JSON.parse(r.detail_json) : null,
    }));
  });

  ipcMain.handle('api:sales:deleteHeldSale', async (_event, rawId) => {
    requireRole(['owner', 'staff']);
    const id = z.string().min(1).parse(rawId);
    const db = getDb();
    db.prepare("DELETE FROM sales WHERE id = ? AND status = 'held'").run(id);
    return true;
  });

  ipcMain.handle('api:sales:processReturn', async (_event, rawPayload) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      sale_id: z.string().min(1),
      reason: z.string().min(1),
      refund_method: z.enum(['cash', 'bkash', 'nagad', 'card']).default('cash'),
      items: z.array(z.object({
        sale_item_id: z.string().min(1),
        product_id: z.string().min(1),
        qty: z.number().int().positive(),
        amount_paisa: z.number().int().min(0),
      })).min(1),
    });

    const payload = schema.parse(rawPayload);
    const db = getDb();
    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';
    const deviceId = getDeviceId(db);
    const returnId = uuidv7();

    let totalRefundPaisa = 0;
    payload.items.forEach(it => { totalRefundPaisa += it.amount_paisa; });

    db.transaction(() => {
      db.prepare(`
        INSERT INTO returns (id, sale_id, user_id, reason, device_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(returnId, payload.sale_id, userId, payload.reason, deviceId, now, now);

      const insertReturnItem = db.prepare(`
        INSERT INTO return_items (id, return_id, sale_item_id, qty, amount_paisa, device_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const restoreStockStmt = db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?');
      const insertStockTxStmt = db.prepare(`
        INSERT INTO stock_transactions (
          id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, 'return_in', ?, 'returns', ?, ?, ?, ?, ?, ?)
      `);

      for (const item of payload.items) {
        insertReturnItem.run(uuidv7(), returnId, item.sale_item_id, item.qty, item.amount_paisa, deviceId, now, now);
        restoreStockStmt.run(item.qty, now, item.product_id);
        insertStockTxStmt.run(uuidv7(), item.product_id, item.qty, returnId, `Customer Return: ${payload.reason}`, userId, deviceId, now, now);
      }

      db.prepare(`
        INSERT INTO payments (
          id, sale_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, 'out', ?, ?, 'refund', ?, ?, ?, ?)
      `).run(uuidv7(), payload.sale_id, payload.refund_method, totalRefundPaisa, userId, deviceId, now, now);

      db.prepare("UPDATE sales SET status = 'refunded', updated_at = ? WHERE id = ?").run(now, payload.sale_id);
    })();

    logAudit('PROCESS_RETURN', 'returns', returnId, { saleId: payload.sale_id, totalRefundPaisa });
    return { success: true, returnId };
  });

  ipcMain.handle('api:sales:generatePdf', async (_event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      invoice_no: z.string().min(1),
      layout: z.enum(['80mm', 'a5']).default('80mm'),
    });
    const { invoice_no, layout } = schema.parse(rawArgs);
    const db = getDb();

    const sale = db.prepare(`
      SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.invoice_no = ? OR s.id = ?
    `).get(invoice_no, invoice_no) as any;

    if (!sale) throw new Error('Invoice not found.');

    const items = db.prepare(`
      SELECT si.*, p.name as product_name, p.name_bn as product_name_bn
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(sale.id) as any[];

    const payments = db.prepare(`SELECT * FROM payments WHERE sale_id = ? AND direction = 'in'`).all(sale.id) as any[];

    const shopName = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_name') as any)?.value || 'Mechanical Parts Shop';
    const shopAddress = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_address') as any)?.value || 'Dhaka, Bangladesh';
    const invoiceFooter = (db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_footer') as any)?.value || 'Thank you for your business!';

    const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount_paisa, 0);

    const pdfData: InvoicePdfData = {
      shopName,
      shopAddress,
      invoiceFooter,
      invoiceNo: sale.invoice_no,
      date: new Date(sale.created_at).toLocaleDateString('en-GB') + ' ' + new Date(sale.created_at).toLocaleTimeString(),
      cashierName: sale.cashier_name || 'Staff',
      customerName: sale.customer_name,
      customerPhone: sale.customer_phone,
      items: items.map(it => ({
        name: it.product_name,
        nameBn: it.product_name_bn,
        qty: it.qty,
        unitPricePaisa: it.unit_price_paisa,
        discountPaisa: it.discount_paisa,
        totalPaisa: (it.unit_price_paisa * it.qty) - it.discount_paisa,
      })),
      subtotalPaisa: sale.subtotal_paisa,
      discountPaisa: sale.discount_paisa,
      totalPaisa: sale.total_paisa,
      payments: payments.map((p: any) => ({ method: p.method, amountPaisa: p.amount_paisa })),
      totalPaidPaisa: totalPaid,
      duePaisa: Math.max(0, sale.total_paisa - totalPaid),
    };

    const pdfBase64 = await generateInvoicePdf(pdfData, layout);
    return { success: true, pdfBase64 };
  });

  // --- CUSTOMERS & DUE HANDLERS ---
  ipcMain.handle('api:customers:list', async (_event, rawSearch) => {
    requireRole(['owner', 'staff']);
    const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
    const db = getDb();

    let sql = `
      SELECT 
        c.id, c.name, c.phone, c.address, c.note, c.created_at, c.updated_at,
        COALESCE(vd.total_sales_paisa, 0) AS total_sales_paisa,
        COALESCE(vd.total_paid_paisa, 0) AS total_paid_paisa,
        COALESCE(vd.due_paisa, 0) AS due_paisa
      FROM customers c
      LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
      WHERE c.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (search) {
      sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ' ORDER BY vd.due_paisa DESC, c.name ASC';
    return db.prepare(sql).all(...params);
  });

  ipcMain.handle('api:customers:getById', async (_event, rawId) => {
    requireRole(['owner', 'staff']);
    const id = z.string().min(1).parse(rawId);
    const db = getDb();

    return db.prepare(`
      SELECT 
        c.id, c.name, c.phone, c.address, c.note, c.created_at, c.updated_at,
        COALESCE(vd.total_sales_paisa, 0) AS total_sales_paisa,
        COALESCE(vd.total_paid_paisa, 0) AS total_paid_paisa,
        COALESCE(vd.due_paisa, 0) AS due_paisa
      FROM customers c
      LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
      WHERE c.id = ? AND c.deleted_at IS NULL
    `).get(id);
  });

  ipcMain.handle('api:customers:create', async (_event, rawData) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      name: z.string().min(1),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    });
    const data = schema.parse(rawData);
    const db = getDb();
    const id = uuidv7();
    const now = new Date().toISOString();
    const deviceId = getDeviceId(db);

    db.prepare(`
      INSERT INTO customers (id, name, phone, address, note, device_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name.trim(), data.phone?.trim() || null,
      data.address?.trim() || null, data.note?.trim() || null,
      deviceId, now, now
    );

    logAudit('CREATE_CUSTOMER', 'customers', id, { name: data.name, phone: data.phone });
    return {
      id,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      note: data.note?.trim() || null,
      total_sales_paisa: 0,
      total_paid_paisa: 0,
      due_paisa: 0,
      created_at: now,
      updated_at: now,
    };
  });

  ipcMain.handle('api:customers:update', async (_event, rawData) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    });
    const data = schema.parse(rawData);
    const db = getDb();
    const now = new Date().toISOString();

    const res = db.prepare(`
      UPDATE customers SET
        name = ?, phone = ?, address = ?, note = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(
      data.name.trim(), data.phone?.trim() || null,
      data.address?.trim() || null, data.note?.trim() || null,
      now, data.id
    );

    if (res.changes === 0) {
      throw new Error('Customer not found or already deleted.');
    }

    logAudit('UPDATE_CUSTOMER', 'customers', data.id, { name: data.name });
    return { success: true };
  });

  ipcMain.handle('api:customers:delete', async (_event, rawId) => {
    requireRole(['owner']);
    const id = z.string().min(1).parse(rawId);
    const db = getDb();

    const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(id) as any;
    if (dueRow && dueRow.due_paisa > 0) {
      throw new Error(`Cannot delete customer. Account has an outstanding due balance of ৳ ${(dueRow.due_paisa / 100).toFixed(2)}. Settle due before deleting.`);
    }

    const now = new Date().toISOString();
    const res = db.prepare('UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
    if (res.changes === 0) {
      throw new Error('Customer not found or already deleted.');
    }

    logAudit('DELETE_CUSTOMER', 'customers', id);
    return { success: true };
  });

  ipcMain.handle('api:customers:collectDue', async (_event, rawPayload) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      customer_id: z.string().min(1),
      amount_taka: z.number().positive(),
      method: z.enum(['cash', 'bkash', 'nagad', 'card']).default('cash'),
      trx_id: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    });

    const payload = schema.parse(rawPayload);
    const db = getDb();
    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';
    const deviceId = getDeviceId(db);
    const paymentId = uuidv7();
    const amountPaisa = Math.round(payload.amount_taka * 100);

    const customer = db.prepare(`
      SELECT c.*, COALESCE(vd.due_paisa, 0) as due_paisa
      FROM customers c
      LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
      WHERE c.id = ? AND c.deleted_at IS NULL
    `).get(payload.customer_id) as any;

    if (!customer) throw new Error('Customer not found.');

    const previousDuePaisa = customer.due_paisa || 0;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (
          id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, 'in', ?, ?, 'due_collection', ?, ?, ?, ?)
      `).run(paymentId, payload.customer_id, payload.method, amountPaisa, userId, deviceId, now, now);
    })();

    const remainingDuePaisa = Math.max(0, previousDuePaisa - amountPaisa);

    logAudit('COLLECT_DUE', 'payments', paymentId, {
      customerId: payload.customer_id,
      amountPaisa,
      previousDuePaisa,
      remainingDuePaisa,
      method: payload.method,
      trxId: payload.trx_id,
    });

    return {
      success: true,
      payment_id: paymentId,
      customer_name: customer.name,
      amount_paisa: amountPaisa,
      previous_due_paisa: previousDuePaisa,
      remaining_due_paisa: remainingDuePaisa,
      date: now,
    };
  });

  ipcMain.handle('api:customers:getHistory', async (_event, rawCustomerId) => {
    requireRole(['owner', 'staff']);
    const customerId = z.string().min(1).parse(rawCustomerId);
    const db = getDb();

    const sales = db.prepare(`
      SELECT id, invoice_no as ref_no, total_paisa, created_at
      FROM sales
      WHERE customer_id = ? AND deleted_at IS NULL AND status != 'held'
    `).all(customerId) as any[];

    const payments = db.prepare(`
      SELECT id, type, method, amount_paisa, created_at, sale_id
      FROM payments
      WHERE customer_id = ? AND deleted_at IS NULL AND direction = 'in'
    `).all(customerId) as any[];

    const history: Array<{
      id: string;
      type: 'sale' | 'payment';
      date: string;
      ref_no: string;
      description: string;
      method?: string | null;
      debit_paisa: number;
      credit_paisa: number;
      running_balance_paisa?: number;
    }> = [];

    sales.forEach(s => {
      history.push({
        id: s.id,
        type: 'sale',
        date: s.created_at,
        ref_no: s.ref_no,
        description: `Invoice ${s.ref_no}`,
        debit_paisa: s.total_paisa,
        credit_paisa: 0,
      });
    });

    payments.forEach(p => {
      const desc = p.type === 'due_collection' ? 'Due / Baki Collection Payment' : 'Sale Payment at POS';
      history.push({
        id: p.id,
        type: 'payment',
        date: p.created_at,
        ref_no: p.id.slice(0, 8).toUpperCase(),
        description: `${desc} (${p.method.toUpperCase()})`,
        method: p.method,
        debit_paisa: 0,
        credit_paisa: p.amount_paisa,
      });
    });

    history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    history.forEach(item => {
      runningBalance += (item.debit_paisa - item.credit_paisa);
      item.running_balance_paisa = runningBalance;
    });

    return history.reverse();
  });

  ipcMain.handle('api:customers:getDueSummary', async () => {
    requireRole(['owner', 'staff']);
    const db = getDb();

    const rows = db.prepare(`
      SELECT 
        c.id, c.name, c.phone, c.address,
        COALESCE(vd.total_sales_paisa, 0) as total_sales_paisa,
        COALESCE(vd.total_paid_paisa, 0) as total_paid_paisa,
        COALESCE(vd.due_paisa, 0) as due_paisa
      FROM customers c
      LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
      WHERE c.deleted_at IS NULL
    `).all() as any[];

    let totalDuePaisa = 0;
    let customersWithDueCount = 0;
    const dueCustomers: any[] = [];

    rows.forEach(r => {
      if (r.due_paisa > 0) {
        totalDuePaisa += r.due_paisa;
        customersWithDueCount++;
        dueCustomers.push(r);
      }
    });

    dueCustomers.sort((a, b) => b.due_paisa - a.due_paisa);

    return {
      total_due_paisa: totalDuePaisa,
      total_customers_count: rows.length,
      customers_with_due_count: customersWithDueCount,
      top_due_customers: dueCustomers.slice(0, 5),
    };
  });

  // --- PHASE 4: REPORTS, USERS, SETTINGS & AUDIT LOG HANDLERS ---

  // Sales Report (Date Range Filtered)
  ipcMain.handle('api:reports:getSalesReport', async (_event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      startDate: z.string().min(1),
      endDate: z.string().min(1),
    });
    const { startDate, endDate } = schema.parse(rawArgs);
    const db = getDb();

    const startISO = `${startDate}T00:00:00.000Z`;
    const endISO = `${endDate}T23:59:59.999Z`;

    const sales = db.prepare(`
      SELECT * FROM sales
      WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL AND status != 'held'
    `).all(startISO, endISO) as any[];

    let totalOrders = sales.length;
    let subtotalPaisa = 0;
    let discountPaisa = 0;
    let grossSalesPaisa = 0;
    let refundsCount = 0;
    let totalRefundedPaisa = 0;

    sales.forEach(s => {
      subtotalPaisa += s.subtotal_paisa;
      discountPaisa += s.discount_paisa;
      grossSalesPaisa += s.total_paisa;
      if (s.status === 'refunded') {
        refundsCount++;
      }
    });

    // Payments in date range
    const payments = db.prepare(`
      SELECT method, direction, amount_paisa, type FROM payments
      WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL
    `).all(startISO, endISO) as any[];

    let cashPaisa = 0;
    let bkashPaisa = 0;
    let nagadPaisa = 0;
    let cardPaisa = 0;

    payments.forEach(p => {
      if (p.direction === 'in') {
        if (p.method === 'cash') cashPaisa += p.amount_paisa;
        else if (p.method === 'bkash') bkashPaisa += p.amount_paisa;
        else if (p.method === 'nagad') nagadPaisa += p.amount_paisa;
        else if (p.method === 'card') cardPaisa += p.amount_paisa;
      } else if (p.direction === 'out' && p.type === 'refund') {
        totalRefundedPaisa += p.amount_paisa;
      }
    });

    const netSalesPaisa = Math.max(0, grossSalesPaisa - totalRefundedPaisa);

    // Daily trends
    const dailyTrends = db.prepare(`
      SELECT 
        substr(created_at, 1, 10) as date,
        COUNT(id) as orders_count,
        SUM(total_paisa) as sales_paisa
      FROM sales
      WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL AND status != 'held'
      GROUP BY substr(created_at, 1, 10)
      ORDER BY date ASC
    `).all(startISO, endISO) as any[];

    return {
      start_date: startDate,
      end_date: endDate,
      total_orders: totalOrders,
      subtotal_paisa: subtotalPaisa,
      discount_paisa: discountPaisa,
      gross_sales_paisa: grossSalesPaisa,
      refunds_count: refundsCount,
      total_refunded_paisa: totalRefundedPaisa,
      net_sales_paisa: netSalesPaisa,
      payments_breakdown: {
        cash_paisa: cashPaisa,
        bkash_paisa: bkashPaisa,
        nagad_paisa: nagadPaisa,
        card_paisa: cardPaisa,
      },
      daily_trends: dailyTrends.map(t => ({
        date: t.date,
        orders_count: t.orders_count,
        sales_paisa: t.sales_paisa || 0,
      })),
    };
  });

  // Profit Report (OWNER ONLY)
  ipcMain.handle('api:reports:getProfitReport', async (_event, rawArgs) => {
    requireRole(['owner']);
    const schema = z.object({
      startDate: z.string().min(1),
      endDate: z.string().min(1),
    });
    const { startDate, endDate } = schema.parse(rawArgs);
    const db = getDb();

    const startISO = `${startDate}T00:00:00.000Z`;
    const endISO = `${endDate}T23:59:59.999Z`;

    const productProfits = db.prepare(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.barcode,
        p.cost_price_paisa,
        SUM(si.qty) as qty_sold,
        SUM(si.unit_price_paisa * si.qty - si.discount_paisa) as revenue_paisa,
        -- Use the cost captured on the line. Rows written before the cost
        -- snapshot existed have NULL, and fall back to the product's current
        -- cost so old reports read exactly as they did before.
        SUM(COALESCE(si.unit_cost_paisa, p.cost_price_paisa) * si.qty) as cost_paisa
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      WHERE s.created_at >= ? AND s.created_at <= ? AND s.deleted_at IS NULL AND s.status = 'completed'
      GROUP BY p.id
      ORDER BY revenue_paisa DESC
    `).all(startISO, endISO) as any[];

    let totalRevenue = 0;
    let totalCogs = 0;

    const list = productProfits.map(it => {
      const revenue = it.revenue_paisa || 0;
      const cost = it.cost_paisa || 0;
      const profit = revenue - cost;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

      totalRevenue += revenue;
      totalCogs += cost;

      return {
        product_id: it.product_id,
        product_name: it.product_name,
        barcode: it.barcode,
        qty_sold: it.qty_sold,
        revenue_paisa: revenue,
        cost_paisa: cost,
        profit_paisa: profit,
        margin_percent: margin,
      };
    });

    const grossProfit = totalRevenue - totalCogs;
    const overallMargin = totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;

    return {
      start_date: startDate,
      end_date: endDate,
      total_revenue_paisa: totalRevenue,
      total_cogs_paisa: totalCogs,
      gross_profit_paisa: grossProfit,
      total_discounts_paisa: 0,
      net_profit_paisa: grossProfit,
      profit_margin_percent: overallMargin,
      product_profits: list,
    };
  });

  // Best Selling Products
  ipcMain.handle('api:reports:getBestSelling', async (_event, limitRaw) => {
    requireRole(['owner', 'staff']);
    const limit = typeof limitRaw === 'number' ? limitRaw : 10;
    const db = getDb();

    return db.prepare(`
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.barcode,
        c.name as category_name,
        SUM(si.qty) as qty_sold,
        SUM(si.unit_price_paisa * si.qty - si.discount_paisa) as revenue_paisa
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE s.deleted_at IS NULL AND s.status = 'completed'
      GROUP BY p.id
      ORDER BY qty_sold DESC
      LIMIT ?
    `).all(limit);
  });

  // Stock Valuation Report
  ipcMain.handle('api:reports:getStockValuation', async () => {
    requireRole(['owner']);
    const db = getDb();

    const products = db.prepare(`
      SELECT cost_price_paisa, sell_price_paisa, stock_qty
      FROM products
      WHERE deleted_at IS NULL
    `).all() as any[];

    let totalItemsCount = products.length;
    let totalStockUnits = 0;
    let totalCostValuation = 0;
    let totalRetailValuation = 0;

    products.forEach(p => {
      const qty = p.stock_qty || 0;
      totalStockUnits += qty;
      totalCostValuation += p.cost_price_paisa * qty;
      totalRetailValuation += p.sell_price_paisa * qty;
    });

    const potentialGrossProfit = totalRetailValuation - totalCostValuation;
    const potentialMargin = totalRetailValuation > 0
      ? parseFloat(((potentialGrossProfit / totalRetailValuation) * 100).toFixed(1))
      : 0;

    return {
      total_products_count: totalItemsCount,
      total_stock_units: totalStockUnits,
      total_cost_valuation_paisa: totalCostValuation,
      total_retail_valuation_paisa: totalRetailValuation,
      potential_gross_profit_paisa: potentialGrossProfit,
      potential_margin_percent: potentialMargin,
    };
  });

  // Users Management Handlers
  ipcMain.handle('api:users:list', async () => {
    requireRole(['owner']);
    const db = getDb();
    return db.prepare('SELECT id, username, name, role, is_active, device_id, created_at, updated_at FROM users WHERE deleted_at IS NULL ORDER BY name ASC').all();
  });

  ipcMain.handle('api:users:create', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({
      username: z.string().min(3),
      name: z.string().min(1),
      role: z.enum(['owner', 'staff']),
      password: z.string().min(4),
    });
    const data = schema.parse(rawData);
    const db = getDb();

    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND deleted_at IS NULL').get(data.username);
    if (existing) {
      throw new Error(`Username "${data.username}" is already taken.`);
    }

    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(data.password, salt);
    const id = uuidv7();
    const now = new Date().toISOString();
    const deviceId = getDeviceId(db);

    db.prepare(`
      INSERT INTO users (id, name, username, role, password_hash, is_active, device_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, data.name.trim(), data.username.trim(), data.role, passwordHash, deviceId, now, now);

    logAudit('CREATE_USER', 'users', id, { username: data.username, role: data.role });
    return {
      id,
      name: data.name.trim(),
      username: data.username.trim(),
      role: data.role,
      is_active: 1,
      device_id: deviceId,
      created_at: now,
      updated_at: now,
    };
  });

  ipcMain.handle('api:users:update', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.enum(['owner', 'staff']),
      is_active: z.boolean(),
    });
    const data = schema.parse(rawData);
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE users SET name = ?, role = ?, is_active = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(data.name.trim(), data.role, data.is_active ? 1 : 0, now, data.id);

    logAudit('UPDATE_USER', 'users', data.id, { name: data.name, role: data.role, is_active: data.is_active });
    return { success: true };
  });

  ipcMain.handle('api:users:changePassword', async (_event, rawData) => {
    const schema = z.object({
      userId: z.string().min(1),
      newPassword: z.string().min(4),
    });
    const data = schema.parse(rawData);

    if (activeSession?.role !== 'owner' && activeSession?.id !== data.userId) {
      throw new Error('Unauthorized: You can only change your own password unless you are the Owner.');
    }

    const db = getDb();
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(data.newPassword, salt);
    const now = new Date().toISOString();

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, now, data.userId);
    logAudit('CHANGE_PASSWORD', 'users', data.userId);
    return { success: true };
  });

  // Settings Handlers
  ipcMain.handle('api:settings:get', async () => {
    requireRole(['owner', 'staff']);
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.key] = r.value; });

    return {
      shop_name: map['shop_name'] || 'Mechanical Parts Shop',
      shop_address: map['shop_address'] || 'Dhaka, Bangladesh',
      shop_phone: map['shop_phone'] || '01700-000000',
      invoice_footer: map['invoice_footer'] || 'Thank you for your business!',
      device_id: map['device_id'] || 'REG01',
      idle_lock_minutes: map['idle_lock_minutes'] || '15',
      default_invoice_layout: map['default_invoice_layout'] || '80mm',
      supabase_url: map['supabase_url'] || '',
      supabase_anon_key: map['supabase_anon_key'] ? '********' : '',
      supabase_shop_id: map['supabase_shop_id'] || '',
    };
  });

  ipcMain.handle('api:settings:update', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.record(z.string());
    const data = schema.parse(rawData);
    const db = getDb();
    const now = new Date().toISOString();

    const insertOrUpdate = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    db.transaction(() => {
      for (const [k, v] of Object.entries(data)) {
        insertOrUpdate.run(k, v, now);
      }
    })();

    logAudit('UPDATE_SETTINGS', 'settings', undefined, data);
    return { success: true };
  });

  // Audit Log Handler
  ipcMain.handle('api:audit:list', async (_event, limitRaw) => {
    requireRole(['owner']);
    const limit = typeof limitRaw === 'number' ? limitRaw : 100;
    const db = getDb();

    return db.prepare(`
      SELECT a.*, u.name as user_name
      FROM audit_log a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
      LIMIT ?
    `).all(limit);
  });

  // --- PHASE 5: CLOUD SYNC & BACKUP HANDLERS ---
  ipcMain.handle('api:sync:getStatus', async () => {
    requireRole(['owner', 'staff']);
    return getSyncStatus();
  });

  ipcMain.handle('api:sync:triggerNow', async () => {
    requireRole(['owner', 'staff']);
    return executeDeltaSync();
  });

  ipcMain.handle('api:sync:configure', async (_event, rawConfig) => {
    requireRole(['owner']);
    const schema = z.object({
      supabaseUrl: z.string().url(),
      supabaseAnonKey: z.string().min(10),
      shopId: z.string().min(1),
    });

    const config = schema.parse(rawConfig);
    const db = getDb();
    const now = new Date().toISOString();

    const encryptedKey = encryptSecret(config.supabaseAnonKey);

    const insertOrUpdate = db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    db.transaction(() => {
      insertOrUpdate.run('supabase_url', config.supabaseUrl.trim(), now);
      insertOrUpdate.run('supabase_anon_key', encryptedKey, now);
      insertOrUpdate.run('supabase_shop_id', config.shopId.trim(), now);
    })();

    logAudit('CONFIGURE_CLOUD_SYNC', 'settings', undefined, {
      url: config.supabaseUrl,
      shopId: config.shopId,
    });

    // Trigger initial delta pass asynchronously
    executeDeltaSync().catch(console.error);

    return { success: true };
  });

  ipcMain.handle('api:backup:list', async () => {
    requireRole(['owner']);
    return listBackups();
  });

  ipcMain.handle('api:backup:createManual', async (_event, rawTargetPath) => {
    requireRole(['owner']);
    const targetPath = typeof rawTargetPath === 'string' && rawTargetPath.trim() ? rawTargetPath.trim() : undefined;
    return createDatabaseBackup(targetPath, false);
  });

  ipcMain.handle('api:backup:restore', async (_event, rawBackupFilePath) => {
    requireRole(['owner']);
    const backupFilePath = z.string().min(1).parse(rawBackupFilePath);
    restoreDatabase(backupFilePath);
    return { success: true };
  });

  // --- SUPPLIERS & PURCHASES HANDLERS ---
  ipcMain.handle('api:suppliers:list', async () => {
    requireRole(['owner', 'staff']);
    const db = getDb();
    return db.prepare('SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY name ASC').all();
  });

  ipcMain.handle('api:suppliers:create', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({
      name: z.string().min(1),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      contact_person: z.string().optional().nullable(),
      opening_balance_taka: z.number().min(0).optional().default(0),
      payment_terms_days: z.number().int().min(0).max(365).optional().nullable(),
      note: z.string().optional().nullable(),
    });
    const data = schema.parse(rawData);
    const db = getDb();
    const id = uuidv7();
    const now = new Date().toISOString();
    // Whatever was already owed before the software started is the opening
    // payable, otherwise the ledger begins from a balance that is not true.
    const openingPaisa = Math.round((data.opening_balance_taka || 0) * 100);

    db.prepare(`
      INSERT INTO suppliers (
        id, name, phone, address, contact_person, opening_balance_paisa,
        payment_terms_days, note, total_payable_paisa, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name.trim(), data.phone?.trim() || null, data.address?.trim() || null,
      data.contact_person?.trim() || null, openingPaisa,
      data.payment_terms_days ?? null, data.note?.trim() || null,
      openingPaisa, now, now
    );

    logAudit('CREATE_SUPPLIER', 'suppliers', id, { name: data.name });
    return { id, ...data };
  });

  ipcMain.handle('api:purchases:create', async (_event, rawData) => {
    requireRole(['owner', 'staff']);
    const schema = z.object({
      supplier_id: z.string().optional().nullable(),
      invoice_ref: z.string().optional().nullable(),
      paid_taka: z.number().min(0),
      transport_taka: z.number().min(0).optional().default(0),
      transport_on_invoice: z.boolean().optional().default(true),
      note: z.string().optional().nullable(),
      items: z.array(z.object({
        product_id: z.string().min(1),
        qty: z.number().int().positive(),
        unit_cost_taka: z.number().min(0),
      })).min(1),
    });

    const data = schema.parse(rawData);
    const db = getDb();
    const purchaseId = uuidv7();
    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';

    let goodsPaisa = 0;
    const itemsPaisa = data.items.map(item => {
      const costPaisa = Math.round(item.unit_cost_taka * 100);
      goodsPaisa += costPaisa * item.qty;
      return { ...item, unit_cost_paisa: costPaisa };
    });

    // Transport is a real cost of getting the goods in, so it is spread across
    // the lines by value rather than ignored — otherwise stock looks cheaper
    // than it was and every sale of it reports too much profit.
    const transportPaisa = Math.round((data.transport_taka || 0) * 100);

    // Who the fare is owed to decides only whether it joins the vendor's bill.
    // A delivery charge on their challan does; a pickup van the shop hired
    // does not, and billing it to the vendor would overstate the payable.
    // Either way it lands on the stock below.
    const transportOnInvoice = data.transport_on_invoice !== false;
    const vendorInvoicePaisa = goodsPaisa + (transportOnInvoice ? transportPaisa : 0);
    const paidPaisa = Math.round(data.paid_taka * 100);

    // Paying past the vendor's bill used to be swallowed by the `due > 0`
    // guard below: the extra vanished and the ledger read negative forever.
    if (paidPaisa > vendorInvoicePaisa) {
      throw new Error(
        `Paid amount \u09f3 ${(paidPaisa / 100).toFixed(2)} is more than this vendor's bill of \u09f3 ${(
          vendorInvoicePaisa / 100
        ).toFixed(2)}${
          transportOnInvoice
            ? '.'
            : ' (transport is paid separately, so it is not part of the vendor bill).'
        }`
      );
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO purchases (id, supplier_id, invoice_ref, total_paisa, paid_paisa, transport_paisa, transport_on_invoice, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(purchaseId, data.supplier_id || null, data.invoice_ref || null, vendorInvoicePaisa, paidPaisa, transportPaisa, transportOnInvoice ? 1 : 0, data.note || null, now, now);

      const insertItem = db.prepare(`
        INSERT INTO purchase_items (id, purchase_id, product_id, qty, unit_cost_paisa, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const readProduct = db.prepare('SELECT stock_qty, cost_price_paisa FROM products WHERE id = ?');
      const updateProduct = db.prepare('UPDATE products SET stock_qty = stock_qty + ?, cost_price_paisa = ?, updated_at = ? WHERE id = ?');
      const insertStockTx = db.prepare(`
        INSERT INTO stock_transactions (id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at)
        VALUES (?, ?, 'purchase', ?, 'purchases', ?, ?, ?, ?, ?)
      `);

      // Allocate transport across the lines up front so the parts add back up
      // to the charge exactly; rounding each line independently left a few
      // paisa stranded. Any remainder lands on the largest line.
      const transportAlloc: number[] = itemsPaisa.map((item) =>
        goodsPaisa > 0
          ? Math.floor((transportPaisa * item.unit_cost_paisa * item.qty) / goodsPaisa)
          : 0
      );
      if (transportPaisa > 0 && itemsPaisa.length > 0) {
        const allocated = transportAlloc.reduce((n, v) => n + v, 0);
        let biggest = 0;
        itemsPaisa.forEach((item, i) => {
          if (item.unit_cost_paisa * item.qty > itemsPaisa[biggest].unit_cost_paisa * itemsPaisa[biggest].qty) {
            biggest = i;
          }
        });
        transportAlloc[biggest] += transportPaisa - allocated;
      }

      for (const [itemIndex, item] of itemsPaisa.entries()) {
        // Landed unit cost = the price paid, plus this line's share of transport.
        const lineGoodsPaisa = item.unit_cost_paisa * item.qty;
        const lineTransportPaisa = transportAlloc[itemIndex];
        const landedUnitCostPaisa =
          item.qty > 0 ? Math.round((lineGoodsPaisa + lineTransportPaisa) / item.qty) : item.unit_cost_paisa;

        // Weighted average against stock already on the shelf. Overwriting the
        // cost priced older stock at the newest rate, which is simply untrue.
        const existing = readProduct.get(item.product_id) as
          | { stock_qty: number; cost_price_paisa: number }
          | undefined;
        const oldQty = Math.max(0, existing?.stock_qty ?? 0);
        const oldCost = existing?.cost_price_paisa ?? landedUnitCostPaisa;
        const newQty = oldQty + item.qty;
        const averagedCostPaisa =
          newQty > 0
            ? Math.round((oldQty * oldCost + item.qty * landedUnitCostPaisa) / newQty)
            : landedUnitCostPaisa;

        insertItem.run(uuidv7(), purchaseId, item.product_id, item.qty, item.unit_cost_paisa, now, now);
        updateProduct.run(item.qty, averagedCostPaisa, now, item.product_id);
        insertStockTx.run(uuidv7(), item.product_id, item.qty, purchaseId, `Purchase invoice ${data.invoice_ref || purchaseId.slice(0, 8)}`, userId, now, now);
      }

      const duePaisa = vendorInvoicePaisa - paidPaisa;
      if (data.supplier_id && duePaisa > 0) {
        db.prepare('UPDATE suppliers SET total_payable_paisa = total_payable_paisa + ?, updated_at = ? WHERE id = ?').run(duePaisa, now, data.supplier_id);
      }
    })();

    logAudit('CREATE_PURCHASE', 'purchases', purchaseId, {
      vendorInvoicePaisa,
      paidPaisa,
      transportPaisa,
      transportOnInvoice,
      landedTotalPaisa: goodsPaisa + transportPaisa,
    });
    return { success: true, purchaseId };
  });

  ipcMain.handle('api:suppliers:update', async (_event, rawData) => {
    requireRole(['owner']);
    const schema = z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
      contact_person: z.string().optional().nullable(),
      opening_balance_taka: z.number().min(0).optional().default(0),
      payment_terms_days: z.number().int().min(0).max(365).optional().nullable(),
      note: z.string().optional().nullable(),
    });
    const data = schema.parse(rawData);
    const db = getDb();
    const now = new Date().toISOString();

    const existing = db.prepare(
      'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
    ).get(data.id) as any;
    if (!existing) throw new Error('Supplier not found or already deleted.');

    // Correcting the opening balance has to move the live payable by the same
    // amount, otherwise the ledger opens from one figure and totals another.
    const newOpeningPaisa = Math.round((data.opening_balance_taka || 0) * 100);
    const openingDeltaPaisa = newOpeningPaisa - (existing.opening_balance_paisa || 0);
    const newPayablePaisa = (existing.total_payable_paisa || 0) + openingDeltaPaisa;
    if (newPayablePaisa < 0) {
      throw new Error(
        `That opening balance is too low \u2014 it would push the payable below zero. Lowest allowed is \u09f3 ${(
          (newOpeningPaisa - newPayablePaisa) / 100
        ).toFixed(2)}.`
      );
    }

    db.prepare(`
      UPDATE suppliers SET
        name = ?, phone = ?, address = ?, contact_person = ?,
        opening_balance_paisa = ?, payment_terms_days = ?, note = ?,
        total_payable_paisa = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL
    `).run(
      data.name.trim(), data.phone?.trim() || null, data.address?.trim() || null,
      data.contact_person?.trim() || null, newOpeningPaisa,
      data.payment_terms_days ?? null, data.note?.trim() || null,
      newPayablePaisa, now, data.id
    );

    logAudit('UPDATE_SUPPLIER', 'suppliers', data.id, {
      name: data.name,
      openingDeltaPaisa,
      previousPayablePaisa: existing.total_payable_paisa || 0,
      newPayablePaisa,
    });
    return { success: true };
  });

  ipcMain.handle('api:suppliers:delete', async (_event, rawId) => {
    requireRole(['owner']);
    const id = z.string().min(1).parse(rawId);
    const db = getDb();

    const supplier = db.prepare(
      'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
    ).get(id) as any;
    if (!supplier) throw new Error('Supplier not found or already deleted.');

    // Money still owed is the one thing a delete must never hide.
    if ((supplier.total_payable_paisa || 0) > 0) {
      throw new Error(
        `Cannot delete this supplier \u2014 \u09f3 ${(
          supplier.total_payable_paisa / 100
        ).toFixed(2)} is still payable. Settle the balance first.`
      );
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE suppliers SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);

    logAudit('DELETE_SUPPLIER', 'suppliers', id, { name: supplier.name });
    return { success: true };
  });

  ipcMain.handle('api:suppliers:payDue', async (_event, rawPayload) => {
    requireRole(['owner']);
    const schema = z.object({
      supplier_id: z.string().min(1),
      amount_taka: z.number().positive(),
      method: z.enum(['cash', 'bkash', 'nagad', 'card']).default('cash'),
      note: z.string().optional().nullable(),
    });

    const payload = schema.parse(rawPayload);
    const db = getDb();
    const now = new Date().toISOString();
    const userId = activeSession?.id || 'system';
    const deviceId = getDeviceId(db);
    const paymentId = uuidv7();
    const amountPaisa = Math.round(payload.amount_taka * 100);

    const supplier = db.prepare(
      'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
    ).get(payload.supplier_id) as any;
    if (!supplier) throw new Error('Supplier not found.');

    const previousPayablePaisa = supplier.total_payable_paisa || 0;
    if (amountPaisa > previousPayablePaisa) {
      throw new Error(
        `Payment is more than the outstanding payable (৳ ${(previousPayablePaisa / 100).toFixed(2)}).`
      );
    }

    db.transaction(() => {
      db.prepare(`
        INSERT INTO payments (
          id, supplier_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, 'out', ?, ?, 'supplier_payment', ?, ?, ?, ?)
      `).run(paymentId, payload.supplier_id, payload.method, amountPaisa, userId, deviceId, now, now);

      db.prepare(
        'UPDATE suppliers SET total_payable_paisa = MAX(0, total_payable_paisa - ?), updated_at = ? WHERE id = ?'
      ).run(amountPaisa, now, payload.supplier_id);
    })();

    const remainingPayablePaisa = Math.max(0, previousPayablePaisa - amountPaisa);

    logAudit('PAY_SUPPLIER', 'payments', paymentId, {
      supplierId: payload.supplier_id,
      amountPaisa,
      previousPayablePaisa,
      remainingPayablePaisa,
      method: payload.method,
    });

    return { success: true, paymentId, remainingPayablePaisa };
  });

  ipcMain.handle('api:suppliers:getLedger', async (_event, rawId) => {
    requireRole(['owner']);
    const id = z.string().min(1).parse(rawId);
    const db = getDb();

    const supplier = db.prepare(
      'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
    ).get(id) as any;
    if (!supplier) throw new Error('Supplier not found.');

    const purchases = db.prepare(`
      SELECT id, invoice_ref, total_paisa, paid_paisa, transport_paisa,
             transport_on_invoice, note, created_at
      FROM purchases WHERE supplier_id = ? AND deleted_at IS NULL
    `).all(id) as any[];

    const payments = db.prepare(`
      SELECT id, amount_paisa, method, created_at
      FROM payments
      WHERE supplier_id = ? AND direction = 'out' AND type = 'supplier_payment' AND deleted_at IS NULL
    `).all(id) as any[];

    // Purchases add to what is owed; payments (and anything settled on the
    // invoice itself) take away from it.
    const entries = [
      ...purchases.map((p) => ({
        id: p.id,
        kind: 'purchase' as const,
        created_at: p.created_at,
        label: p.invoice_ref ? `Purchase ${p.invoice_ref}` : 'Purchase invoice',
        note: p.note || null,
        debit_paisa: p.total_paisa,
        credit_paisa: p.paid_paisa,
        // Only a fare the vendor actually billed belongs on their ledger row;
        // one the shop paid the driver is stock cost, not vendor money.
        transport_paisa: p.transport_on_invoice ? (p.transport_paisa || 0) : 0,
      })),
      ...payments.map((p) => ({
        id: p.id,
        kind: 'payment' as const,
        created_at: p.created_at,
        label: `Payment (${p.method})`,
        note: null,
        debit_paisa: 0,
        credit_paisa: p.amount_paisa,
        transport_paisa: 0,
      })),
    ].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

    let balance = supplier.opening_balance_paisa || 0;
    const rows = entries.map((e) => {
      balance += e.debit_paisa - e.credit_paisa;
      return { ...e, balance_paisa: balance };
    });

    return {
      supplier,
      opening_balance_paisa: supplier.opening_balance_paisa || 0,
      rows,
      closing_balance_paisa: balance,
    };
  });

  ipcMain.handle('api:purchases:list', async () => {
    requireRole(['owner', 'staff']);
    const db = getDb();
    return db.prepare(`
      SELECT p.*, s.name as supplier_name 
      FROM purchases p 
      LEFT JOIN suppliers s ON p.supplier_id = s.id 
      WHERE p.deleted_at IS NULL 
      ORDER BY p.created_at DESC
    `).all();
  });

  ipcMain.handle('api:stockTransactions:list', async (_event, rawProductId) => {
    requireRole(['owner', 'staff']);
    const productId = z.string().min(1).parse(rawProductId);
    const db = getDb();
    return db.prepare(`
      SELECT st.*, u.name as user_name 
      FROM stock_transactions st 
      LEFT JOIN users u ON st.user_id = u.id 
      WHERE st.product_id = ? 
      ORDER BY st.created_at DESC
    `).all(productId);
  });

  // --- FIRST-RUN WIZARD & ONBOARDING ---
  ipcMain.handle('api:wizard:checkStatus', async () => {
    const db = getDb();
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'first_run_completed'").get() as any;
    return { isFirstRun: !setting || setting.value !== '1' };
  });

  ipcMain.handle('api:wizard:completeFirstRun', async (_event, rawPayload) => {
    const db = getDb();
    const already = db.prepare("SELECT value FROM settings WHERE key = 'first_run_completed'").get() as any;
    if (already?.value === '1') {
      requireRole(['owner']);
    }

    const schema = z.object({
      shop_name: z.string().min(1),
      shop_address: z.string().optional().nullable(),
      shop_phone: z.string().optional().nullable(),
      device_id_prefix: z.string().default('REG01'),
      default_invoice_layout: z.enum(['80mm', 'a5']).default('80mm'),
      owner_password: z.string().min(4).optional().nullable(),
    });

    const data = schema.parse(rawPayload);
    const now = new Date().toISOString();

    db.transaction(() => {
      const upsertSetting = db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);

      upsertSetting.run('shop_name', data.shop_name, now);
      upsertSetting.run('shop_address', data.shop_address || '', now);
      upsertSetting.run('shop_phone', data.shop_phone || '', now);
      upsertSetting.run('device_id_prefix', data.device_id_prefix, now);
      upsertSetting.run('default_invoice_layout', data.default_invoice_layout, now);
      upsertSetting.run('first_run_completed', '1', now);

      if (data.owner_password) {
        const salt = bcrypt.genSaltSync(12);
        const hash = bcrypt.hashSync(data.owner_password, salt);
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?').run(hash, now, 'owner');
      }
    })();

    logAudit('FIRST_RUN_WIZARD_COMPLETED', 'settings', undefined, { shopName: data.shop_name });
    return { success: true };
  });

  // --- DEMO SEED & RESET HANDLERS ---
  ipcMain.handle('api:demo:seed', async () => {
    requireRole(['owner']);
    const db = getDb();
    const now = new Date().toISOString();
    const userId = activeSession?.id || null;

    db.transaction(() => {
      // 1. Categories
      const catEngineId = 'cat-engine-001';
      const catBrakeId = 'cat-brake-002';
      const catElecId = 'cat-elec-003';

      const insertCat = db.prepare(`
        INSERT OR IGNORE INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
      `);
      insertCat.run(catEngineId, 'Engine & Transmission', now, now);
      insertCat.run(catBrakeId, 'Brake & Suspension', now, now);
      insertCat.run(catElecId, 'Electrical & Filters', now, now);

      // 2. 10 Mechanical Products
      const demoProducts = [
        { id: 'p-001', barcode: '8901001', name: 'Piston Ring Set Standard', name_bn: 'পিস্টন রিং সেট', cat: catEngineId, brand: 'Mahle', unit: 'set', cost: 120000, sell: 175000, stock: 25, thresh: 5 },
        { id: 'p-002', barcode: '8901002', name: 'Spark Plug BP6EY Iridium', name_bn: 'স্পার্ক প্লাগ ইরিডিয়াম', cat: catElecId, brand: 'NGK', unit: 'pcs', cost: 18000, sell: 28000, stock: 60, thresh: 10 },
        { id: 'p-003', barcode: '8901003', name: 'Front Brake Pad Heavy Duty', name_bn: 'ফ্রন্ট ব্রেক প্যাড', cat: catBrakeId, brand: 'Bosch', unit: 'set', cost: 85000, sell: 135000, stock: 20, thresh: 4 },
        { id: 'p-004', barcode: '8901004', name: 'Clutch Plate 190mm', name_bn: 'ক্লাচ প্লেট', cat: catEngineId, brand: 'Exedy', unit: 'pcs', cost: 240000, sell: 350000, stock: 12, thresh: 3 },
        { id: 'p-005', barcode: '8901005', name: 'Engine Oil 20W-50 4L', name_bn: 'মবিল ইঞ্জিন অয়েল ৪ লিটার', cat: catElecId, brand: 'Castrol', unit: 'box', cost: 165000, sell: 220000, stock: 30, thresh: 6 },
        { id: 'p-006', barcode: '8901006', name: 'Wheel Ball Bearing 6204-2RS', name_bn: 'হুইল বেয়ারিং', cat: catBrakeId, brand: 'SKF', unit: 'pcs', cost: 32000, sell: 55000, stock: 45, thresh: 8 },
        { id: 'p-007', barcode: '8901007', name: 'Oil Filter Spin-On', name_bn: 'অয়েল ফিল্টার', cat: catElecId, brand: 'Denso', unit: 'pcs', cost: 25000, sell: 42000, stock: 40, thresh: 8 },
        { id: 'p-008', barcode: '8901008', name: 'Timing Belt 123 Teeth', name_bn: 'টাইমিং বেল্ট', cat: catEngineId, brand: 'Gates', unit: 'pcs', cost: 95000, sell: 155000, stock: 15, thresh: 3 },
        { id: 'p-009', barcode: '8901009', name: 'Full Cylinder Head Gasket', name_bn: 'হেড গ্যাসকেট', cat: catEngineId, brand: 'Payen', unit: 'pcs', cost: 110000, sell: 180000, stock: 18, thresh: 4 },
        { id: 'p-010', barcode: '8901010', name: 'Fuel Injector Nozzle Assembly', name_bn: 'ফুয়েল ইনজেক্টর নজেল', cat: catElecId, brand: 'Bosch', unit: 'set', cost: 380000, sell: 540000, stock: 8, thresh: 2 },
      ];

      const insertProd = db.prepare(`
        INSERT OR REPLACE INTO products (id, barcode, name, name_bn, category_id, brand, unit, cost_price_paisa, sell_price_paisa, stock_qty, low_stock_threshold, is_serial_tracked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);

      for (const p of demoProducts) {
        insertProd.run(p.id, p.barcode, p.name, p.name_bn, p.cat, p.brand, p.unit, p.cost, p.sell, p.stock, p.thresh, now, now);
      }

      // 3. 3 Demo Customers
      const insertCust = db.prepare(`
        INSERT OR REPLACE INTO customers (id, name, phone, address, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      insertCust.run('cust-001', 'Master Kamal Auto Workshop', '01712-345678', 'Tejgaon Industrial Area, Dhaka', 'Regular monthly credit client', now, now);
      insertCust.run('cust-002', 'Rasel CNG Garage', '01819-876543', 'Mirpur-10, Dhaka', 'Settles due every Thursday', now, now);
      insertCust.run('cust-003', 'Faruk Bike Care Point', '01911-223344', 'Nawabpur, Old Dhaka', 'Quick repair shop', now, now);

      // 4. 2 Demo Suppliers
      const insertSup = db.prepare(`
        INSERT OR REPLACE INTO suppliers (id, name, phone, address, total_payable_paisa, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?)
      `);
      insertSup.run('sup-001', 'Dhaka Motor Spares Importer', '01700-112233', 'Banglamotor, Dhaka', now, now);
      insertSup.run('sup-002', 'Chittagong Bearing & Belts Ltd.', '01800-445566', 'Jubilee Road, Chattogram', now, now);
    })();

    logAudit('DEMO_DATA_SEEDED', 'system', undefined, { productCount: 10, customerCount: 3 });
    return { success: true, count: 10 };
  });

  ipcMain.handle('api:demo:reset', async () => {
    requireRole(['owner']);
    const db = getDb();
    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare('DELETE FROM return_items').run();
      db.prepare('DELETE FROM returns').run();
      db.prepare('DELETE FROM payments').run();
      db.prepare('DELETE FROM sale_items').run();
      db.prepare('DELETE FROM sales').run();
      db.prepare('DELETE FROM held_sales').run();
      db.prepare('DELETE FROM purchase_items').run();
      db.prepare('DELETE FROM purchases').run();
      db.prepare('DELETE FROM stock_transactions').run();
      db.prepare('DELETE FROM products').run();
      db.prepare('DELETE FROM categories').run();
      db.prepare('DELETE FROM customers').run();
      db.prepare('DELETE FROM suppliers').run();
      db.prepare('DELETE FROM sync_state').run();
    })();

    logAudit('DATABASE_CLEAN_RESET', 'system', undefined, { timestamp: now });
    return { success: true };
  });
}

