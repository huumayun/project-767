import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit, requireOpenShift } from '../shared';


export function registerCustomersHandlers() {
  // --- CUSTOMERS & DUE HANDLERS ---
  ipcMain.handle('api:customers:list', async (_event, rawSearch) => {
      requireRole(['owner', 'staff']);
      const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
      const db = getDb();
  
      let sql = `
        SELECT 
          c.id, c.name, c.phone, c.address, c.note, c.created_at, c.updated_at,
          COALESCE(vd.total_sales_paisa, 0) AS total_sales_paisa,
          COALESCE(vd.total_paid_paisa, 0) AS total_paid_paisa,
          COALESCE(vd.due_paisa, 0) AS due_paisa
        FROM customers c
        LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
        WHERE c.deleted_at IS NULL
      `;
      const params: any[] = [];
  
      if (search) {
        sql += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)';
        const term = `%${search}%`;
        params.push(term, term, term);
      }
  
      sql += ' ORDER BY vd.due_paisa DESC, c.name ASC';
      return db.prepare(sql).all(...params);
    });

  ipcMain.handle('api:customers:getById', async (_event, rawId) => {
      requireRole(['owner', 'staff']);
      const id = z.string().min(1).parse(rawId);
      const db = getDb();
  
      return db.prepare(`
        SELECT 
          c.id, c.name, c.phone, c.address, c.note, c.created_at, c.updated_at,
          COALESCE(vd.total_sales_paisa, 0) AS total_sales_paisa,
          COALESCE(vd.total_paid_paisa, 0) AS total_paid_paisa,
          COALESCE(vd.due_paisa, 0) AS due_paisa
        FROM customers c
        LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
        WHERE c.id = ? AND c.deleted_at IS NULL
      `).get(id);
    });

  ipcMain.handle('api:customers:create', async (_event, rawData) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        name: z.string().min(1),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      });
      const data = schema.parse(rawData);
      const db = getDb();
      const id = uuidv7();
      const now = new Date().toISOString();
      const deviceId = getDeviceId(db);
  
      db.prepare(`
        INSERT INTO customers (id, name, phone, address, note, device_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, data.name.trim(), data.phone?.trim() || null,
        data.address?.trim() || null, data.note?.trim() || null,
        deviceId, now, now
      );
  
      logAudit('CREATE_CUSTOMER', 'customers', id, { name: data.name, phone: data.phone });
      return {
        id,
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        note: data.note?.trim() || null,
        total_sales_paisa: 0,
        total_paid_paisa: 0,
        due_paisa: 0,
        created_at: now,
        updated_at: now,
      };
    });

  ipcMain.handle('api:customers:update', async (_event, rawData) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        phone: z.string().optional().nullable(),
        address: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      });
      const data = schema.parse(rawData);
      const db = getDb();
      const now = new Date().toISOString();
  
      const res = db.prepare(`
        UPDATE customers SET
          name = ?, phone = ?, address = ?, note = ?, updated_at = ?
        WHERE id = ? AND deleted_at IS NULL
      `).run(
        data.name.trim(), data.phone?.trim() || null,
        data.address?.trim() || null, data.note?.trim() || null,
        now, data.id
      );
  
      if (res.changes === 0) {
        throw new Error('Customer not found or already deleted.');
      }
  
      logAudit('UPDATE_CUSTOMER', 'customers', data.id, { name: data.name });
      return { success: true };
    });

  ipcMain.handle('api:customers:delete', async (_event, rawId) => {
      requireRole(['owner']);
      const id = z.string().min(1).parse(rawId);
      const db = getDb();
  
      const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(id) as any;
      if (dueRow && dueRow.due_paisa > 0) {
        throw new Error(`Cannot delete customer. Account has an outstanding due balance of ৳ ${(dueRow.due_paisa / 100).toFixed(2)}. Settle due before deleting.`);
      }
  
      const now = new Date().toISOString();
      const res = db.prepare('UPDATE customers SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL').run(now, now, id);
      if (res.changes === 0) {
        throw new Error('Customer not found or already deleted.');
      }
  
      logAudit('DELETE_CUSTOMER', 'customers', id);
      return { success: true };
    });

  ipcMain.handle('api:customers:collectDue', async (_event, rawPayload) => {
      requireRole(['owner', 'staff']);
      requireOpenShift(getDb(), 'Collecting a due');
      const schema = z.object({
        customer_id: z.string().min(1),
        amount_taka: z.number().positive(),
        method: z.enum(['cash', 'bkash', 'nagad', 'card', 'other']).default('cash'),
        trx_id: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      });
  
      const payload = schema.parse(rawPayload);
      const db = getDb();
      const now = new Date().toISOString();
      const userId = activeSession?.id || 'system';
      const deviceId = getDeviceId(db);
      const paymentId = uuidv7();
      const amountPaisa = Math.round(payload.amount_taka * 100);
  
      const customer = db.prepare(`
        SELECT c.*, COALESCE(vd.due_paisa, 0) as due_paisa
        FROM customers c
        LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
        WHERE c.id = ? AND c.deleted_at IS NULL
      `).get(payload.customer_id) as any;
  
      if (!customer) throw new Error('Customer not found.');
  
      const previousDuePaisa = customer.due_paisa || 0;
  
      db.transaction(() => {
        db.prepare(`
          INSERT INTO payments (
            id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
          ) VALUES (?, ?, 'in', ?, ?, 'due_collection', ?, ?, ?, ?)
        `).run(paymentId, payload.customer_id, payload.method, amountPaisa, userId, deviceId, now, now);
      })();
  
      const remainingDuePaisa = Math.max(0, previousDuePaisa - amountPaisa);
  
      logAudit('COLLECT_DUE', 'payments', paymentId, {
        customerId: payload.customer_id,
        amountPaisa,
        previousDuePaisa,
        remainingDuePaisa,
        method: payload.method,
        trxId: payload.trx_id,
      });
  
      return {
        success: true,
        payment_id: paymentId,
        customer_name: customer.name,
        amount_paisa: amountPaisa,
        previous_due_paisa: previousDuePaisa,
        remaining_due_paisa: remainingDuePaisa,
        date: now,
      };
    });

  ipcMain.handle('api:customers:getHistory', async (_event, rawCustomerId) => {
      requireRole(['owner', 'staff']);
      const customerId = z.string().min(1).parse(rawCustomerId);
      const db = getDb();

      /*
       * The statement has to close on the same figure v_customer_due reports,
       * or the header of the modal and the last line of its table disagree and
       * neither can be trusted.
       *
       * v_customer_due is:  (sales - returns) - (payments in - payments out)
       *
       * so all four terms have to appear here. Two of them did not: returns
       * were missing entirely, and the payments query filtered direction='in',
       * which dropped every refund. A customer who had returned goods saw a
       * statement whose running balance drifted from their real due, with
       * nothing on it to explain the gap.
       */
      const sales = db.prepare(`
        SELECT id, invoice_no as ref_no, total_paisa, created_at
        FROM sales
        WHERE customer_id = ? AND deleted_at IS NULL AND status != 'held'
      `).all(customerId) as any[];

      const returns = db.prepare(`
        SELECT ri.id, s.invoice_no as ref_no, ri.amount_paisa, r.created_at
        FROM returns r
        JOIN return_items ri ON ri.return_id = r.id
        JOIN sales s ON s.id = r.sale_id
        WHERE s.customer_id = ? AND ri.deleted_at IS NULL AND s.deleted_at IS NULL
      `).all(customerId) as any[];

      const payments = db.prepare(`
        SELECT p.id, p.type, p.method, p.amount_paisa, p.created_at, p.sale_id, p.direction,
               s.invoice_no
        FROM payments p
        LEFT JOIN sales s ON s.id = p.sale_id
        WHERE p.customer_id = ? AND p.deleted_at IS NULL
      `).all(customerId) as any[];

      const history: Array<{
        id: string;
        type: 'sale' | 'payment' | 'return' | 'refund';
        date: string;
        ref_no: string;
        description: string;
        method?: string | null;
        debit_paisa: number;
        credit_paisa: number;
        running_balance_paisa?: number;
        /** Ties rows sharing a timestamp into a readable order. */
        seq?: number;
      }> = [];

      sales.forEach(s => {
        history.push({
          id: s.id,
          type: 'sale',
          date: s.created_at,
          ref_no: s.ref_no,
          description: `Invoice ${s.ref_no}`,
          debit_paisa: s.total_paisa,
          credit_paisa: 0,
          seq: 0,
        });
      });

      // Goods came back, so the customer owes less.
      returns.forEach(r => {
        history.push({
          id: r.id,
          type: 'return',
          date: r.created_at,
          ref_no: r.ref_no,
          description: `Return / credit note on ${r.ref_no}`,
          debit_paisa: 0,
          credit_paisa: r.amount_paisa,
          seq: 1,
        });
      });

      /*
       * A reference someone can act on.
       *
       * Every payment row used to print a slice of its own uuid - "01A0848A" -
       * which matches nothing on any bill, receipt or screen. Cash taken at the
       * counter belongs to the invoice it settled, so it carries that invoice
       * number and sits directly under it; money collected against the balance
       * later belongs to no single bill, so it gets a receipt reference of its
       * own, marked as one.
       */
      const paymentRef = (p: any) =>
        p.invoice_no || `RCPT-${String(p.id).slice(0, 8).toUpperCase()}`;
      const against = (p: any) => (p.invoice_no ? ` against ${p.invoice_no}` : '');

      payments.forEach(p => {
        if (p.direction === 'out') {
          // Cash handed back over the counter. It leaves the drawer, so it
          // raises the balance again exactly as v_customer_due does.
          history.push({
            id: p.id,
            type: 'refund',
            date: p.created_at,
            ref_no: paymentRef(p),
            description: `Refund paid out (${String(p.method).toUpperCase()})${against(p)}`,
            method: p.method,
            debit_paisa: p.amount_paisa,
            credit_paisa: 0,
            seq: 3,
          });
          return;
        }

        const desc =
          p.type === 'due_collection'
            ? 'Due / baki collection'
            : 'Payment received at counter';
        history.push({
          id: p.id,
          type: 'payment',
          date: p.created_at,
          ref_no: paymentRef(p),
          description: `${desc} (${String(p.method).toUpperCase()})${against(p)}`,
          method: p.method,
          debit_paisa: 0,
          credit_paisa: p.amount_paisa,
          seq: 2,
        });
      });

      /*
       * Oldest first, and a sale ahead of the payment that settles it.
       *
       * A POS sale and its payment are written in the same statement and carry
       * the identical created_at, so ordering on the timestamp alone left their
       * order to chance - a statement could show the money before the bill it
       * paid. `seq` fixes that: invoice, then credit note, then payment, then
       * refund.
       */
      history.sort((a, b) => {
        const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
        return byDate !== 0 ? byDate : (a.seq || 0) - (b.seq || 0);
      });

      let runningBalance = 0;
      history.forEach(item => {
        runningBalance += (item.debit_paisa - item.credit_paisa);
        item.running_balance_paisa = runningBalance;
      });

      /*
       * Returned oldest first, and NOT reversed.
       *
       * A running balance only reads in the direction it accumulates. Newest
       * first, the column ran 100, 150, 100, 200 down the page - every figure
       * correct as of its own row, and the whole column nonsense to read, with
       * an old 200 sitting at the bottom next to a header saying 100 was due.
       * Oldest first, the last line is the closing balance and matches it.
       */
      return history;
    });

  ipcMain.handle('api:customers:getDueSummary', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
  
      const rows = db.prepare(`
        SELECT 
          c.id, c.name, c.phone, c.address,
          COALESCE(vd.total_sales_paisa, 0) as total_sales_paisa,
          COALESCE(vd.total_paid_paisa, 0) as total_paid_paisa,
          COALESCE(vd.due_paisa, 0) as due_paisa
        FROM customers c
        LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
        WHERE c.deleted_at IS NULL
      `).all() as any[];
  
      let totalDuePaisa = 0;
      let customersWithDueCount = 0;
      const dueCustomers: any[] = [];
  
      rows.forEach(r => {
        if (r.due_paisa > 0) {
          totalDuePaisa += r.due_paisa;
          customersWithDueCount++;
          dueCustomers.push(r);
        }
      });
  
      dueCustomers.sort((a, b) => b.due_paisa - a.due_paisa);
  
      return {
        total_due_paisa: totalDuePaisa,
        total_customers_count: rows.length,
        customers_with_due_count: customersWithDueCount,
        top_due_customers: dueCustomers.slice(0, 5),
      };
    });

}
