import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit , calculateShiftSummary } from '../shared';
import { createDatabaseBackup } from '../../services/backupManager';

export function registerShiftsHandlers() {
  // Get current active shift for logged-in user
  ipcMain.handle('api:shifts:getCurrent', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      const userId = activeSession!.id;
  
      const openShift = db.prepare(`
        SELECT * FROM shifts
        WHERE status = 'open'
        ORDER BY opened_at DESC LIMIT 1
      `).get() as any;
  
      if (!openShift) return null;
  
      return calculateShiftSummary(db, openShift);
    });

  // Check if ANY shift is currently open
  ipcMain.handle('api:shifts:hasAnyOpen', async () => {
      requireRole(['owner']);
      const db = getDb();
      const openShift = db.prepare(`SELECT id FROM shifts WHERE status = 'open' LIMIT 1`).get();
      return !!openShift;
    });

  // Get last closed shift leftover float
  ipcMain.handle('api:shifts:getLastClosedFloat', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      const lastClosed = db.prepare(`
        SELECT closing_float_left_paisa, closed_at FROM shifts
        WHERE status = 'closed'
        ORDER BY closed_at DESC LIMIT 1
      `).get() as any;
  
      if (!lastClosed) return null;
      return { float_paisa: lastClosed.closing_float_left_paisa ?? 0 };
    });

  // Open a new shift
  ipcMain.handle('api:shifts:open', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        opening_cash_paisa: z.number().min(0).default(0),
        note: z.string().optional(),
      });
      const { opening_cash_paisa, note } = schema.parse(rawArgs || {});
      const db = getDb();
      const userId = activeSession!.id;
      const deviceId = getDeviceId(db);
  
      // Check if shift is already open
      const existing = db.prepare(`
        SELECT * FROM shifts
        WHERE status = 'open'
      `).get() as any;
  
      if (existing) {
        return calculateShiftSummary(db, existing);
      }
  
      const shiftId = uuidv7();
      const now = new Date().toISOString();
  
      db.prepare(`
        INSERT INTO shifts (
          id, user_id, device_id, status, opened_at, opening_cash_paisa,
          expected_cash_paisa, closing_cash_withdrawn_paisa, closing_float_left_paisa,
          total_sales_paisa, total_cash_sales_paisa,
          total_bkash_sales_paisa, total_nagad_sales_paisa, total_card_sales_paisa,
          total_cash_in_paisa, total_cash_out_paisa, note, created_at, updated_at
        ) VALUES (?, ?, ?, 'open', ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?)
      `).run(shiftId, userId, deviceId, now, opening_cash_paisa, opening_cash_paisa, note || null, now, now);
  
      logAudit('SHIFT_OPENED', 'shifts', shiftId, { opening_cash_paisa, user_id: userId });
  
      const newShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as any;
      return calculateShiftSummary(db, newShift);
    });

  // Add petty cash transaction (Cash In / Cash Out)
  ipcMain.handle('api:shifts:addCashTx', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        shift_id: z.string().min(1),
        type: z.enum(['cash_in', 'cash_out']),
        amount_paisa: z.number().positive(),
        reason: z.string().min(1),
      });
      const { shift_id, type, amount_paisa, reason } = schema.parse(rawArgs);
      const db = getDb();
      const userId = activeSession!.id;
      const deviceId = getDeviceId(db);
      const now = new Date().toISOString();
      const txId = uuidv7();
  
      db.prepare(`
        INSERT INTO shift_cash_transactions (
          id, shift_id, type, amount_paisa, reason, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(txId, shift_id, type, amount_paisa, reason.trim(), userId, deviceId, now, now);
  
      logAudit(type === 'cash_in' ? 'CASH_IN' : 'CASH_OUT', 'shifts', shift_id, { amount_paisa, reason });
  
      return { success: true };
    });

  // Get summary of specific shift
  ipcMain.handle('api:shifts:getSummary', async (_event, shiftId: string) => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as any;
      if (!shift) {
        throw new Error('Shift not found.');
      }
      return calculateShiftSummary(db, shift);
    });

  // Close shift and reconcile cash drawer
  ipcMain.handle('api:shifts:close', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        shift_id: z.string().min(1),
        actual_cash_paisa: z.number().min(0),
        cash_withdrawn_paisa: z.number().min(0).optional(),
        float_left_paisa: z.number().min(0).optional(),
        note: z.string().optional(),
      });
      const { shift_id, actual_cash_paisa, cash_withdrawn_paisa = 0, float_left_paisa, note } = schema.parse(rawArgs);
      const db = getDb();
      const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id) as any;
  
      if (!shift) {
        throw new Error('Shift not found.');
      }
  
      const summary = calculateShiftSummary(db, shift);
      const now = new Date().toISOString();
      const cashDiff = actual_cash_paisa - summary.expected_cash_paisa;
      const calculatedFloatLeft = float_left_paisa !== undefined ? float_left_paisa : Math.max(0, actual_cash_paisa - cash_withdrawn_paisa);
  
      db.prepare(`
        UPDATE shifts SET
          status = 'closed',
          closed_at = ?,
          expected_cash_paisa = ?,
          actual_cash_paisa = ?,
          cash_difference_paisa = ?,
          closing_cash_withdrawn_paisa = ?,
          closing_float_left_paisa = ?,
          total_sales_paisa = ?,
          total_cash_sales_paisa = ?,
          total_bkash_sales_paisa = ?,
          total_nagad_sales_paisa = ?,
          total_card_sales_paisa = ?,
          total_cash_in_paisa = ?,
          total_cash_out_paisa = ?,
          note = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        now,
        summary.expected_cash_paisa,
        actual_cash_paisa,
        cashDiff,
        cash_withdrawn_paisa,
        calculatedFloatLeft,
        summary.total_sales_paisa,
        summary.total_cash_sales_paisa,
        summary.total_bkash_sales_paisa,
        summary.total_nagad_sales_paisa,
        summary.total_card_sales_paisa,
        summary.total_cash_in_paisa,
        summary.total_cash_out_paisa,
        note || shift.note || null,
        now,
        shift_id
      );
  
      logAudit('SHIFT_CLOSED', 'shifts', shift_id, {
        expected_cash_paisa: summary.expected_cash_paisa,
        actual_cash_paisa,
        cash_difference_paisa: cashDiff,
        closing_cash_withdrawn_paisa: cash_withdrawn_paisa,
        closing_float_left_paisa: calculatedFloatLeft,
      });

      // Automatically trigger a backup after closing the shift
      try {
        createDatabaseBackup(undefined, true);
        console.log('Auto-backup created on shift close.');
      } catch (err) {
        console.error('Failed to create auto-backup on shift close:', err);
      }
  
      const updatedShift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id) as any;
      return calculateShiftSummary(db, updatedShift);
    });

  // Get past shifts history (Owner or Staff)
  ipcMain.handle('api:shifts:getHistory', async (_event, limitRaw) => {
      requireRole(['owner', 'staff']);
      const limit = typeof limitRaw === 'number' ? limitRaw : 50;
      const db = getDb();
  
      let rows: any[] = [];
      rows = db.prepare('SELECT * FROM shifts ORDER BY opened_at DESC LIMIT ?').all(limit);
  
      return rows.map((r) => calculateShiftSummary(db, r));
    });

}
