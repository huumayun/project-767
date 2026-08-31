import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerCategoriesHandlers() {
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

}
