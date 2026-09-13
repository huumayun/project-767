import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit, requireOpenShift } from '../shared';


export function registerSuppliersHandlers() {
  // --- SUPPLIERS & PURCHASES HANDLERS ---
  ipcMain.handle('api:suppliers:list', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      return db.prepare('SELECT * FROM suppliers WHERE deleted_at IS NULL ORDER BY name ASC').all();
    });

  ipcMain.handle('api:suppliers:create', async (_event, rawData) => {
      requireRole(['owner']);
      const schema = z.object({
        name: z.string().min(1),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        contact_person: z.string().optional().nullable(),
        opening_balance_taka: z.number().min(0).optional().default(0),
        payment_terms_days: z.number().int().min(0).max(365).optional().nullable(),
        note: z.string().optional().nullable(),
      });
      const data = schema.parse(rawData);
      const db = getDb();
      const id = uuidv7();
      const now = new Date().toISOString();
      // Whatever was already owed before the software started is the opening
      // payable, otherwise the ledger begins from a balance that is not true.
      const openingPaisa = Math.round((data.opening_balance_taka || 0) * 100);
  
      db.prepare(`
        INSERT INTO suppliers (
          id, name, phone, address, contact_person, opening_balance_paisa,
          payment_terms_days, note, total_payable_paisa, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, data.name.trim(), data.phone?.trim() || null, data.address?.trim() || null,
        data.contact_person?.trim() || null, openingPaisa,
        data.payment_terms_days ?? null, data.note?.trim() || null,
        openingPaisa, now, now
      );
  
      logAudit('CREATE_SUPPLIER', 'suppliers', id, { name: data.name });
      return { id, ...data };
    });

  ipcMain.handle('api:suppliers:update', async (_event, rawData) => {
      requireRole(['owner']);
      const schema = z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        contact_person: z.string().optional().nullable(),
        opening_balance_taka: z.number().min(0).optional().default(0),
        payment_terms_days: z.number().int().min(0).max(365).optional().nullable(),
        note: z.string().optional().nullable(),
      });
      const data = schema.parse(rawData);
      const db = getDb();
      const now = new Date().toISOString();
  
      const existing = db.prepare(
        'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
      ).get(data.id) as any;
      if (!existing) throw new Error('Supplier not found or already deleted.');
  
      // Correcting the opening balance has to move the live payable by the same
      // amount, otherwise the ledger opens from one figure and totals another.
      const newOpeningPaisa = Math.round((data.opening_balance_taka || 0) * 100);
      const openingDeltaPaisa = newOpeningPaisa - (existing.opening_balance_paisa || 0);
      const newPayablePaisa = (existing.total_payable_paisa || 0) + openingDeltaPaisa;
      if (newPayablePaisa < 0) {
        throw new Error(
          `That opening balance is too low \u2014 it would push the payable below zero. Lowest allowed is \u09f3 ${(
            (newOpeningPaisa - newPayablePaisa) / 100
          ).toFixed(2)}.`
        );
      }
  
      db.prepare(`
        UPDATE suppliers SET
          name = ?, phone = ?, address = ?, contact_person = ?,
          opening_balance_paisa = ?, payment_terms_days = ?, note = ?,
          total_payable_paisa = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `).run(
        data.name.trim(), data.phone?.trim() || null, data.address?.trim() || null,
        data.contact_person?.trim() || null, newOpeningPaisa,
        data.payment_terms_days ?? null, data.note?.trim() || null,
        newPayablePaisa, now, data.id
      );
  
      logAudit('UPDATE_SUPPLIER', 'suppliers', data.id, {
        name: data.name,
        openingDeltaPaisa,
        previousPayablePaisa: existing.total_payable_paisa || 0,
        newPayablePaisa,
      });
      return { success: true };
    });

  ipcMain.handle('api:suppliers:delete', async (_event, rawId) => {
      requireRole(['owner']);
      const id = z.string().min(1).parse(rawId);
      const db = getDb();
  
      const supplier = db.prepare(
        'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
      ).get(id) as any;
      if (!supplier) throw new Error('Supplier not found or already deleted.');
  
      // Money still owed is the one thing a delete must never hide.
      if ((supplier.total_payable_paisa || 0) > 0) {
        throw new Error(
          `Cannot delete this supplier \u2014 \u09f3 ${(
            supplier.total_payable_paisa / 100
          ).toFixed(2)} is still payable. Settle the balance first.`
        );
      }
  
      const now = new Date().toISOString();
      db.prepare('UPDATE suppliers SET deleted_at = ?, updated_at = ? WHERE id = ?').run(now, now, id);
  
      logAudit('DELETE_SUPPLIER', 'suppliers', id, { name: supplier.name });
      return { success: true };
    });

  ipcMain.handle('api:suppliers:payDue', async (_event, rawPayload) => {
      requireRole(['owner']);
      requireOpenShift(getDb(), 'Paying a supplier');
      const schema = z.object({
        supplier_id: z.string().min(1),
        amount_taka: z.number().positive(),
        method: z.enum(['cash', 'bkash', 'nagad', 'card', 'other']).default('cash'),
        note: z.string().optional().nullable(),
      });
  
      const payload = schema.parse(rawPayload);
      const db = getDb();
      const now = new Date().toISOString();
      const userId = activeSession?.id || 'system';
      const deviceId = getDeviceId(db);
      const paymentId = uuidv7();
      const amountPaisa = Math.round(payload.amount_taka * 100);
  
      const supplier = db.prepare(
        'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
      ).get(payload.supplier_id) as any;
      if (!supplier) throw new Error('Supplier not found.');
  
      const previousPayablePaisa = supplier.total_payable_paisa || 0;
      if (amountPaisa > previousPayablePaisa) {
        throw new Error(
          `Payment is more than the outstanding payable (৳ ${(previousPayablePaisa / 100).toFixed(2)}).`
        );
      }
  
      db.transaction(() => {
        db.prepare(`
          INSERT INTO payments (
            id, supplier_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
          ) VALUES (?, ?, 'out', ?, ?, 'supplier_payment', ?, ?, ?, ?)
        `).run(paymentId, payload.supplier_id, payload.method, amountPaisa, userId, deviceId, now, now);
  
        db.prepare(
          'UPDATE suppliers SET total_payable_paisa = MAX(0, total_payable_paisa - ?), updated_at = ? WHERE id = ?'
        ).run(amountPaisa, now, payload.supplier_id);
      })();
  
      const remainingPayablePaisa = Math.max(0, previousPayablePaisa - amountPaisa);
  
      logAudit('PAY_SUPPLIER', 'payments', paymentId, {
        supplierId: payload.supplier_id,
        amountPaisa,
        previousPayablePaisa,
        remainingPayablePaisa,
        method: payload.method,
      });
  
      return { success: true, paymentId, remainingPayablePaisa };
    });

  ipcMain.handle('api:suppliers:getLedger', async (_event, rawId) => {
      requireRole(['owner']);
      const id = z.string().min(1).parse(rawId);
      const db = getDb();
  
      const supplier = db.prepare(
        'SELECT * FROM suppliers WHERE id = ? AND deleted_at IS NULL'
      ).get(id) as any;
      if (!supplier) throw new Error('Supplier not found.');
  
      const purchases = db.prepare(`
        SELECT id, invoice_ref, total_paisa, paid_paisa, transport_paisa,
               transport_on_invoice, note, created_at
        FROM purchases WHERE supplier_id = ? AND deleted_at IS NULL
      `).all(id) as any[];
  
      // Every payment to this vendor is a row here, including the amount settled
      // on the purchase itself. The purchase row therefore carries only the debit -
      // crediting its paid_paisa too would relieve the balance twice.
      const payments = db.prepare(`
        SELECT id, amount_paisa, method, created_at
        FROM payments
        WHERE supplier_id = ? AND direction = 'out' AND type = 'supplier_payment' AND deleted_at IS NULL
      `).all(id) as any[];
  
      // Purchases add to what is owed; payments (and anything settled on the
      // invoice itself) take away from it.
      const entries = [
        ...purchases.map((p) => ({
          id: p.id,
          kind: 'purchase' as const,
          created_at: p.created_at,
          label: p.invoice_ref ? `Purchase ${p.invoice_ref}` : 'Purchase invoice',
          note: p.note || null,
          debit_paisa: p.total_paisa,
          credit_paisa: 0,
          paid_on_invoice_paisa: p.paid_paisa,
          // Only a fare the vendor actually billed belongs on their ledger row;
          // one the shop paid the driver is stock cost, not vendor money.
          transport_paisa: p.transport_on_invoice ? (p.transport_paisa || 0) : 0,
        })),
        ...payments.map((p) => ({
          id: p.id,
          kind: 'payment' as const,
          created_at: p.created_at,
          label: `Payment (${p.method})`,
          note: null,
          debit_paisa: 0,
          credit_paisa: p.amount_paisa,
          paid_on_invoice_paisa: 0,
          transport_paisa: 0,
        })),
      ].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  
      let balance = supplier.opening_balance_paisa || 0;
      const rows = entries.map((e) => {
        balance += e.debit_paisa - e.credit_paisa;
        return { ...e, balance_paisa: balance };
      });
  
      return {
        supplier,
        opening_balance_paisa: supplier.opening_balance_paisa || 0,
        rows,
        closing_balance_paisa: balance,
      };
    });

}
