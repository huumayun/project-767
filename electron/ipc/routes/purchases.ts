import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


export function registerPurchasesHandlers() {
  ipcMain.handle('api:purchases:create', async (_event, rawData) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        supplier_id: z.string().optional().nullable(),
        invoice_ref: z.string().optional().nullable(),
        paid_taka: z.number().min(0),
        payment_method: z.enum(['cash', 'bkash', 'nagad', 'card']).optional().default('cash'),
        transport_taka: z.number().min(0).optional().default(0),
        transport_on_invoice: z.boolean().optional().default(true),
        note: z.string().optional().nullable(),
        items: z.array(z.object({
          product_id: z.string().min(1),
          qty: z.number().int().positive(),
          unit_cost_taka: z.number().min(0),
        })).min(1),
      });
  
      const data = schema.parse(rawData);
      const db = getDb();
      const purchaseId = uuidv7();
      const now = new Date().toISOString();
      const userId = activeSession?.id || 'system';
  
      let goodsPaisa = 0;
      const itemsPaisa = data.items.map(item => {
        const costPaisa = Math.round(item.unit_cost_taka * 100);
        goodsPaisa += costPaisa * item.qty;
        return { ...item, unit_cost_paisa: costPaisa };
      });
  
      // Transport is a real cost of getting the goods in, so it is spread across
      // the lines by value rather than ignored — otherwise stock looks cheaper
      // than it was and every sale of it reports too much profit.
      const transportPaisa = Math.round((data.transport_taka || 0) * 100);
  
      // Who the fare is owed to decides only whether it joins the vendor's bill.
      // A delivery charge on their challan does; a pickup van the shop hired
      // does not, and billing it to the vendor would overstate the payable.
      // Either way it lands on the stock below.
      const transportOnInvoice = data.transport_on_invoice !== false;
      const vendorInvoicePaisa = goodsPaisa + (transportOnInvoice ? transportPaisa : 0);
      const paidPaisa = Math.round(data.paid_taka * 100);
  
      // Paying past the vendor's bill used to be swallowed by the `due > 0`
      // guard below: the extra vanished and the ledger read negative forever.
      if (paidPaisa > vendorInvoicePaisa) {
        throw new Error(
          `Paid amount \u09f3 ${(paidPaisa / 100).toFixed(2)} is more than this vendor's bill of \u09f3 ${(
            vendorInvoicePaisa / 100
          ).toFixed(2)}${
            transportOnInvoice
              ? '.'
              : ' (transport is paid separately, so it is not part of the vendor bill).'
          }`
        );
      }
  
      db.transaction(() => {
        db.prepare(`
          INSERT INTO purchases (id, supplier_id, invoice_ref, total_paisa, paid_paisa, transport_paisa, transport_on_invoice, note, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(purchaseId, data.supplier_id || null, data.invoice_ref || null, vendorInvoicePaisa, paidPaisa, transportPaisa, transportOnInvoice ? 1 : 0, data.note || null, now, now);
  
        const insertItem = db.prepare(`
          INSERT INTO purchase_items (id, purchase_id, product_id, qty, unit_cost_paisa, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        const readProduct = db.prepare('SELECT stock_qty, cost_price_paisa FROM products WHERE id = ?');
        const updateProduct = db.prepare('UPDATE products SET stock_qty = stock_qty + ?, cost_price_paisa = ?, updated_at = ? WHERE id = ?');
        const insertStockTx = db.prepare(`
          INSERT INTO stock_transactions (id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at, unit_cost_paisa)
          VALUES (?, ?, 'purchase', ?, 'purchases', ?, ?, ?, ?, ?, ?)
        `);
  
        // Allocate transport across the lines up front so the parts add back up
        // to the charge exactly; rounding each line independently left a few
        // paisa stranded. Any remainder lands on the largest line.
        const transportAlloc: number[] = itemsPaisa.map((item) =>
          goodsPaisa > 0
            ? Math.floor((transportPaisa * item.unit_cost_paisa * item.qty) / goodsPaisa)
            : 0
        );
        if (transportPaisa > 0 && itemsPaisa.length > 0) {
          const allocated = transportAlloc.reduce((n, v) => n + v, 0);
          let biggest = 0;
          itemsPaisa.forEach((item, i) => {
            if (item.unit_cost_paisa * item.qty > itemsPaisa[biggest].unit_cost_paisa * itemsPaisa[biggest].qty) {
              biggest = i;
            }
          });
          transportAlloc[biggest] += transportPaisa - allocated;
        }
  
        for (const [itemIndex, item] of itemsPaisa.entries()) {
          const lineGoodsPaisa = item.unit_cost_paisa * item.qty;
          const lineTransportPaisa = transportAlloc[itemIndex];
          const landedUnitCostPaisa =
            item.qty > 0 ? Math.round((lineGoodsPaisa + lineTransportPaisa) / item.qty) : item.unit_cost_paisa;
  
          const existing = readProduct.get(item.product_id) as
            | { stock_qty: number; cost_price_paisa: number }
            | undefined;
          const oldQty = Math.max(0, existing?.stock_qty ?? 0);
          const oldCost = existing?.cost_price_paisa ?? landedUnitCostPaisa;
          const newQty = oldQty + item.qty;
          
          const newCostPaisa = landedUnitCostPaisa;
          db.prepare(`
            INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
            VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'purchases', ?)
          `).run(item.product_id, item.qty, item.qty, landedUnitCostPaisa, now, purchaseId);
  
          insertItem.run(uuidv7(), purchaseId, item.product_id, item.qty, item.unit_cost_paisa, now, now);
          updateProduct.run(item.qty, newCostPaisa, now, item.product_id);
          insertStockTx.run(uuidv7(), item.product_id, item.qty, purchaseId, `Purchase invoice ${data.invoice_ref || purchaseId.slice(0, 8)}`, userId, now, now, landedUnitCostPaisa);
        }
  
        // Cash settled at the counter used to live only in purchases.paid_paisa,
        // which no cash report reads - so the drawer never saw the money go and
        // every shift closed short by whatever had been paid to vendors.
        if (paidPaisa > 0) {
          db.prepare(`
            INSERT INTO payments (
              id, supplier_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
            ) VALUES (?, ?, 'out', ?, ?, 'supplier_payment', ?, ?, ?, ?)
          `).run(uuidv7(), data.supplier_id || null, data.payment_method, paidPaisa, userId, getDeviceId(db), now, now);
        }

        const duePaisa = vendorInvoicePaisa - paidPaisa;
        if (data.supplier_id && duePaisa > 0) {
          db.prepare('UPDATE suppliers SET total_payable_paisa = total_payable_paisa + ?, updated_at = ? WHERE id = ?').run(duePaisa, now, data.supplier_id);
        }
      })();
  
      logAudit('CREATE_PURCHASE', 'purchases', purchaseId, {
        vendorInvoicePaisa,
        paidPaisa,
        transportPaisa,
        transportOnInvoice,
        landedTotalPaisa: goodsPaisa + transportPaisa,
      });
      return { success: true, purchaseId };
    });

  ipcMain.handle('api:purchases:list', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      const purchases = db.prepare(`
        SELECT p.*, s.name as supplier_name 
        FROM purchases p 
        LEFT JOIN suppliers s ON p.supplier_id = s.id 
        WHERE p.deleted_at IS NULL 
        ORDER BY p.created_at DESC
      `).all() as any[];

      const itemsStmt = db.prepare(`
        SELECT pi.*, pr.name as product_name
        FROM purchase_items pi
        LEFT JOIN products pr ON pi.product_id = pr.id
        WHERE pi.purchase_id = ?
      `);

      return purchases.map((p) => ({
        ...p,
        items: itemsStmt.all(p.id)
      }));
    });

}
