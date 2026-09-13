import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit, requireOpenShift } from '../shared';


export function registerPurchasesHandlers() {
  ipcMain.handle('api:purchases:create', async (_event, rawData) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        supplier_id: z.string().optional().nullable(),
        invoice_ref: z.string().optional().nullable(),
        paid_taka: z.number().min(0),
        payment_method: z.enum(['cash', 'bkash', 'nagad', 'card', 'other']).optional().default('cash'),
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
      // Only when something is actually handed over. Booking a purchase wholly
      // on credit moves no cash, so it needs no open drawer.
      if (paidPaisa > 0) requireOpenShift(db, 'Paying for a purchase');
  
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
              id, supplier_id, purchase_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
            ) VALUES (?, ?, ?, 'out', ?, ?, 'supplier_payment', ?, ?, ?, ?)
          `).run(uuidv7(), data.supplier_id || null, purchaseId, data.payment_method, paidPaisa, userId, getDeviceId(db), now, now);
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

  /**
   * Reverses a supplier bill that was entered wrong.
   *
   * A purchase writes to eight places - the bill, its lines, the product's stock
   * and cost, a FIFO batch, a stock transaction, the cash drawer and the
   * supplier's payable - so there was no way to correct a typo without editing
   * the database by hand. Editing the row in place would not have worked either:
   * the stock and the money it moved have to be moved back.
   *
   * Voiding is refused rather than approximated once any of the goods have been
   * sold. Those units left on a FIFO batch at a cost that is now being called
   * wrong, and the sales that consumed them already recorded it. Unwinding that
   * would rewrite the profit on invoices already given to customers, so the shop
   * is told to record a purchase return instead.
   */
  ipcMain.handle('api:purchases:void', async (_event, rawArgs) => {
      // Owner only: this moves cash and a supplier's payable, which is not a
      // correction a cashier should be able to make alone.
      requireRole(['owner']);

      const schema = z.object({
        purchase_id: z.string().min(1),
        reason: z.string().trim().min(3).max(200),
      });
      const { purchase_id, reason } = schema.parse(rawArgs);

      const db = getDb();
      const now = new Date().toISOString();
      const userId = activeSession?.id || 'system';

      const purchase = db
        .prepare('SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL')
        .get(purchase_id) as any;
      if (!purchase) {
        throw new Error('That purchase no longer exists, or has already been voided.');
      }

      const batches = db
        .prepare("SELECT * FROM inventory_batches WHERE ref_table = 'purchases' AND ref_id = ?")
        .all(purchase_id) as any[];

      const consumed = batches.filter((b) => b.remaining_qty < b.initial_qty);
      if (consumed.length > 0) {
        const names = db
          .prepare(
            `SELECT name FROM products WHERE id IN (${consumed.map(() => '?').join(',')})`
          )
          .all(...consumed.map((b) => b.product_id)) as { name: string }[];
        const sold = consumed.reduce((n, b) => n + (b.initial_qty - b.remaining_qty), 0);
        throw new Error(
          `This bill cannot be voided: ${sold} unit${sold === 1 ? '' : 's'} from it ` +
            `${sold === 1 ? 'has' : 'have'} already been sold (${names.map((n) => n.name).join(', ')}). ` +
            'Record a purchase return for what is going back to the vendor instead.'
        );
      }

      const items = db
        .prepare('SELECT * FROM purchase_items WHERE purchase_id = ?')
        .all(purchase_id) as any[];

      // Taking the stock back out must not push a product negative. If it would,
      // the shelf and the ledger already disagree and a void would bury that.
      for (const item of items) {
        const product = db
          .prepare('SELECT name, stock_qty FROM products WHERE id = ?')
          .get(item.product_id) as any;
        if (!product) continue;
        if ((product.stock_qty || 0) < item.qty) {
          throw new Error(
            `This bill cannot be voided: ${product.name} has only ${product.stock_qty} in stock ` +
              `but the bill added ${item.qty}. Check the stock count first.`
          );
        }
      }

      // A closed shift is a counted drawer. Reversing cash inside one would make
      // the count that was signed off no longer add up.
      const closedShift = db
        .prepare(
          `SELECT id, closed_at FROM shifts
           WHERE status = 'closed' AND opened_at <= ? AND closed_at >= ?
           LIMIT 1`
        )
        .get(purchase.created_at, purchase.created_at) as any;
      if (closedShift) {
        throw new Error(
          'This bill was entered during a shift that has already been closed, so its cash ' +
            'cannot be taken back out of that drawer. Record a purchase return instead.'
        );
      }

      db.transaction(() => {
        const removeBatch = db.prepare('DELETE FROM inventory_batches WHERE id = ?');
        const reduceStock = db.prepare(
          'UPDATE products SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ?'
        );
        const newestBatch = db.prepare(
          `SELECT cost_price_paisa FROM inventory_batches
           WHERE product_id = ? AND remaining_qty > 0
           ORDER BY received_at DESC LIMIT 1`
        );
        const restoreCost = db.prepare(
          'UPDATE products SET cost_price_paisa = ?, updated_at = ? WHERE id = ?'
        );
        const insertStockTx = db.prepare(`
          INSERT INTO stock_transactions (id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at, unit_cost_paisa)
          VALUES (?, ?, 'adjustment', ?, 'purchases', ?, ?, ?, ?, ?, ?)
        `);

        for (const batch of batches) removeBatch.run(batch.id);

        for (const item of items) {
          reduceStock.run(item.qty, now, item.product_id);

          // The purchase overwrote the product's cost with its own. The next
          // best answer is the newest batch still on the shelf; with none left
          // there is nothing better than what is already there.
          const previous = newestBatch.get(item.product_id) as any;
          if (previous) restoreCost.run(previous.cost_price_paisa, now, item.product_id);

          insertStockTx.run(
            uuidv7(),
            item.product_id,
            -item.qty,
            purchase_id,
            `Voided purchase ${purchase.invoice_ref || purchase_id.slice(0, 8)}: ${reason}`,
            userId,
            now,
            now,
            item.unit_cost_paisa
          );
        }

        // The cash never left the drawer if the bill itself was a mistake, so
        // the payment is withdrawn rather than answered with a matching inward
        // row - the shift summary counts every inward cash payment as a sale,
        // and a reversal is not a sale.
        db.prepare(
          "UPDATE payments SET deleted_at = ?, updated_at = ? WHERE purchase_id = ? AND deleted_at IS NULL"
        ).run(now, now, purchase_id);

        const duePaisa = (purchase.total_paisa || 0) - (purchase.paid_paisa || 0);
        if (purchase.supplier_id && duePaisa > 0) {
          db.prepare(
            'UPDATE suppliers SET total_payable_paisa = total_payable_paisa - ?, updated_at = ? WHERE id = ?'
          ).run(duePaisa, now, purchase.supplier_id);
        }

        db.prepare(
          'UPDATE purchases SET deleted_at = ?, updated_at = ?, note = ? WHERE id = ?'
        ).run(
          now,
          now,
          `${purchase.note ? purchase.note + ' | ' : ''}VOIDED: ${reason}`,
          purchase_id
        );
      })();

      logAudit('VOID_PURCHASE', 'purchases', purchase_id, {
        reason,
        totalPaisa: purchase.total_paisa,
        paidPaisa: purchase.paid_paisa,
        supplierId: purchase.supplier_id,
        lines: items.length,
      });

      return { success: true };
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
