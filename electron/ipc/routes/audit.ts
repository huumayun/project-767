import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerAuditHandlers() {
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

}
