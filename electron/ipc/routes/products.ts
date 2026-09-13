
import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit , processStockIn, consumeFifoBatches, findBatchDrift } from '../shared';


export function registerProductsHandlers() {
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
  
      const batchesStmt = db.prepare('SELECT remaining_qty, cost_price_paisa, received_at FROM inventory_batches WHERE product_id = ? AND remaining_qty > 0 ORDER BY received_at ASC');
      return products.map(p => {
        const batches = batchesStmt.all(p.id);
        return { ...p, batches };
      });
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
              id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at, unit_cost_paisa
            ) VALUES (?, ?, 'initial', ?, 'products', ?, 'Initial stock setup', ?, ?, ?, ?)
          `).run(uuidv7(), id, data.stock_qty, id, activeSession?.id || 'system', now, now, data.cost_price_paisa);

          db.prepare(`
            INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'products', ?)
          `).run(id, data.stock_qty, data.stock_qty, data.cost_price_paisa, now, id);
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
        data.barcode || existingProduct.barcode, data.name.trim(),
        // Absent means "leave it as it is", not "clear it". The product form no
        // longer offers a Bangla name, so every ordinary edit would otherwise
        // wipe one that came in through a CSV import.
        data.name_bn === undefined ? existingProduct.name_bn : (data.name_bn?.trim() || null),
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
        cost_price_paisa: z.number().int().nonnegative().optional(),
        sell_price_paisa: z.number().int().nonnegative().optional(),
        reason: z.string().optional(),
      });
  
      const data = schema.parse(rawData);
      const db = getDb();
      const userId = activeSession?.id || 'system';
      const deviceId = getDeviceId(db);
  
      let newStock = 0;
      db.transaction(() => {
        newStock = processStockIn(
          db,
          data.product_id,
          data.qty,
          data.cost_price_paisa !== undefined ? data.cost_price_paisa : null,
          data.reason || 'Quick stock-in',
          userId,
          deviceId,
          'products',
          data.product_id
        );
  
        if (data.sell_price_paisa !== undefined) {
          db.prepare('UPDATE products SET sell_price_paisa = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
            data.sell_price_paisa,
            data.product_id
          );
        }
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
        const product = db.prepare('SELECT stock_qty, cost_price_paisa FROM products WHERE id = ? AND deleted_at IS NULL').get(data.product_id) as any;
        if (!product) throw new Error('Product not found');
  
        if (product.stock_qty + data.qty_delta < 0) {
          throw new Error('Stock adjustment would result in negative stock quantity.');
        }
  
        newStock = product.stock_qty + data.qty_delta;
        db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?').run(data.qty_delta, now, data.product_id);

        // Adjustments used to move stock_qty alone. Writing off breakage left
        // the units sitting in the FIFO pool to be sold later at a cost that no
        // longer existed, and adding stock left quantity with no batch behind
        // it, so COGS silently fell back to the product's current cost price.
        const costPaisa = product.cost_price_paisa ?? 0;
        let unitCostPaisa = costPaisa;

        if (data.qty_delta < 0) {
          const { totalCostPaisa, shortfall } = consumeFifoBatches(
            db, data.product_id, -data.qty_delta, costPaisa
          );
          unitCostPaisa = Math.round(totalCostPaisa / -data.qty_delta);
          if (shortfall > 0) {
            console.warn(
              `Stock adjustment for ${data.product_id}: ${shortfall} unit(s) had no FIFO batch; ` +
              `costed at the product's current price.`
            );
          }
        } else if (data.qty_delta > 0) {
          db.prepare(`
            INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'adjustment', ?)
          `).run(data.product_id, data.qty_delta, data.qty_delta, costPaisa, now, data.product_id);
        }

        db.prepare(`
          INSERT INTO stock_transactions (
            id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at, unit_cost_paisa
          ) VALUES (?, ?, 'adjustment', ?, 'products', ?, ?, ?, ?, ?, ?)
        `).run(uuidv7(), data.product_id, data.qty_delta, data.product_id, data.reason, userId, now, now, unitCostPaisa);
      })();
  
      logAudit('STOCK_ADJUSTMENT', 'products', data.product_id, { qtyDelta: data.qty_delta, reason: data.reason, newStock });
      return { success: true, newStock };
    });

  // Surfaces any product whose stock count and FIFO batches have come apart.
  // Should always be empty; if it is not, something wrote stock without going
  // through the batch pool and the valuation cannot be trusted.
  ipcMain.handle('api:products:getBatchDrift', async () => {
      requireRole(['owner']);
      return findBatchDrift(getDb());
    });

  ipcMain.handle('api:products:getStockHistory', async (_event, productId: string) => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      return db.prepare(`
        SELECT st.*, u.name as user_name
        FROM stock_transactions st
        LEFT JOIN users u ON st.user_id = u.id
        WHERE st.product_id = ?
        ORDER BY st.created_at DESC
        LIMIT 100
      `).all(productId);
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
                id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at, unit_cost_paisa
              ) VALUES (?, ?, 'initial', ?, 'products', ?, 'CSV Bulk Import', ?, ?, ?, ?)
            `).run(uuidv7(), productId, row.stock_qty, productId, userId, now, now, row.cost_price_paisa);

            /*
             * The opening stock needs a batch behind it, exactly as it does when
             * a product is added by hand.
             *
             * Without one the units existed in products.stock_qty and nowhere
             * else, so the whole imported catalogue showed up in the batch drift
             * report and the stock valuation had to fall back to the product's
             * current cost for every one of them - the same estimate the FIFO
             * pool exists to replace. Selling an imported part costed it against
             * that fallback too, so its margin was whatever the cost price
             * happened to say on the day rather than what the shop paid.
             */
            db.prepare(`
              INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
              VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'products', ?)
            `).run(productId, row.stock_qty, row.stock_qty, row.cost_price_paisa, now, productId);
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

}
