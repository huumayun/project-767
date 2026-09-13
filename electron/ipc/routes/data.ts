import { ipcMain } from 'electron';
import bcrypt from 'bcryptjs';
import path from 'path';
import { z } from 'zod';
import { getDb } from '../../db';
import { activeSession, requireRole, logAudit } from '../shared';
import { createDatabaseBackup, getBackupsDirectory } from '../../services/backupManager';

/*
 * Erasing a shop's business data.
 *
 * There is a real use for this - clearing the test sales and practice stock a
 * shop entered while learning the till, before it opens for real - which is why
 * it exists at all. It used to sit beside the sample-data button as
 * "Reset Database to Clean Slate": one click, one "are you sure", and every sale,
 * payment, purchase, customer balance and shift the shop had ever recorded was
 * deleted outright, with no copy kept anywhere. A misclick on a busy counter was
 * the whole of the shop's history.
 *
 * Now it takes the owner's password, typed again, and the word ERASE; and before
 * a single row goes, a complete backup is written to the backups folder. If that
 * backup cannot be written, nothing is erased. The backup shows up in Backups
 * and restores like any other.
 */

/** Children before parents, so no delete trips a foreign key. */
const BUSINESS_TABLES = [
  'shift_cash_transactions',
  'shifts',
  'sale_item_batches',
  'serial_numbers',
  'return_items',
  'returns',
  'payments',
  'sale_items',
  'sales',
  'purchase_items',
  'purchases',
  'stock_transactions',
  'inventory_batches',
  'products',
  'categories',
  'customers',
  'suppliers',
  'sync_state',
];

export const ERASE_CONFIRM_WORD = 'ERASE';

function businessCounts(db: any) {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM sales WHERE status != 'held') AS sales,
      (SELECT COUNT(*) FROM purchases)  AS purchases,
      (SELECT COUNT(*) FROM products)   AS products,
      (SELECT COUNT(*) FROM customers)  AS customers,
      (SELECT COUNT(*) FROM suppliers)  AS suppliers,
      (SELECT COUNT(*) FROM shifts)     AS shifts
  `).get() as { sales: number; purchases: number; products: number; customers: number; suppliers: number; shifts: number };
}

export function registerDataHandlers() {
  /** What erasing would remove, so the owner sees the size of it before deciding. */
  ipcMain.handle('api:data:counts', async () => {
    requireRole(['owner']);
    const db = getDb();
    const cloud = db
      .prepare("SELECT value FROM settings WHERE key = 'supabase_url'")
      .get() as { value?: string } | undefined;
    return { ...businessCounts(db), cloudSyncConfigured: Boolean(cloud?.value) };
  });

  ipcMain.handle('api:data:erase', async (_event, rawArgs) => {
    requireRole(['owner']);
    const { password, confirmText } = z
      .object({ password: z.string().min(1), confirmText: z.string() })
      .parse(rawArgs);

    if (confirmText.trim().toUpperCase() !== ERASE_CONFIRM_WORD) {
      throw new Error(`Type ${ERASE_CONFIRM_WORD} to confirm. Nothing was erased.`);
    }

    const db = getDb();

    // The session alone is not enough for this. A counter left logged in as the
    // owner is exactly the situation where the wrong person reaches the button.
    const owner = db
      .prepare('SELECT id, password_hash FROM users WHERE id = ? AND is_active = 1 AND deleted_at IS NULL')
      .get(activeSession!.id) as { id: string; password_hash: string } | undefined;
    if (!owner || !bcrypt.compareSync(password, owner.password_hash)) {
      logAudit('BUSINESS_DATA_ERASE_REFUSED', 'system', undefined, { reason: 'wrong password' });
      throw new Error('That password is not correct. Nothing was erased.');
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    let backup;
    try {
      backup = createDatabaseBackup(path.join(getBackupsDirectory(), `pre-erase-${stamp}.db`), false);
    } catch (err: any) {
      throw new Error(
        `Nothing was erased: the safety backup could not be written (${err?.message || 'unknown error'}).`
      );
    }

    const erased = businessCounts(db);
    db.transaction(() => {
      for (const table of BUSINESS_TABLES) db.prepare(`DELETE FROM ${table}`).run();
    })();

    // Kept on purpose: users, settings, the audit log and every backup. The log
    // is how anyone later finds out this happened, and who did it.
    logAudit('BUSINESS_DATA_ERASED', 'system', undefined, { erased, backup: backup.filePath });

    return { success: true, erased, backupFile: backup.fileName, backupPath: backup.filePath };
  });
}
