import bcrypt from 'bcryptjs';
import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import {
  activeSession,
  setActiveSession,
  requireRole,
  getDeviceId,
  logAudit,
  generateRecoveryCodes,
  storeRecoveryCodes,
} from '../shared';


export function registerWizardHandlers() {
  // --- FIRST-RUN WIZARD & ONBOARDING ---
  // Unauthenticated on purpose - the login and PIN screens call this before
  // anyone has a session. It returns only what those screens need to draw
  // themselves; the shop name is already printed on every receipt.
  ipcMain.handle('api:wizard:checkStatus', async () => {
      const db = getDb();
      const setting = db.prepare("SELECT value FROM settings WHERE key = 'first_run_completed'").get() as any;
      const shop = db.prepare("SELECT value FROM settings WHERE key = 'shop_name'").get() as any;
      return {
        isFirstRun: !setting || setting.value !== '1',
        shopName: shop?.value || '',
      };
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
        default_invoice_layout: z.enum(['80mm', 'a4']).default('80mm'),
        owner_password: z.string().min(4).optional().nullable(),
      });
  
      const data = schema.parse(rawPayload);
      const now = new Date().toISOString();

      // The owner account is seeded as owner/owner123 and that password was
      // published in the console on every start, so leaving setup with it still
      // in place hands the shop to anyone who has read the README. Enforced here
      // rather than in the form alone, since the form is not the only caller.
      const isFirstRun = already?.value !== '1';
      if (isFirstRun) {
        const chosen = (data.owner_password || '').trim();
        if (!chosen) {
          throw new Error('Set a password for the owner account before finishing setup.');
        }
        if (chosen.length < 6) {
          throw new Error('The owner password must be at least 6 characters.');
        }
        if (chosen === 'owner123') {
          throw new Error('Choose a different owner password - the default one cannot be kept.');
        }
        data.owner_password = chosen;
      }
  
      // Issued as part of setup rather than left for the owner to find later:
      // the moment they are told to pick a password is the moment to tell them
      // what happens if they forget it.
      const recoveryCodes = isFirstRun ? generateRecoveryCodes() : null;

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

        if (recoveryCodes) {
          storeRecoveryCodes(db, recoveryCodes);
        }
      })();
  
      logAudit('FIRST_RUN_WIZARD_COMPLETED', 'settings', undefined, { shopName: data.shop_name });
      return { success: true, recoveryCodes };
    });

}
