import { generateInvoicePdf, generateReturnInvoicePdf, InvoicePdfData } from '../../services/invoicePdf';
import { printOptionsFromSettings } from '../../services/invoicePrintOptions';

import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit, requireOpenShift, generateInvoiceNumber, generateReturnInvoiceNumber, isInvoiceNumberCollision, allocateSaleDiscount } from '../shared';

/** Every setting in one query - the invoice needs a dozen of them. */
function readSettingsMap(db: any): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  const map: Record<string, string> = {};
  rows.forEach((r) => { map[r.key] = r.value; });
  return map;
}


export function registerSalesHandlers() {
  // --- SALES & INVOICING HANDLERS ---
  ipcMain.handle('api:sales:create', async (_event, rawPayload) => {
      requireRole(['owner', 'staff']);
      requireOpenShift(getDb(), 'A sale');
      const schema = z.object({
        customer_id: z.string().optional().nullable(),
        subtotal_paisa: z.number().int().min(0),
        discount_paisa: z.number().int().min(0).default(0),
        total_paisa: z.number().int().min(0),
        items: z.array(z.object({
          product_id: z.string().min(1),
          qty: z.number().int().positive(),
          unit_price_paisa: z.number().int().min(0),
          discount_paisa: z.number().int().min(0).default(0),
          serial_number_id: z.string().optional().nullable(),
        })).min(1),
        payments: z.array(z.object({
          method: z.enum(['cash', 'bkash', 'nagad', 'card', 'other']),
          amount_paisa: z.number().int().min(0),
        })).min(1),
        previous_due_paid_paisa: z.number().int().min(0).optional().default(0),
        total_paid_paisa: z.number().int().min(0),
        change_paisa: z.number().int().min(0).default(0),
        layout: z.enum(['80mm', 'a4']).default('80mm'),
      });
  
      const payload = schema.parse(rawPayload);
      const db = getDb();
      const now = new Date().toISOString();
      const userId = activeSession?.id || 'system';
      const deviceId = getDeviceId(db);
  
      if (activeSession?.role === 'staff') {
        const maxAllowedDiscount = Math.round(payload.subtotal_paisa * 0.10);
        if (payload.discount_paisa > maxAllowedDiscount) {
          throw new Error(`Discount of ৳${(payload.discount_paisa / 100).toFixed(2)} exceeds staff authorization limit (max 10%). Owner approval required.`);
        }
      }
  
      const saleId = uuidv7();
      // Assigned inside the transaction below, where the number it reads cannot
      // be taken by anyone else before this sale is written.
      let invoiceNo = '';

      let customerInfo: any = null;
      let customerPreviousDuePaisa = 0;
      if (payload.customer_id) {
        customerInfo = db.prepare('SELECT name, phone, address FROM customers WHERE id = ?').get(payload.customer_id);
        const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(payload.customer_id) as any;
        if (dueRow) customerPreviousDuePaisa = dueRow.due_paisa;
      }
  
      const totalCollected = payload.payments.reduce((sum, p) => sum + (p.amount_paisa || 0), 0);
      const netCollected = payload.change_paisa > 0 ? Math.max(0, totalCollected - payload.change_paisa) : totalCollected;
      const remainingDue = Math.max(0, payload.total_paisa - netCollected);
  
      if (remainingDue > 0 && !payload.customer_id) {
        throw new Error('A walk-in customer cannot be sold on credit. Select a customer to record a due.');
      }

      /*
       * The payment rows written below are what a customer's balance is built
       * from; total_paid_paisa is what the invoice prints as collected. When a
       * till sent one and booked the other, the receipt and the ledger
       * disagreed - a part-paid credit sale posted a single zero payment and
       * billed the customer the whole amount while the cash sat in the drawer.
       *
       * Refusing the sale is loud, and better than a quiet mis-billing that
       * nobody notices until the customer argues about their balance.
       */
      if (payload.total_paid_paisa !== totalCollected) {
        throw new Error(
          `Payment mismatch: this sale reports ৳ ${(payload.total_paid_paisa / 100).toFixed(2)} collected, ` +
            `but its payment lines add up to ৳ ${(totalCollected / 100).toFixed(2)}. Nothing has been saved.`
        );
      }
  
      const invoiceItems: any[] = [];

      const writeSale = db.transaction(() => {
        /*
         * Numbered here rather than before the transaction opened.
         *
         * The number is read as "highest so far, plus one", and that read used
         * to happen outside any transaction - so two sales rung up in the same
         * moment both read the same highest number and both tried to write it.
         * One of them hit UNIQUE(invoice_no) and the cashier was shown a
         * constraint error for a sale that was perfectly good.
         */
        invoiceNo = generateInvoiceNumber(db);

        // 1. Insert Sales Record
        db.prepare(`
          INSERT INTO sales (
            id, invoice_no, status, customer_id, subtotal_paisa, discount_paisa, total_paisa,
            user_id, device_id, created_at, updated_at
          ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          saleId, invoiceNo, payload.customer_id || null, payload.subtotal_paisa,
          payload.discount_paisa, payload.total_paisa, userId, deviceId, now, now
        );
  
        // 2. Decrement Stock with Race-Safe Condition & Insert Sale Items
        const updateStockStmt = db.prepare(`
          UPDATE products 
          SET stock_qty = stock_qty - ?, updated_at = ? 
          WHERE id = ? AND stock_qty >= ?
        `);
        const insertItemStmt = db.prepare(`
          INSERT INTO sale_items (
            id, sale_id, product_id, qty, unit_price_paisa, discount_paisa, serial_number_id,
            unit_cost_paisa, device_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertStockTxStmt = db.prepare(`
          INSERT INTO stock_transactions (
            id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, device_id, created_at, updated_at
          ) VALUES (?, ?, 'sale', ?, 'sales', ?, ?, ?, ?, ?, ?)
        `);
  
        for (const item of payload.items) {
          const product = db.prepare('SELECT name, name_bn, stock_qty, cost_price_paisa FROM products WHERE id = ? AND deleted_at IS NULL').get(item.product_id) as any;
          if (!product) {
            throw new Error(`Product ${item.product_id} not found.`);
          }
  
          const res = updateStockStmt.run(item.qty, now, item.product_id, item.qty);
          if (res.changes === 0) {
            throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stock_qty}, Requested: ${item.qty}`);
          }
  
          const saleItemId = uuidv7();
          
          let blendedCostPaisa = product.cost_price_paisa ?? 0;
          const batchesToInsert: any[] = [];
          
          const batches = db.prepare('SELECT id, remaining_qty, cost_price_paisa FROM inventory_batches WHERE product_id = ? AND remaining_qty > 0 ORDER BY received_at ASC').all(item.product_id) as any[];
          
          let qtyToFulfill = item.qty;
          let totalCostForThisItem = 0;
          
          for (const batch of batches) {
            if (qtyToFulfill <= 0) break;
            
            const takeQty = Math.min(batch.remaining_qty, qtyToFulfill);
            qtyToFulfill -= takeQty;
            totalCostForThisItem += (takeQty * batch.cost_price_paisa);
            
            db.prepare('UPDATE inventory_batches SET remaining_qty = remaining_qty - ? WHERE id = ?').run(takeQty, batch.id);
            
            batchesToInsert.push({
              batch_id: batch.id,
              takeQty,
              cost_price_paisa: batch.cost_price_paisa
            });
          }
          
          if (qtyToFulfill > 0) {
             totalCostForThisItem += (qtyToFulfill * (product.cost_price_paisa ?? 0));
          }
          
          blendedCostPaisa = Math.round(totalCostForThisItem / item.qty);
  
          insertItemStmt.run(
            saleItemId, saleId, item.product_id, item.qty, item.unit_price_paisa,
            item.discount_paisa, item.serial_number_id || null,
            blendedCostPaisa, deviceId, now, now
          );
  
          for (const b of batchesToInsert) {
            db.prepare('INSERT INTO sale_item_batches (id, sale_item_id, batch_id, qty_consumed, cost_price_paisa) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)').run(
              saleItemId, b.batch_id, b.takeQty, b.cost_price_paisa
            );
          }
  
          insertStockTxStmt.run(
            uuidv7(), item.product_id, -item.qty, saleId, `Sale ${invoiceNo}`, userId, deviceId, now, now
          );
  
          invoiceItems.push({
            name: product.name,
            nameBn: product.name_bn,
            qty: item.qty,
            unitPricePaisa: item.unit_price_paisa,
            discountPaisa: item.discount_paisa,
            totalPaisa: (item.unit_price_paisa * item.qty) - item.discount_paisa,
          });
        }
  
        // 3. Insert Split Payments Rows
        const insertPaymentStmt = db.prepare(`
          INSERT INTO payments (
            id, sale_id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
          ) VALUES (?, ?, ?, 'in', ?, ?, 'sale_payment', ?, ?, ?, ?)
        `);
  
        for (const payment of payload.payments) {
          if (payment.amount_paisa > 0) {
            let netAmount = payment.amount_paisa;
            // If cash was tendered with excess change returned, record net cash retained in drawer
            if (payment.method === 'cash' && payload.change_paisa > 0) {
              netAmount = Math.max(0, payment.amount_paisa - payload.change_paisa);
            }
            if (netAmount > 0) {
              insertPaymentStmt.run(
                uuidv7(), saleId, payload.customer_id || null, payment.method, netAmount,
                userId, deviceId, now, now
              );
            }
          }
        }
      });

      /*
       * Retried on a number collision, and on nothing else.
       *
       * Two tills on one database - or one cashier who double-clicks Complete -
       * can still both reach the numbering at the same instant. The loser's
       * whole transaction rolls back, so taking the next number and writing it
       * again is safe: no stock was moved and no payment was recorded by the
       * attempt that failed. Anything that is not a duplicate number is a real
       * failure and is thrown as it is.
       */
      for (let attempt = 1; ; attempt++) {
        try {
          // Repopulated by each attempt; a retry must not print the items twice.
          invoiceItems.length = 0;
          writeSale();
          break;
        } catch (err) {
          if (attempt >= 5 || !isInvoiceNumberCollision(err)) throw err;
        }
      }

      logAudit('CREATE_SALE', 'sales', saleId, { invoiceNo, totalPaisa: payload.total_paisa });
  
      const settingsMap = readSettingsMap(db);
      const shopName = settingsMap['invoice_shop_name'] || settingsMap['shop_name'] || 'Mechanical Parts Shop';
      const shopAddress = settingsMap['shop_address'] || 'Dhaka, Bangladesh';
      const invoiceFooter = settingsMap['invoice_footer'] || 'Thank you for your business!';
  
      // Same figure the walk-in guard above used, so the printed invoice and
      // the customer's balance cannot drift apart.
      const duePaisa = remainingDue;
  
      const pdfData: InvoicePdfData = {
        shopName,
        shopAddress,
        shopPhone: settingsMap['shop_phone'] || '',
        invoiceContacts: (() => { try { return JSON.parse(settingsMap['invoice_contacts'] || '[]'); } catch { return []; } })(),
        invoiceFooter,
        invoiceNo,
        // The sale's own timestamp; invoicePdf formats it for print. A string
        // formatted here was read back month-first on the A4 memo.
        date: now,
        cashierName: activeSession?.name || 'Staff',
        customerName: customerInfo?.name,
        customerPhone: customerInfo?.phone,
        customerAddress: customerInfo?.address,
        items: invoiceItems,
        subtotalPaisa: payload.subtotal_paisa,
        discountPaisa: payload.discount_paisa,
        totalPaisa: payload.total_paisa,
        payments: payload.payments.map(p => ({ method: p.method, amountPaisa: p.amount_paisa })),
        totalPaidPaisa: payload.total_paid_paisa,
        changePaisa: payload.change_paisa,
        duePaisa,
        customerPreviousDuePaisa: payload.customer_id ? customerPreviousDuePaisa : undefined,
        previousDuePaidPaisa: payload.customer_id ? (payload.previous_due_paid_paisa || 0) : undefined,
        customerRemainingDuePaisa: payload.customer_id ? customerPreviousDuePaisa - (payload.previous_due_paid_paisa || 0) + duePaisa : undefined,
      };
  
      let pdfBase64 = '';
      try {
        pdfBase64 = await generateInvoicePdf(pdfData, printOptionsFromSettings(settingsMap, payload.layout));
      } catch (pdfErr) {
        console.error('Invoice PDF generation warning:', pdfErr);
      }
  
      return {
        success: true,
        sale_id: saleId,
        invoice_no: invoiceNo,
        pdfBase64,
      };
    });

  ipcMain.handle('api:sales:getByInvoice', async (_event, rawInvoiceNo) => {
      requireRole(['owner', 'staff']);
      const invoiceNo = z.string().min(1).parse(rawInvoiceNo).trim();
      const db = getDb();
  
      const sale = db.prepare(`
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.invoice_no = ? OR s.id = ?
      `).get(invoiceNo, invoiceNo) as any;
  
      if (!sale) return null;
  
      const items = db.prepare(`
        SELECT si.*, p.name as product_name, p.name_bn as product_name_bn, p.barcode, p.unit,
          COALESCE((SELECT SUM(ri.qty) FROM return_items ri
                    JOIN returns r ON r.id = ri.return_id
                    WHERE ri.sale_item_id = si.id AND r.sale_id = si.sale_id
                      AND ri.deleted_at IS NULL), 0) AS returned_qty,
          COALESCE((SELECT SUM(ri.amount_paisa) FROM return_items ri
                    JOIN returns r ON r.id = ri.return_id
                    WHERE ri.sale_item_id = si.id AND r.sale_id = si.sale_id
                      AND ri.deleted_at IS NULL), 0) AS returned_paisa
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ? AND si.deleted_at IS NULL
      `).all(sale.id) as any[];

      // A line is worth what was paid for it: its price less its share of any
      // whole-invoice discount. The return screen refunds against these figures
      // rather than the sticker price, which would exceed what was collected.
      const saleDiscountAlloc = allocateSaleDiscount(
        items.map((it) => ({ id: it.id, grossPaisa: (it.unit_price_paisa * it.qty) - it.discount_paisa })),
        sale.discount_paisa || 0
      );
      items.forEach((it) => {
        const netLinePaisa = (it.unit_price_paisa * it.qty) - it.discount_paisa - (saleDiscountAlloc[it.id] || 0);
        it.sale_discount_share_paisa = saleDiscountAlloc[it.id] || 0;
        it.net_line_paisa = netLinePaisa;
        it.refundable_qty = it.qty - it.returned_qty;
        it.refundable_paisa = Math.max(0, netLinePaisa - it.returned_paisa);
        it.net_unit_price_paisa = it.qty > 0 ? Math.round(netLinePaisa / it.qty) : 0;
      });
  
      const payments = db.prepare(`
        SELECT * FROM payments WHERE sale_id = ?
      `).all(sale.id) as any[];
  
      const returns = db.prepare(`
        SELECT r.*, ri.sale_item_id, ri.qty as returned_qty, ri.amount_paisa
        FROM returns r
        LEFT JOIN return_items ri ON r.id = ri.return_id
        WHERE r.sale_id = ?
      `).all(sale.id) as any[];
  
      return {
        ...sale,
        items,
        payments,
        returns,
      };
    });

  ipcMain.handle('api:sales:list', async (_event, limitRaw) => {
      requireRole(['owner', 'staff']);
      const limit = typeof limitRaw === 'number' ? limitRaw : 50;
      const db = getDb();
  
      /*
       * `paid_at_sale_paisa` is what was collected when the bill was cut, and
       * nothing else - only payments carrying this sale_id and typed
       * 'sale_payment'.
       *
       * It is deliberately not the invoice's current outstanding balance, and
       * cannot be: settling a baki later goes through collectDue, which writes
       * a payment against the customer with no sale_id at all, because nothing
       * records which invoice the money was meant for. Summing per-invoice would
       * therefore show a bill as unpaid for ever, however much the customer had
       * since handed over. What is owed now is a customer-level figure - see
       * v_customer_due and the Due & Payable report.
       */
      return db.prepare(`
        SELECT s.*, c.name as customer_name, u.name as cashier_name,
          COALESCE(paid.sum_paid, 0) AS paid_at_sale_paisa,
          MAX(0, (s.total_paisa - COALESCE(returned.sum_returned, 0)) - COALESCE(paid.sum_paid, 0)) AS due_at_sale_paisa,
          COALESCE(refunds.sum_refunded, 0) AS refunded_paisa,
          COALESCE(returned.sum_returned, 0) AS returned_value_paisa,
          ret.return_invoice_no
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        LEFT JOIN (
          SELECT p.sale_id, SUM(p.amount_paisa) AS sum_paid
          FROM payments p
          WHERE p.direction = 'in' AND p.type = 'sale_payment' AND p.deleted_at IS NULL
          GROUP BY p.sale_id
        ) paid ON paid.sale_id = s.id
        LEFT JOIN (
          SELECT p.sale_id, SUM(p.amount_paisa) AS sum_refunded
          FROM payments p
          WHERE p.direction = 'out' AND p.type = 'refund' AND p.deleted_at IS NULL
          GROUP BY p.sale_id
        ) refunds ON refunds.sale_id = s.id
        LEFT JOIN (
          SELECT r.sale_id, SUM(ri.amount_paisa) AS sum_returned
          FROM return_items ri
          JOIN returns r ON ri.return_id = r.id
          WHERE ri.deleted_at IS NULL AND r.deleted_at IS NULL
          GROUP BY r.sale_id
        ) returned ON returned.sale_id = s.id
        LEFT JOIN (
          SELECT sale_id, return_invoice_no
          FROM returns
          WHERE deleted_at IS NULL AND return_invoice_no IS NOT NULL
          GROUP BY sale_id
          HAVING created_at = MAX(created_at)
        ) ret ON ret.sale_id = s.id
        WHERE s.deleted_at IS NULL AND s.status != 'held'
        ORDER BY s.created_at DESC
        LIMIT ?
      `).all(limit);
    });

  ipcMain.handle('api:sales:holdSale', async (_event, rawData) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        cartData: z.any(),
        customerName: z.string().optional(),
        note: z.string().optional(),
      });
      const { cartData, customerName, note } = schema.parse(rawData);
      const db = getDb();
      const id = uuidv7();
      const now = new Date().toISOString();
      const invoiceNo = `HOLD-${Date.now().toString().slice(-6)}`;
  
      db.prepare(`
        INSERT INTO sales (
          id, invoice_no, status, subtotal_paisa, discount_paisa, total_paisa,
          user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, 'held', 0, 0, 0, ?, ?, ?, ?)
      `).run(id, invoiceNo, activeSession?.id || 'system', getDeviceId(db), now, now);
  
      logAudit('HOLD_SALE', 'held_sales', id, { cartData, customerName, note });
      return { id, invoiceNo };
    });

  ipcMain.handle('api:sales:getHeldSales', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      const rows = db.prepare(`
        SELECT s.*, a.detail_json
        FROM sales s
        LEFT JOIN audit_log a ON a.entity = 'held_sales' AND a.entity_id = s.id
        WHERE s.status = 'held' AND s.deleted_at IS NULL
        ORDER BY s.created_at DESC
      `).all() as any[];
  
      return rows.map(r => ({
        ...r,
        detail: r.detail_json ? JSON.parse(r.detail_json) : null,
      }));
    });

  ipcMain.handle('api:sales:deleteHeldSale', async (_event, rawId) => {
      requireRole(['owner', 'staff']);
      const id = z.string().min(1).parse(rawId);
      const db = getDb();
      db.prepare("DELETE FROM sales WHERE id = ? AND status = 'held'").run(id);
      return true;
    });

  ipcMain.handle('api:sales:processReturn', async (_event, rawPayload) => {
      requireRole(['owner', 'staff']);
      // A refund pays cash out of the same drawer a sale fills.
      requireOpenShift(getDb(), 'A refund');
      const schema = z.object({
        sale_id: z.string().min(1),
        reason: z.string().min(1),
        refund_method: z.enum(['cash', 'bkash', 'nagad', 'card', 'other']).default('cash'),
        items: z.array(z.object({
          sale_item_id: z.string().min(1),
          product_id: z.string().min(1),
          qty: z.number().int().positive(),
          amount_paisa: z.number().int().min(0),
        })).min(1),
      });

      const payload = schema.parse(rawPayload);
      const db = getDb();
      const now = new Date().toISOString();
      const userId = activeSession?.id || 'system';
      const deviceId = getDeviceId(db);
      const returnId = uuidv7();

      let outcome = {
        totalRefundPaisa: 0,
        cashRefundPaisa: 0,
        creditedToDuePaisa: 0,
        status: 'partial_refund',
        returnInvoiceNo: '',
      };

      db.transaction(() => {
        const sale = db.prepare(`
          SELECT id, customer_id, total_paisa, discount_paisa
          FROM sales WHERE id = ? AND deleted_at IS NULL AND status != 'held'
        `).get(payload.sale_id) as any;
        if (!sale) throw new Error('Sale not found.');

        const soldLines = db.prepare(
          'SELECT id, qty, unit_price_paisa, discount_paisa FROM sale_items WHERE sale_id = ? AND deleted_at IS NULL'
        ).all(payload.sale_id) as any[];

        // What the customer paid for a line is its price less its share of any
        // whole-invoice discount. Refunding the undiscounted price hands back
        // more than was ever collected.
        const discountAlloc = allocateSaleDiscount(
          soldLines.map((l) => ({ id: l.id, grossPaisa: (l.unit_price_paisa * l.qty) - l.discount_paisa })),
          sale.discount_paisa || 0
        );

        const returnedStmt = db.prepare(`
          SELECT COALESCE(SUM(ri.qty), 0) AS qty, COALESCE(SUM(ri.amount_paisa), 0) AS amount_paisa
          FROM return_items ri
          JOIN returns r ON r.id = ri.return_id
          WHERE ri.sale_item_id = ? AND r.sale_id = ? AND ri.deleted_at IS NULL
        `);

        // Nothing previously stopped the same line being sent back over and
        // over, each pass restoring stock and paying out again.
        let totalRefundPaisa = 0;
        for (const item of payload.items) {
          const line = soldLines.find((l) => l.id === item.sale_item_id);
          if (!line) throw new Error('That item is not on this invoice.');

          const already = returnedStmt.get(item.sale_item_id, payload.sale_id) as any;
          const qtyLeft = line.qty - already.qty;
          const netLinePaisa = (line.unit_price_paisa * line.qty) - line.discount_paisa - discountAlloc[line.id];
          const valueLeftPaisa = netLinePaisa - already.amount_paisa;

          if (qtyLeft <= 0) {
            throw new Error('This item has already been fully returned.');
          }
          if (item.qty > qtyLeft) {
            throw new Error(`Only ${qtyLeft} of ${line.qty} left to return on this item.`);
          }
          if (item.amount_paisa > valueLeftPaisa) {
            throw new Error(
              `Refund of \u09f3${(item.amount_paisa / 100).toFixed(2)} is more than the ` +
              `\u09f3${(Math.max(0, valueLeftPaisa) / 100).toFixed(2)} left on this item.`
            );
          }
          totalRefundPaisa += item.amount_paisa;
        }

        // Generate the return invoice number inside the transaction so two
        // concurrent returns on the same day cannot get the same number.
        const returnInvoiceNo = generateReturnInvoiceNumber(db);

        db.prepare(`
          INSERT INTO returns (id, sale_id, user_id, reason, device_id, return_invoice_no, refund_method, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(returnId, payload.sale_id, userId, payload.reason, deviceId, returnInvoiceNo, payload.refund_method, now, now);

        const insertReturnItem = db.prepare(`
          INSERT INTO return_items (id, return_id, sale_item_id, qty, amount_paisa, device_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const restoreStockStmt = db.prepare('UPDATE products SET stock_qty = stock_qty + ?, updated_at = ? WHERE id = ?');
        const insertStockTxStmt = db.prepare(`
          INSERT INTO stock_transactions (
            id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, device_id, created_at, updated_at
          ) VALUES (?, ?, 'return_in', ?, 'returns', ?, ?, ?, ?, ?, ?)
        `);
        const insertBatchStmt = db.prepare(`
          INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'returns', ?)
        `);

        for (const item of payload.items) {
          insertReturnItem.run(uuidv7(), returnId, item.sale_item_id, item.qty, item.amount_paisa, deviceId, now, now);
          restoreStockStmt.run(item.qty, now, item.product_id);
          insertStockTxStmt.run(uuidv7(), item.product_id, item.qty, returnId, `Customer Return: ${payload.reason}`, userId, deviceId, now, now);

          const saleItem = db.prepare('SELECT unit_cost_paisa FROM sale_items WHERE id = ?').get(item.sale_item_id) as any;
          const costPaisa = saleItem?.unit_cost_paisa || 0;
          insertBatchStmt.run(item.product_id, item.qty, item.qty, costPaisa, now, returnId);
        }

        // Cash goes back only for money that actually came in. Refunding the
        // full value of a baki return paid out cash the customer never handed
        // over, and because the credit note also lowers the sale, the due was
        // left standing at exactly the figure it was before the return. What
        // cannot go back as cash reduces what the customer owes instead, which
        // the return_items rows above already do on their own.
        const collectedPaisa = (db.prepare(
          "SELECT COALESCE(SUM(amount_paisa), 0) AS n FROM payments WHERE sale_id = ? AND direction = 'in' AND deleted_at IS NULL"
        ).get(payload.sale_id) as any).n;
        const refundedBeforePaisa = (db.prepare(
          "SELECT COALESCE(SUM(amount_paisa), 0) AS n FROM payments WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND deleted_at IS NULL"
        ).get(payload.sale_id) as any).n;
        const returnedTotalPaisa = (db.prepare(`
          SELECT COALESCE(SUM(ri.amount_paisa), 0) AS n FROM return_items ri
          JOIN returns r ON r.id = ri.return_id
          WHERE r.sale_id = ? AND ri.deleted_at IS NULL
        `).get(payload.sale_id) as any).n;

        const netPaidPaisa = collectedPaisa - refundedBeforePaisa;
        const saleValueLeftPaisa = sale.total_paisa - returnedTotalPaisa;
        const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;
        let cashRefundPaisa = Math.max(0, Math.min(totalRefundPaisa, netPaidPaisa, overpaidPaisa));
        let creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;

        if (creditedToDuePaisa > 0 && sale.customer_id) {
          const customerDueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(sale.customer_id) as any;
          const currentGlobalDue = customerDueRow ? customerDueRow.due_paisa : 0;
          if (creditedToDuePaisa > currentGlobalDue) {
            const excessCredit = creditedToDuePaisa - Math.max(0, currentGlobalDue);
            creditedToDuePaisa -= excessCredit;
            cashRefundPaisa += excessCredit;
          }
        }

        if (cashRefundPaisa > 0) {
          db.prepare(`
            INSERT INTO payments (
              id, sale_id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
            ) VALUES (?, ?, ?, 'out', ?, ?, 'refund', ?, ?, ?, ?)
          `).run(uuidv7(), payload.sale_id, sale.customer_id, payload.refund_method, cashRefundPaisa, userId, deviceId, now, now);
        }

        // 'partial_refund' existed in the schema but was never written, so one
        // returned bolt used to mark a whole invoice refunded.
        const status = returnedTotalPaisa >= sale.total_paisa ? 'refunded' : 'partial_refund';
        db.prepare('UPDATE sales SET status = ?, updated_at = ? WHERE id = ?').run(status, now, payload.sale_id);

        outcome = { totalRefundPaisa, cashRefundPaisa, creditedToDuePaisa, status, returnInvoiceNo };
      })();

      logAudit('PROCESS_RETURN', 'returns', returnId, {
        saleId: payload.sale_id,
        returnInvoiceNo: outcome.returnInvoiceNo,
        totalRefundPaisa: outcome.totalRefundPaisa,
        cashRefundPaisa: outcome.cashRefundPaisa,
        creditedToDuePaisa: outcome.creditedToDuePaisa,
        status: outcome.status,
      });

      return {
        success: true,
        returnId,
        return_invoice_no: outcome.returnInvoiceNo,
        total_refund_paisa: outcome.totalRefundPaisa,
        cash_refund_paisa: outcome.cashRefundPaisa,
        credited_to_due_paisa: outcome.creditedToDuePaisa,
        status: outcome.status,
      };
    });

  ipcMain.handle('api:sales:getReturnByInvoice', async (_event, rawReturnInvoiceNo) => {
      requireRole(['owner', 'staff']);
      const returnInvoiceNo = z.string().min(1).parse(rawReturnInvoiceNo);
      const db = getDb();

      const ret = db.prepare(`
        SELECT r.*, s.invoice_no as original_invoice_no,
               c.name as customer_name, c.phone as customer_phone,
               u.name as cashier_name
        FROM returns r
        JOIN sales s ON s.id = r.sale_id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.return_invoice_no = ? AND r.deleted_at IS NULL
      `).get(returnInvoiceNo) as any;

      if (!ret) throw new Error('Return invoice not found.');

      const items = db.prepare(`
        SELECT ri.*, p.name as product_name, si.unit_price_paisa
        FROM return_items ri
        JOIN sale_items si ON si.id = ri.sale_item_id
        JOIN products p ON p.id = si.product_id
        WHERE ri.return_id = ? AND ri.deleted_at IS NULL
      `).all(ret.id) as any[];

      return { ...ret, items };
    });

  ipcMain.handle('api:sales:generateReturnPdf', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        return_invoice_no: z.string().min(1),
        layout: z.enum(['80mm', 'a4']).default('80mm'),
      });
      const { return_invoice_no, layout } = schema.parse(rawArgs);
      const db = getDb();

      const ret = db.prepare(`
        SELECT r.*, s.invoice_no as original_invoice_no, s.total_paisa as original_total_paisa,
               c.name as customer_name, c.phone as customer_phone,
               u.name as cashier_name
        FROM returns r
        JOIN sales s ON s.id = r.sale_id
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.return_invoice_no = ? AND r.deleted_at IS NULL
      `).get(return_invoice_no) as any;

      if (!ret) throw new Error('Return invoice not found.');

      const originalItems = db.prepare(`
        SELECT si.*, p.name as product_name
        FROM sale_items si
        JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = ? AND si.deleted_at IS NULL
      `).all(ret.sale_id) as any[];

      const items = db.prepare(`
        SELECT ri.*, p.name as product_name, si.unit_price_paisa
        FROM return_items ri
        JOIN sale_items si ON si.id = ri.sale_item_id
        JOIN products p ON p.id = si.product_id
        WHERE ri.return_id = ? AND ri.deleted_at IS NULL
      `).all(ret.id) as any[];

      const settingsMap = readSettingsMap(db);
      const shopName = settingsMap['invoice_shop_name'] || settingsMap['shop_name'] || 'Shop';
      const shopAddress = settingsMap['shop_address'] || '';
      const invoiceFooter = settingsMap['invoice_footer'] || 'Thank you for your business!';

      const totalRefundPaisa = items.reduce((s: number, i: any) => s + i.amount_paisa, 0);

      const collectedPaisa = (db.prepare(
        "SELECT COALESCE(SUM(amount_paisa), 0) AS n FROM payments WHERE sale_id = ? AND direction = 'in' AND deleted_at IS NULL"
      ).get(ret.sale_id) as any).n;
      const refundedBeforePaisa = (db.prepare(
        "SELECT COALESCE(SUM(amount_paisa), 0) AS n FROM payments WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND deleted_at IS NULL"
      ).get(ret.sale_id) as any).n;
      const returnedBeforeTotalPaisa = (db.prepare(`
        SELECT COALESCE(SUM(ri.amount_paisa), 0) AS n FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE r.sale_id = ? AND ri.deleted_at IS NULL AND r.created_at < ?
      `).get(ret.sale_id, ret.created_at) as any).n;

      const refundPayment = db.prepare(`
          SELECT amount_paisa FROM payments 
          WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND created_at = ?
        `).get(ret.sale_id, ret.created_at) as any;
        const cashRefundPaisa = refundPayment ? refundPayment.amount_paisa : 0;
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;

      const pdfBase64 = await generateReturnInvoicePdf(
        {
          shopName,
          shopAddress,
          shopPhone: settingsMap['shop_phone'] || '',
          invoiceFooter,
          returnInvoiceNo: ret.return_invoice_no,
          originalInvoiceNo: ret.original_invoice_no,
          date: ret.created_at,
          cashierName: ret.cashier_name || 'Staff',
          customerName: ret.customer_name,
          customerPhone: ret.customer_phone,
          reason: ret.reason || '',
          refundMethod: ret.refund_method || 'cash',
          originalItems: originalItems.map((i: any) => ({
            productName: i.product_name,
            qty: i.qty,
            unitPricePaisa: i.unit_price_paisa,
            totalPaisa: (i.unit_price_paisa * i.qty) - i.discount_paisa,
          })),
          originalTotalPaisa: ret.original_total_paisa || 0,
          items: items.map((i: any) => ({
            productName: i.product_name,
            qty: i.qty,
            unitPricePaisa: i.unit_price_paisa,
            totalPaisa: i.amount_paisa,
          })),
          totalRefundPaisa,
          cashRefundPaisa,
          creditedToDuePaisa,
        },
        printOptionsFromSettings(settingsMap, layout)
      );

      return { success: true, pdfBase64 };
    });



  ipcMain.handle('api:sales:generatePdf', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        invoice_no: z.string().min(1),
        layout: z.enum(['80mm', 'a4']).default('80mm'),
      });
      const { invoice_no, layout } = schema.parse(rawArgs);
      const db = getDb();
  
      const sale = db.prepare(`
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.invoice_no = ? OR s.id = ?
      `).get(invoice_no, invoice_no) as any;
  
      if (!sale) throw new Error('Invoice not found.');
  
      const items = db.prepare(`
        SELECT si.*, p.name as product_name, p.name_bn as product_name_bn
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(sale.id) as any[];
  
      const payments = db.prepare(
        `SELECT * FROM payments WHERE sale_id = ? AND direction = 'in' AND deleted_at IS NULL`
      ).all(sale.id) as any[];

      const settingsMap = readSettingsMap(db);
      const shopName = settingsMap['invoice_shop_name'] || settingsMap['shop_name'] || 'Mechanical Parts Shop';
      const shopAddress = settingsMap['shop_address'] || 'Dhaka, Bangladesh';
      const invoiceFooter = settingsMap['invoice_footer'] || 'Thank you for your business!';

      const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount_paisa, 0);

      /*
       * What is still owed on this bill, with the returns taken off it.
       *
       * The due printed here was the sale total less what had been collected,
       * and nothing else. On a credit sale that was partly handed back, the
       * goods had gone off the bill and the cash paid out had left the drawer,
       * but neither showed - so a reprint handed the customer a demand for
       * money they no longer owed, on a document that looks official.
       *
       * The same three figures processReturn settles a refund against, read the
       * same way, so the reprint and the customer's ledger cannot disagree.
       */
      const returnedPaisa = (db.prepare(`
        SELECT COALESCE(SUM(ri.amount_paisa), 0) AS n
        FROM return_items ri
        JOIN returns r ON r.id = ri.return_id
        WHERE r.sale_id = ? AND r.deleted_at IS NULL AND ri.deleted_at IS NULL
      `).get(sale.id) as any).n as number;

      const refundedPaisa = (db.prepare(`
        SELECT COALESCE(SUM(amount_paisa), 0) AS n FROM payments
        WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND deleted_at IS NULL
      `).get(sale.id) as any).n as number;

      const duePaisa = Math.max(0, (sale.total_paisa - returnedPaisa) - (totalPaid - refundedPaisa));

              let customerPreviousDuePaisa = 0;
          if (sale.customer_id) {
            const historyDue = db.prepare(`
              SELECT 
                COALESCE((
                  SELECT SUM(total_paisa - COALESCE((
                     SELECT SUM(ri.amount_paisa) 
                     FROM returns r 
                     JOIN return_items ri ON r.id = ri.return_id 
                     WHERE r.sale_id = s.id AND r.created_at < ?
                   ), 0))
                  FROM sales s
                  WHERE s.customer_id = ? AND s.deleted_at IS NULL AND s.status != 'held' AND s.created_at < ?
                ), 0) - COALESCE((
                  SELECT SUM(CASE WHEN direction = 'in' THEN amount_paisa ELSE -amount_paisa END)
                  FROM payments p
                  WHERE p.customer_id = ? AND p.deleted_at IS NULL AND p.created_at < ?
                ), 0) AS historical_due
            `).get(sale.created_at, sale.customer_id, sale.created_at, sale.customer_id, sale.created_at) as any;
            
            customerPreviousDuePaisa = historyDue ? historyDue.historical_due : 0;
          }

        const pdfData: InvoicePdfData = {
          shopName,
        shopAddress,
        shopPhone: settingsMap['shop_phone'] || '',
        invoiceContacts: (() => { try { return JSON.parse(settingsMap['invoice_contacts'] || '[]'); } catch { return []; } })(),
        invoiceFooter,
        invoiceNo: sale.invoice_no,
        date: sale.created_at,
        cashierName: sale.cashier_name || 'Staff',
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
        customerAddress: sale.customer_address,
        items: items.map(it => ({
          name: it.product_name,
          nameBn: it.product_name_bn,
          qty: it.qty,
          unitPricePaisa: it.unit_price_paisa,
          discountPaisa: it.discount_paisa,
          totalPaisa: (it.unit_price_paisa * it.qty) - it.discount_paisa,
        })),
        subtotalPaisa: sale.subtotal_paisa,
        discountPaisa: sale.discount_paisa,
        totalPaisa: sale.total_paisa,
        payments: payments.map((p: any) => ({ method: p.method, amountPaisa: p.amount_paisa })),
        totalPaidPaisa: totalPaid,
        duePaisa,
          customerPreviousDuePaisa: sale.customer_id ? customerPreviousDuePaisa : undefined,
          previousDuePaidPaisa: sale.customer_id ? (sale.previous_due_paid_paisa || 0) : undefined,
          customerRemainingDuePaisa: sale.customer_id ? customerPreviousDuePaisa - (sale.previous_due_paid_paisa || 0) + duePaisa : undefined,
      };
  
      const pdfBase64 = await generateInvoicePdf(pdfData, printOptionsFromSettings(settingsMap, layout));
      return { success: true, pdfBase64 };
    });

}


