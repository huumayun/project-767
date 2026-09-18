let failedAttemptsMap: Record<string, any> = {};

/**
 * One doubling lockout, shared by every way into the app.
 *
 * A PIN is four to six digits - ten thousand possibilities at the short end -
 * and it opens a full session, owner included. The lockout doubles with each
 * further run of failures rather than staying at 30s, which turns an exhaustive
 * search from hours into years while a cashier who fat-fingers their PIN twice
 * is barely delayed.
 *
 * Password login used to keep its own counter, and that counter never doubled:
 * once past five failures it re-armed the same 30 seconds however long the
 * guessing went on, so a password could be worked through at a steady 10 tries
 * a minute for ever. It was the cheapest door of the three, and it is the one
 * that opens the owner account by name.
 */
const PIN_ATTEMPT_KEY = '__pin__';
/** The recovery code shares the same doubling lockout, on its own counter. */
const RECOVERY_ATTEMPT_KEY = '__recovery__';
const FAILURES_BEFORE_LOCKOUT = 5;
const BASE_LOCKOUT_MS = 30000;
const MAX_LOCKOUT_MS = 15 * 60000;

function lockoutRemainingMs(key: string, now: number): number {
  const attempt = failedAttemptsMap[key];
  if (!attempt || !attempt.lockedUntil) return 0;
  return Math.max(0, attempt.lockedUntil - now);
}

function registerFailure(key: string, now: number) {
  const attempt = failedAttemptsMap[key] || { count: 0, lockedUntil: 0 };
  attempt.count += 1;
  if (attempt.count % FAILURES_BEFORE_LOCKOUT === 0) {
    const runs = Math.floor(attempt.count / FAILURES_BEFORE_LOCKOUT);
    attempt.lockedUntil = now + Math.min(BASE_LOCKOUT_MS * Math.pow(2, runs - 1), MAX_LOCKOUT_MS);
  }
  failedAttemptsMap[key] = attempt;
}

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
  findActiveUserByPin,
  recoveryCodeStatus,
  consumeRecoveryCode,
  recoveryOwner,
} from '../shared';


export function registerAuthHandlers() {
  // Auth Handlers

  ipcMain.handle('api:auth:verifyOwnerPassword', async (_event, rawArgs) => {
    requireRole(['owner']);
    if (!activeSession) return { success: false, error: 'Not logged in' };
    
    const schema = z.object({ password: z.string().min(1) });
    const { password } = schema.parse(rawArgs);
    const db = getDb();
    
    const user = db.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1 AND deleted_at IS NULL').get(activeSession.id) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return { success: false, error: 'Incorrect password' };
    }
    return { success: true };
  });

  ipcMain.handle('api:auth:login', async (_event, rawArgs) => {
      const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      });
      const { username, password } = schema.parse(rawArgs);
  
      const now = Date.now();
      const waitMs = lockoutRemainingMs(username, now);
      if (waitMs > 0) {
        const waitSec = Math.ceil(waitMs / 1000);
        throw new Error(`Account locked due to multiple failed attempts. Retry in ${waitSec}s.`);
      }

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1 AND deleted_at IS NULL').get(username) as any;

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        // The same doubling counter the PIN and recovery doors use, keyed per
        // username so one account's failures cannot lock another's out.
        registerFailure(username, now);
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
  
      const waitMs = lockoutRemainingMs(PIN_ATTEMPT_KEY, now);
      if (waitMs > 0) {
        const waitSec = Math.ceil(waitMs / 1000);
        logAudit('PIN_LOGIN_BLOCKED', 'users', undefined, { waitSec });
        throw new Error(`Too many incorrect PINs. Try again in ${waitSec}s, or sign in with a password.`);
      }

      // PINs are hashed, so they cannot be looked up with an equality match.
      const user = findActiveUserByPin(db, pin);

      if (!user) {
        registerFailure(PIN_ATTEMPT_KEY, now);
        logAudit('PIN_LOGIN_FAILED', 'users', undefined, { reason: 'Invalid PIN' });
        return { success: false, error: 'Invalid PIN. Please try again.' };
      }

      delete failedAttemptsMap[PIN_ATTEMPT_KEY];
  
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

  /**
   * Unauthenticated by necessity: the whole point is that nobody can log in.
   * It reveals only whether a code was ever set, so an owner who has none is
   * told to use the offline reset tool rather than hunting for a code that
   * does not exist.
   */
  ipcMain.handle('api:auth:recoveryAvailable', async () => {
      const status = recoveryCodeStatus(getDb());
      return { available: status.remaining > 0, remaining: status.remaining, total: status.total };
    });

  /**
   * Resets the owner password against one recovery code. Unauthenticated, and
   * throttled on the same doubling lockout as PIN login.
   *
   * A code is single use: the one that matched is marked spent and the rest of
   * the sheet keeps working. Otherwise a code read out over the phone once would
   * keep working forever.
   *
   * The owner's username is returned on success - forgetting it is as common as
   * forgetting the password, and by this point the caller has proven they hold
   * a code.
   */
  ipcMain.handle('api:auth:resetWithRecoveryCode', async (_event, rawArgs) => {
      const schema = z.object({
        code: z.string().min(1),
        newPassword: z.string().min(6),
      });
      const { code, newPassword } = schema.parse(rawArgs);

      const now = Date.now();
      const db = getDb();

      const waitMs = lockoutRemainingMs(RECOVERY_ATTEMPT_KEY, now);
      if (waitMs > 0) {
        const waitSec = Math.ceil(waitMs / 1000);
        logAudit('RECOVERY_BLOCKED', 'users', undefined, { waitSec });
        throw new Error(`Too many incorrect recovery codes. Try again in ${waitSec}s.`);
      }

      const before = recoveryCodeStatus(db);
      if (before.total === 0) {
        return { success: false, error: 'No recovery codes have been set up for this shop.' };
      }
      if (before.remaining === 0) {
        return { success: false, error: 'Every recovery code for this shop has already been used.' };
      }

      const owner = recoveryOwner(db);
      if (!owner) {
        return { success: false, error: 'No active owner account was found to reset.' };
      }

      const passwordHash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(12));
      const stamp = new Date().toISOString();

      // One transaction: a password changed without its code being spent would
      // leave that code usable again, and a code spent without the password
      // changing would burn it for nothing.
      let outcome = { ok: false, remaining: before.remaining };
      db.transaction(() => {
        outcome = consumeRecoveryCode(db, code);
        if (!outcome.ok) return;
        db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, stamp, owner.id);
      })();

      if (!outcome.ok) {
        registerFailure(RECOVERY_ATTEMPT_KEY, now);
        logAudit('RECOVERY_FAILED', 'users', undefined, { reason: 'Invalid recovery code' });
        return { success: false, error: 'That recovery code is not correct, or has already been used.' };
      }

      delete failedAttemptsMap[RECOVERY_ATTEMPT_KEY];
      delete failedAttemptsMap[owner.username];

      logAudit('RECOVERY_PASSWORD_RESET', 'users', owner.id, {
        username: owner.username,
        codesRemaining: outcome.remaining,
      });

      return { success: true, username: owner.username, codesRemaining: outcome.remaining };
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
