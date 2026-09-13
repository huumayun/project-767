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
      // Parents first, each followed by its own children, so the renderer can
      // build the tree straight from the order it is given.
      return db.prepare(`
        SELECT c.* FROM categories c
        LEFT JOIN categories p ON p.id = c.parent_id
        WHERE c.deleted_at IS NULL
        ORDER BY COALESCE(p.name, c.name) COLLATE NOCASE ASC,
                 c.parent_id IS NOT NULL,
                 c.name COLLATE NOCASE ASC
      `).all();
    });

  ipcMain.handle('api:categories:create', async (_event, rawName, rawParentId) => {
      requireRole(['owner']);
      const name = z.string().min(1).parse(rawName).trim();
      const parentId = z.string().min(1).nullish().parse(rawParentId) || null;
      const db = getDb();
      const id = uuidv7();
      const now = new Date().toISOString();

      if (parentId) {
        const parent = db
          .prepare('SELECT id, parent_id FROM categories WHERE id = ? AND deleted_at IS NULL')
          .get(parentId) as any;
        if (!parent) throw new Error('That parent category no longer exists.');
        // Two levels is what a parts counter needs. Deeper turns browsing into
        // navigation and the picker into a maze.
        if (parent.parent_id) throw new Error('A subcategory cannot hold further subcategories.');
      }

      // Unique within its parent, not across the shop: "Front" can sit under
      // both Brake Pads and Mudguards.
      const existing = db
        .prepare("SELECT id FROM categories WHERE IFNULL(parent_id, '') = ? AND name = ? AND deleted_at IS NULL")
        .get(parentId || '', name);
      if (existing) {
        throw new Error(`"${name}" already exists here.`);
      }

      db.prepare('INSERT INTO categories (id, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, name, parentId, now, now);
      logAudit('CREATE_CATEGORY', 'categories', id, { name, parentId });
      return { id, name, parent_id: parentId };
    });

  ipcMain.handle('api:categories:update', async (_event, rawId, rawName, rawParentId) => {
      requireRole(['owner']);
      const id = z.string().min(1).parse(rawId);
      const name = z.string().min(1).parse(rawName).trim();
      // undefined leaves the parent where it is; null moves it to the top level.
      const parentGiven = rawParentId !== undefined;
      const parentId = parentGiven ? (z.string().min(1).nullish().parse(rawParentId) || null) : null;
      const db = getDb();

      const current = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id) as any;
      if (!current) {
        throw new Error('That category no longer exists.');
      }

      const nextParentId = parentGiven ? parentId : (current.parent_id || null);

      if (nextParentId) {
        if (nextParentId === id) throw new Error('A category cannot be its own parent.');
        const parent = db
          .prepare('SELECT id, parent_id FROM categories WHERE id = ? AND deleted_at IS NULL')
          .get(nextParentId) as any;
        if (!parent) throw new Error('That parent category no longer exists.');
        if (parent.parent_id) throw new Error('A subcategory cannot hold further subcategories.');
      }

      // Pushing a parent under someone else would leave its children a level
      // deeper than anything can reach.
      if (nextParentId && !current.parent_id) {
        const children = db
          .prepare('SELECT COUNT(*) c FROM categories WHERE parent_id = ? AND deleted_at IS NULL')
          .get(id) as any;
        if (children.c > 0) {
          throw new Error(
            `"${current.name}" has ${children.c} subcategor${children.c === 1 ? 'y' : 'ies'}. Move them out before making it a subcategory.`
          );
        }
      }

      const clash = db
        .prepare("SELECT id FROM categories WHERE IFNULL(parent_id, '') = ? AND name = ? AND id != ? AND deleted_at IS NULL")
        .get(nextParentId || '', name, id);
      if (clash) {
        throw new Error(`"${name}" already exists here.`);
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE categories SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?')
        .run(name, nextParentId, now, id);
      logAudit('UPDATE_CATEGORY', 'categories', id, {
        from: current.name,
        to: name,
        parentFrom: current.parent_id || null,
        parentTo: nextParentId,
      });
      return { id, name, parent_id: nextParentId };
    });

  ipcMain.handle('api:categories:delete', async (_event, rawId) => {
      requireRole(['owner']);
      const id = z.string().min(1).parse(rawId);
      const db = getDb();
  
      const category = db.prepare('SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL').get(id) as any;
      if (!category) {
        throw new Error('That category no longer exists.');
      }
  
      // A parent taking its children down with it would hide their products
      // too, so it has to be emptied first - deliberately, one at a time.
      const children = db
        .prepare('SELECT COUNT(*) c FROM categories WHERE parent_id = ? AND deleted_at IS NULL')
        .get(id) as any;
      if (children.c > 0) {
        throw new Error(
          `"${category.name}" still has ${children.c} subcategor${children.c === 1 ? 'y' : 'ies'}. Remove them first.`
        );
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
