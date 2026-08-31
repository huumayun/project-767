import { generateInvoicePdf, InvoicePdfData } from '../../services/invoicePdf';

import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit , generateInvoiceNumber } from '../shared';


export function registerSalesHandlers() {
  // --- SALES & INVOICING HANDLERS ---
  ipcMain.handle('api:sales:create', async (_event, rawPayload) => {
      requireRole(['owner', 'staff']);
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
          method: z.enum(['cash', 'bkash', 'nagad', 'card']),
          amount_paisa: z.number().int().min(0),
        })).min(1),
        total_paid_paisa: z.number().int().min(0),
        change_paisa: z.number().int().min(0).default(0),
        layout: z.enum(['80mm', 'a5']).default('80mm'),
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
      const invoiceNo = generateInvoiceNumber(db);
  
      let customerInfo: any = null;
      if (payload.customer_id) {
        customerInfo = db.prepare('SELECT name, phone FROM customers WHERE id = ?').get(payload.customer_id);
      }
  
      const totalCollected = payload.payments.reduce((sum, p) => sum + (p.amount_paisa || 0), 0);
      const netCollected = payload.change_paisa > 0 ? Math.max(0, totalCollected - payload.change_paisa) : totalCollected;
      const remainingDue = Math.max(0, payload.total_paisa - netCollected);
  
      if (remainingDue > 0 && !payload.customer_id) {
        throw new Error('Walk-in (খুচরা) গ্রাহকের ক্ষেত্রে বাকি বিক্রি গ্রহণযোগ্য নয়। বাকি রাখতে হলে কাস্টমার নির্বাচন করুন।');
      }
  
      const invoiceItems: any[] = [];
  
      db.transaction(() => {
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
      })();
  
      logAudit('CREATE_SALE', 'sales', saleId, { invoiceNo, totalPaisa: payload.total_paisa });
  
      const shopName = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_name') as any)?.value || 'Mechanical Parts Shop';
      const shopAddress = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_address') as any)?.value || 'Dhaka, Bangladesh';
      const invoiceFooter = (db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_footer') as any)?.value || 'Thank you for your business!';
  
      const duePaisa = Math.max(0, payload.total_paisa - payload.total_paid_paisa);
  
      const pdfData: InvoicePdfData = {
        shopName,
        shopAddress,
        invoiceFooter,
        invoiceNo,
        date: new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString(),
        cashierName: activeSession?.name || 'Staff',
        customerName: customerInfo?.name,
        customerPhone: customerInfo?.phone,
        items: invoiceItems,
        subtotalPaisa: payload.subtotal_paisa,
        discountPaisa: payload.discount_paisa,
        totalPaisa: payload.total_paisa,
        payments: payload.payments.map(p => ({ method: p.method, amountPaisa: p.amount_paisa })),
        totalPaidPaisa: payload.total_paid_paisa,
        changePaisa: payload.change_paisa,
        duePaisa,
      };
  
      let pdfBase64 = '';
      try {
        pdfBase64 = await generateInvoicePdf(pdfData, payload.layout);
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
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.invoice_no = ? OR s.id = ?
      `).get(invoiceNo, invoiceNo) as any;
  
      if (!sale) return null;
  
      const items = db.prepare(`
        SELECT si.*, p.name as product_name, p.name_bn as product_name_bn, p.barcode, p.unit
        FROM sale_items si
        JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
      `).all(sale.id) as any[];
  
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
  
      return db.prepare(`
        SELECT s.*, c.name as customer_name, u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
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
      const schema = z.object({
        sale_id: z.string().min(1),
        reason: z.string().min(1),
        refund_method: z.enum(['cash', 'bkash', 'nagad', 'card']).default('cash'),
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
  
      let totalRefundPaisa = 0;
      payload.items.forEach(it => { totalRefundPaisa += it.amount_paisa; });
  
      db.transaction(() => {
        db.prepare(`
          INSERT INTO returns (id, sale_id, user_id, reason, device_id, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(returnId, payload.sale_id, userId, payload.reason, deviceId, now, now);
  
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
  
        const saleRow = db.prepare('SELECT customer_id FROM sales WHERE id = ?').get(payload.sale_id) as any;
        const customerId = saleRow ? saleRow.customer_id : null;
  
        db.prepare(`
          INSERT INTO payments (
            id, sale_id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
          ) VALUES (?, ?, ?, 'out', ?, ?, 'refund', ?, ?, ?, ?)
        `).run(uuidv7(), payload.sale_id, customerId, payload.refund_method, totalRefundPaisa, userId, deviceId, now, now);
  
        db.prepare("UPDATE sales SET status = 'refunded', updated_at = ? WHERE id = ?").run(now, payload.sale_id);
      })();
  
      logAudit('PROCESS_RETURN', 'returns', returnId, { saleId: payload.sale_id, totalRefundPaisa });
      return { success: true, returnId };
    });

  ipcMain.handle('api:sales:generatePdf', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        invoice_no: z.string().min(1),
        layout: z.enum(['80mm', 'a5']).default('80mm'),
      });
      const { invoice_no, layout } = schema.parse(rawArgs);
      const db = getDb();
  
      const sale = db.prepare(`
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as cashier_name
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
  
      const payments = db.prepare(`SELECT * FROM payments WHERE sale_id = ? AND direction = 'in'`).all(sale.id) as any[];
  
      const shopName = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_name') as any)?.value || 'Mechanical Parts Shop';
      const shopAddress = (db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_address') as any)?.value || 'Dhaka, Bangladesh';
      const invoiceFooter = (db.prepare('SELECT value FROM settings WHERE key = ?').get('invoice_footer') as any)?.value || 'Thank you for your business!';
  
      const totalPaid = payments.reduce((sum: number, p: any) => sum + p.amount_paisa, 0);
  
      const pdfData: InvoicePdfData = {
        shopName,
        shopAddress,
        invoiceFooter,
        invoiceNo: sale.invoice_no,
        date: new Date(sale.created_at).toLocaleDateString('en-GB') + ' ' + new Date(sale.created_at).toLocaleTimeString(),
        cashierName: sale.cashier_name || 'Staff',
        customerName: sale.customer_name,
        customerPhone: sale.customer_phone,
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
        duePaisa: Math.max(0, sale.total_paisa - totalPaid),
      };
  
      const pdfBase64 = await generateInvoicePdf(pdfData, layout);
      return { success: true, pdfBase64 };
    });

}
