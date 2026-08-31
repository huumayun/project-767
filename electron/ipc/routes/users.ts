import bcrypt from 'bcryptjs';
import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerUsersHandlers() {
  // Users Management Handlers
  ipcMain.handle('api:users:list', async (_event, filters?: { startDate?: string; endDate?: string }) => {
      requireRole(['owner']);
      const db = getDb();
      const users = db.prepare('SELECT id, username, name, role, is_active, pin_code, device_id, created_at, updated_at FROM users WHERE deleted_at IS NULL ORDER BY name ASC').all() as any[];
  
      if (filters && (filters.startDate || filters.endDate)) {
        let sql = `SELECT user_id, SUM(total_paisa) as total_sales_paisa FROM sales WHERE status = 'completed' AND deleted_at IS NULL`;
        const params: any[] = [];
        if (filters.startDate) {
          sql += ` AND created_at >= ?`;
          params.push(filters.startDate + 'T00:00:00.000Z');
        }
        if (filters.endDate) {
          sql += ` AND created_at <= ?`;
          params.push(filters.endDate + 'T23:59:59.999Z');
        }
        sql += ` GROUP BY user_id`;
        const salesData = db.prepare(sql).all(...params) as any[];
        const salesMap = new Map(salesData.map(s => [s.user_id, s.total_sales_paisa]));
        
        for (const u of users) {
          u.total_sales_paisa = salesMap.get(u.id) || 0;
        }
      } else {
        for (const u of users) {
          u.total_sales_paisa = 0;
        }
      }
  
      return users;
    });

  ipcMain.handle('api:users:create', async (_event, rawData) => {
      requireRole(['owner']);
      const schema = z.object({
        username: z.string().min(3),
        name: z.string().min(1),
        role: z.enum(['owner', 'staff']),
        password: z.string().min(4),
        pin_code: z.string().min(4).max(6).optional(),
      });
      const data = schema.parse(rawData);
      const db = getDb();
  
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND deleted_at IS NULL').get(data.username);
      if (existing) {
        throw new Error(`Username "${data.username}" is already taken.`);
      }
  
      if (data.pin_code) {
        const existingPin = db.prepare('SELECT username FROM users WHERE pin_code = ? AND is_active = 1 AND deleted_at IS NULL').get(data.pin_code) as any;
        if (existingPin) {
          throw new Error(`PIN "${data.pin_code}" is already assigned to user "${existingPin.username}". Choose a unique PIN.`);
        }
      }
  
      const salt = bcrypt.genSaltSync(12);
      const passwordHash = bcrypt.hashSync(data.password, salt);
      const id = uuidv7();
      const now = new Date().toISOString();
      const deviceId = getDeviceId(db);
  
      db.prepare(`
        INSERT INTO users (id, name, username, role, password_hash, pin_code, is_active, device_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(id, data.name.trim(), data.username.trim(), data.role, passwordHash, data.pin_code || null, deviceId, now, now);
  
      logAudit('CREATE_USER', 'users', id, { username: data.username, role: data.role });
      return {
        id,
        name: data.name.trim(),
        username: data.username.trim(),
        role: data.role,
        pin_code: data.pin_code || null,
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
        pin_code: z.string().min(4).max(6).optional(),
      });
      const data = schema.parse(rawData);
      const db = getDb();
      const now = new Date().toISOString();
  
      if (data.pin_code) {
        const existingPin = db.prepare('SELECT username FROM users WHERE pin_code = ? AND id != ? AND is_active = 1 AND deleted_at IS NULL').get(data.pin_code, data.id) as any;
        if (existingPin) {
          throw new Error(`PIN "${data.pin_code}" is already assigned to user "${existingPin.username}".`);
        }
      }
  
      db.prepare(`
        UPDATE users SET name = ?, role = ?, is_active = ?, pin_code = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `).run(data.name.trim(), data.role, data.is_active ? 1 : 0, data.pin_code || null, now, data.id);
  
      logAudit('UPDATE_USER', 'users', data.id, { name: data.name, role: data.role, is_active: data.is_active });
      return { success: true };
    });

  ipcMain.handle('api:users:updatePin', async (_event, rawData) => {
      const schema = z.object({
        userId: z.string().min(1),
        pin_code: z.string().min(4).max(6),
      });
      const { userId, pin_code } = schema.parse(rawData);
  
      if (!activeSession) {
        throw new Error('Unauthorized');
      }
      if (activeSession.role !== 'owner' && activeSession.id !== userId) {
        throw new Error('Forbidden: You can only change your own PIN.');
      }
  
      const db = getDb();
      const existingPin = db.prepare('SELECT username FROM users WHERE pin_code = ? AND id != ? AND is_active = 1 AND deleted_at IS NULL').get(pin_code, userId) as any;
      if (existingPin) {
        throw new Error(`PIN "${pin_code}" is already taken by ${existingPin.username}. Choose a unique PIN.`);
      }
  
      const now = new Date().toISOString();
      db.prepare('UPDATE users SET pin_code = ?, updated_at = ? WHERE id = ?').run(pin_code, now, userId);
      logAudit('UPDATE_PIN', 'users', userId);
      return { success: true };
    });

  ipcMain.handle('api:users:pinLogin', async (_event, pin_code: string) => {
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE pin_code = ? AND is_active = 1 AND deleted_at IS NULL').get(pin_code) as any;
      
      if (!user) {
        throw new Error('Invalid PIN');
      }
  
      return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      };
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

}
