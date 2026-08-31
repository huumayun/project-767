import { getSyncStatus, executeDeltaSync } from '../../services/syncEngine';
import { encryptSecret, decryptSecret } from '../../services/safeStore';

import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerSyncHandlers() {
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

}
