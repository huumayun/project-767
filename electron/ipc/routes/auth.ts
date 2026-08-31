let failedAttemptsMap: Record<string, any> = {};

import bcrypt from 'bcryptjs';
import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerAuthHandlers() {
  // Auth Handlers
  ipcMain.handle('api:auth:login', async (_event, rawArgs) => {
      const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      });
      const { username, password } = schema.parse(rawArgs);
  
      const now = Date.now();
      const attempt = failedAttemptsMap[username] || { count: 0, lockedUntil: 0 };
      if (attempt.lockedUntil > now) {
        const waitSec = Math.ceil((attempt.lockedUntil - now) / 1000);
        throw new Error(`Account locked due to multiple failed attempts. Retry in ${waitSec}s.`);
      }
  
      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1 AND deleted_at IS NULL').get(username) as any;
  
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        attempt.count += 1;
        if (attempt.count >= 5) {
          attempt.lockedUntil = now + 30000; // 30s lockout
        }
        failedAttemptsMap[username] = attempt;
        logAudit('LOGIN_FAILED', 'users', undefined, { username, reason: 'Invalid credentials' });
        return { success: false, error: 'Invalid username or password' };
      }
  
      delete failedAttemptsMap[username];
  
      setActiveSession({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        has_pin: !!user.pin_code,
        loginTime: now,
      });
  
      logAudit('LOGIN_SUCCESS', 'users', user.id, { username });
  
      return {
        success: true,
        session: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          has_pin: !!user.pin_code,
        },
      };
    });

  // Quick Auto PIN Login (matches PIN across active users and logs in immediately)
  ipcMain.handle('api:auth:pinLogin', async (_event, rawArgs) => {
      const schema = z.object({
        pin: z.string().min(4).max(6),
      });
      const { pin } = schema.parse(rawArgs);
  
      const now = Date.now();
      const db = getDb();
  
      // Check across all active users
      const users = db.prepare('SELECT * FROM users WHERE pin_code = ? AND is_active = 1 AND deleted_at IS NULL').all(pin) as any[];
  
      if (users.length === 0) {
        logAudit('PIN_LOGIN_FAILED', 'users', undefined, { reason: 'Invalid PIN' });
        return { success: false, error: 'Invalid PIN. Please try again.' };
      }
  
      const user = users[0];
  
      setActiveSession({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        has_pin: !!user.pin_code,
        loginTime: now,
      });
  
      logAudit('PIN_LOGIN_SUCCESS', 'users', user.id, { username: user.username, name: user.name });
  
      return {
        success: true,
        session: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          has_pin: !!user.pin_code,
        },
      };
    });

  ipcMain.handle('api:auth:logout', async () => {
      if (activeSession) {
        logAudit('LOGOUT', 'users', activeSession.id);
      }
      setActiveSession(null);
      return true;
    });

  ipcMain.handle('api:auth:getSession', async () => {
      if (!activeSession) return null;
      return {
        id: activeSession.id,
        username: activeSession.username,
        name: activeSession.name,
        role: activeSession.role,
        has_pin: activeSession.has_pin,
      };
    });

}
