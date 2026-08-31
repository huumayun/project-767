import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerSettingsHandlers() {
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
        enable_shifts: map['enable_shifts'] !== '0',
        barcode_scanner_mode: map['barcode_scanner_mode'] || 'speed',
        barcode_scanner_prefix: map['barcode_scanner_prefix'] || '',
        supabase_url: map['supabase_url'] || '',
        supabase_anon_key: map['supabase_anon_key'] ? '********' : '',
        supabase_shop_id: map['supabase_shop_id'] || '',
      };
    });

  ipcMain.handle('api:settings:update', async (_event, rawData) => {
      requireRole(['owner']);
      // Accept any simple values, we'll convert them to string for storage
      const schema = z.record(z.any());
      const data = schema.parse(rawData);
      const db = getDb();
      const now = new Date().toISOString();
  
      const insertOrUpdate = db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
  
      db.transaction(() => {
        for (const [k, v] of Object.entries(data)) {
          // Convert true/false to '1'/'0', and other types to string
          const strVal = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
          insertOrUpdate.run(k, strVal, now);
        }
      })();
  
      logAudit('UPDATE_SETTINGS', 'settings', undefined, data);
      return { success: true };
    });

}
