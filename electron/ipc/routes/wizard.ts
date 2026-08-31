import bcrypt from 'bcryptjs';
import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerWizardHandlers() {
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

}
