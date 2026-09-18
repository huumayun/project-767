import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit, allocateSaleDiscount, localDaySql } from '../shared';


export function registerReportsHandlers() {
  // --- PHASE 4: REPORTS, USERS, SETTINGS & AUDIT LOG HANDLERS ---
  // Sales Report (Date Range Filtered)
  ipcMain.handle('api:reports:getSalesReport', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      });
      const { startDate, endDate } = schema.parse(rawArgs);
      const db = getDb();

      /*
       * Grouped and filtered by the database.
       *
       * Every figure here used to be reached by reading each table out in full
       * and sieving it in JS - correct, because a UTC stamp has to be turned
       * into a Bangladesh calendar day before it can be compared, but it meant
       * a one-day report walked the shop's entire trading history, and the walk
       * got longer every day the shop stayed open. SQLite can do that same
       * conversion, so the range is a WHERE clause now and only the rows asked
       * for are read.
       */
      const saleDay = localDaySql('created_at');

      const totals = db.prepare(`
        SELECT
          COUNT(id) AS total_orders,
          COALESCE(SUM(subtotal_paisa), 0) AS subtotal_paisa,
          COALESCE(SUM(discount_paisa), 0) AS discount_paisa,
          COALESCE(SUM(total_paisa), 0) AS gross_sales_paisa
        FROM sales
        WHERE deleted_at IS NULL AND status != 'held'
          AND ${saleDay} BETWEEN ? AND ?
      `).get(startDate, endDate) as any;

      const totalOrders = totals.total_orders as number;
      const subtotalPaisa = totals.subtotal_paisa as number;
      const discountPaisa = totals.discount_paisa as number;
      const grossSalesPaisa = totals.gross_sales_paisa as number;
      let totalRefundedPaisa = 0;

      // Counted from the returns themselves rather than from sale status: a
      // sale reads 'refunded' however many times it was returned against, and
      // 'partial_refund' did not used to be counted at all.
      const returnsAgg = db.prepare(`
        SELECT COUNT(*) AS refunds_count, COALESCE(SUM(amount_paisa), 0) AS returned_paisa
        FROM (
          SELECT r.id, COALESCE(SUM(ri.amount_paisa), 0) AS amount_paisa
          FROM returns r
          JOIN return_items ri ON ri.return_id = r.id
          WHERE r.deleted_at IS NULL AND ri.deleted_at IS NULL
            AND ${localDaySql('r.created_at')} BETWEEN ? AND ?
          GROUP BY r.id
        )
      `).get(startDate, endDate) as any;

      const refundsCount = returnsAgg.refunds_count as number;
      const totalReturnedPaisa = returnsAgg.returned_paisa as number;

      // One row per method/direction/type rather than every payment row.
      const paymentGroups = db.prepare(`
        SELECT method, direction, type, COALESCE(SUM(amount_paisa), 0) AS amount_paisa
        FROM payments
        WHERE deleted_at IS NULL AND ${saleDay} BETWEEN ? AND ?
        GROUP BY method, direction, type
      `).all(startDate, endDate) as any[];

      let cashPaisa = 0;
      let bkashPaisa = 0;
      let nagadPaisa = 0;
      let cardPaisa = 0;
      let otherPaisa = 0;

      paymentGroups.forEach(p => {
        if (p.direction === 'in') {
          if (p.method === 'cash') cashPaisa += p.amount_paisa;
          else if (p.method === 'bkash') bkashPaisa += p.amount_paisa;
          else if (p.method === 'nagad') nagadPaisa += p.amount_paisa;
          else if (p.method === 'card') cardPaisa += p.amount_paisa;
          else otherPaisa += p.amount_paisa;
        } else if (p.direction === 'out' && p.type === 'refund') {
          totalRefundedPaisa += p.amount_paisa;
          if (p.method === 'cash') cashPaisa -= p.amount_paisa;
          else if (p.method === 'bkash') bkashPaisa -= p.amount_paisa;
          else if (p.method === 'nagad') nagadPaisa -= p.amount_paisa;
          else if (p.method === 'card') cardPaisa -= p.amount_paisa;
          else otherPaisa -= p.amount_paisa;
        }
      });

      // totalRefundedPaisa stays the cash that actually left the drawer; net
      // sales comes off the goods that came back, which is the larger figure
      // whenever a return was settled against a customer's balance.
      const netSalesPaisa = grossSalesPaisa - totalReturnedPaisa;

      // Daily trends, grouped on the same local-day expression as the totals so
      // the columns of the chart always add up to the header figures.
      const trendsMap: Record<string, { orders_count: number; sales_paisa: number; refunded_paisa: number }> = {};
      const trendRows = db.prepare(`
        SELECT ${saleDay} AS day,
               COUNT(id) AS orders_count,
               COALESCE(SUM(total_paisa), 0) AS sales_paisa
        FROM sales
        WHERE deleted_at IS NULL AND status != 'held'
          AND ${saleDay} BETWEEN ? AND ?
        GROUP BY day
      `).all(startDate, endDate) as any[];

      trendRows.forEach((row) => {
        trendsMap[row.day] = {
          orders_count: row.orders_count,
          sales_paisa: row.sales_paisa,
          refunded_paisa: 0,
        };
      });

      const trendRefundRows = db.prepare(`
        SELECT ${localDaySql('created_at')} AS day,
               COALESCE(SUM(amount_paisa), 0) AS refunded_paisa
        FROM payments
        WHERE deleted_at IS NULL 
          AND direction = 'out' 
          AND type = 'refund'
          AND ${localDaySql('created_at')} BETWEEN ? AND ?
        GROUP BY day
      `).all(startDate, endDate) as any[];

      trendRefundRows.forEach((row) => {
        if (!trendsMap[row.day]) {
          trendsMap[row.day] = { orders_count: 0, sales_paisa: 0, refunded_paisa: 0 };
        }
        trendsMap[row.day].refunded_paisa = row.refunded_paisa;
      });

      // Populate daily trends for all dates in range
      const dailyTrends: Array<{ date: string; orders_count: number; sales_paisa: number; refunded_paisa: number }> = [];
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [eY, eM, eD] = endDate.split('-').map(Number);
      const curr = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
      const last = new Date(eY, eM - 1, eD, 0, 0, 0, 0);
  
      if (!isNaN(curr.getTime()) && !isNaN(last.getTime()) && curr <= last) {
        while (curr <= last) {
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, '0');
          const day = String(curr.getDate()).padStart(2, '0');
          const key = `${year}-${month}-${day}`;
          dailyTrends.push({
            date: key,
            orders_count: trendsMap[key]?.orders_count || 0,
            sales_paisa: trendsMap[key]?.sales_paisa || 0,
            refunded_paisa: trendsMap[key]?.refunded_paisa || 0,
          });
          curr.setDate(curr.getDate() + 1);
        }
      } else {
        Object.keys(trendsMap).sort().forEach(key => {
          dailyTrends.push({
            date: key,
            orders_count: trendsMap[key].orders_count,
            sales_paisa: trendsMap[key].sales_paisa,
            refunded_paisa: trendsMap[key].refunded_paisa,
          });
        });
      }
  
      return {
        start_date: startDate,
        end_date: endDate,
        total_orders: totalOrders,
        subtotal_paisa: subtotalPaisa,
        discount_paisa: discountPaisa,
        gross_sales_paisa: grossSalesPaisa,
        refunds_count: refundsCount,
        total_refunded_paisa: totalRefundedPaisa,
        total_returned_paisa: totalReturnedPaisa,
        net_sales_paisa: netSalesPaisa,
        payments_breakdown: {
          cash_paisa: cashPaisa,
          bkash_paisa: bkashPaisa,
          nagad_paisa: nagadPaisa,
          card_paisa: cardPaisa,
          other_paisa: otherPaisa,
        },
        daily_trends: dailyTrends,
      };
    });

  // Profit Report
  ipcMain.handle('api:reports:getProfitReport', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      const schema = z.object({
        startDate: z.string().min(1),
        endDate: z.string().min(1),
      });
      const { startDate, endDate } = schema.parse(rawArgs);
      const db = getDb();
  
      /*
       * Line rows plus the header figures needed to charge each line its share
       * of any whole-invoice discount. Revenue used to be summed from line
       * prices alone, so every taka taken off at the counter was booked as
       * profit and this report disagreed with the sales report.
       *
       * Filtered by the database rather than in JS. Allocating the invoice
       * discount still sees every line of each invoice it touches, because the
       * lines of one sale all carry that sale's created_at - a sale is either
       * wholly inside the range or wholly outside it, and a line can never be
       * separated from its siblings by this filter.
       */
      const matchingProfits = db.prepare(`
        SELECT
          si.id as sale_item_id,
          si.sale_id,
          COALESCE(p.id, si.product_id) as product_id,
          COALESCE(p.name, 'Deleted Product') as product_name,
          p.barcode,
          COALESCE(si.unit_cost_paisa, p.cost_price_paisa, 0) as cost_price_paisa,
          si.qty,
          (si.unit_price_paisa * si.qty - si.discount_paisa) as gross_paisa,
          COALESCE((SELECT SUM(qty) FROM return_items WHERE sale_item_id = si.id), 0) as returned_qty,
          COALESCE((SELECT SUM(amount_paisa) FROM return_items WHERE sale_item_id = si.id), 0) as returned_paisa,
          s.discount_paisa as sale_discount_paisa,
          s.created_at
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        WHERE s.deleted_at IS NULL AND s.status != 'held' AND si.deleted_at IS NULL
          AND ${localDaySql('s.created_at')} BETWEEN ? AND ?
      `).all(startDate, endDate) as any[];

      const bySale: Record<string, any[]> = {};
      matchingProfits.forEach((it) => {
        (bySale[it.sale_id] = bySale[it.sale_id] || []).push(it);
      });
      const discountByItem: Record<string, number> = {};
      Object.values(bySale).forEach((lines) => {
        const alloc = allocateSaleDiscount(
          lines.map((l) => ({ id: l.sale_item_id, grossPaisa: l.gross_paisa })),
          lines[0].sale_discount_paisa || 0
        );
        Object.assign(discountByItem, alloc);
      });

      const profitByProduct: Record<string, any> = {};
      let totalRevenue = 0;
      let totalCogs = 0;
      let totalDiscounts = 0;

      matchingProfits.forEach((it) => {
        const lineDiscountPaisa = discountByItem[it.sale_item_id] || 0;
        const qtySold = it.qty - it.returned_qty;
        const revenuePaisa = it.gross_paisa - lineDiscountPaisa - it.returned_paisa;
        const costPaisa = it.cost_price_paisa * qtySold;

        // A line returned in full contributes nothing either way.
        if (qtySold <= 0 && revenuePaisa <= 0) return;

        const pId = it.product_id;
        if (!profitByProduct[pId]) {
          profitByProduct[pId] = {
            product_id: it.product_id,
            product_name: it.product_name,
            barcode: it.barcode,
            cost_price_paisa: it.cost_price_paisa,
            qty_sold: 0,
            revenue_paisa: 0,
            cost_paisa: 0,
            discount_paisa: 0,
            profit_paisa: 0,
            margin_percent: 0,
          };
        }
        profitByProduct[pId].qty_sold += qtySold;
        profitByProduct[pId].revenue_paisa += revenuePaisa;
        profitByProduct[pId].cost_paisa += costPaisa;
        profitByProduct[pId].discount_paisa += lineDiscountPaisa;
        totalRevenue += revenuePaisa;
        totalCogs += costPaisa;
        totalDiscounts += lineDiscountPaisa;
      });

      const list = Object.values(profitByProduct).map((item: any) => {
        const profit = item.revenue_paisa - item.cost_paisa;
        const margin = item.revenue_paisa > 0 ? Math.round((profit / item.revenue_paisa) * 100) : 0;
        return {
          ...item,
          profit_paisa: profit,
          margin_percent: margin,
        };
      }).sort((a, b) => b.revenue_paisa - a.revenue_paisa);

      const grossProfit = totalRevenue - totalCogs;
      const overallMargin = totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(1)) : 0;
  
      return {
        start_date: startDate,
        end_date: endDate,
        total_revenue_paisa: totalRevenue,
        total_cogs_paisa: totalCogs,
        gross_profit_paisa: grossProfit,
        total_discounts_paisa: totalDiscounts,
        net_profit_paisa: grossProfit,
        profit_margin_percent: overallMargin,
        product_profits: list,
      };
    });

  // Best Selling Products (Supports optional date range and limit)
  ipcMain.handle('api:reports:getBestSelling', async (_event, rawArgs) => {
      requireRole(['owner', 'staff']);
      let limit = 10;
      let startDate: string | undefined;
      let endDate: string | undefined;
  
      if (typeof rawArgs === 'number') {
        limit = rawArgs;
      } else if (typeof rawArgs === 'object' && rawArgs !== null) {
        limit = rawArgs.limit || 10;
        startDate = rawArgs.startDate;
        endDate = rawArgs.endDate;
      }
  
      const db = getDb();

      // The date range, when given, is a WHERE clause rather than a pass over
      // every line the shop has ever sold.
      const ranged = Boolean(startDate && endDate);
      const filtered = db.prepare(`
        SELECT
          COALESCE(p.id, si.product_id) as product_id,
          COALESCE(p.name, 'Deleted Product') as product_name,
          p.barcode,
          c.name as category_name,
          (si.qty - COALESCE((SELECT SUM(qty) FROM return_items WHERE sale_item_id = si.id), 0)) as qty_sold,
          (
            (si.unit_price_paisa * si.qty - si.discount_paisa) -
            COALESCE((SELECT SUM(amount_paisa) FROM return_items WHERE sale_item_id = si.id), 0)
          ) as revenue_paisa,
          s.created_at
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE s.deleted_at IS NULL AND s.status != 'held'
          ${ranged ? `AND ${localDaySql('s.created_at')} BETWEEN ? AND ?` : ''}
      `).all(...(ranged ? [startDate, endDate] : [])) as any[];

      const grouped: Record<string, any> = {};
      filtered.forEach((it) => {
        // A line returned in full sold nothing and earned nothing, so it does
        // not belong in a list of what sold best. Left in JS rather than moved
        // into the WHERE clause because both figures are computed columns.
        if (it.qty_sold <= 0 && it.revenue_paisa <= 0) return;

        const pId = it.product_id;
        if (!grouped[pId]) {
          grouped[pId] = {
            product_id: it.product_id,
            product_name: it.product_name,
            barcode: it.barcode,
            category_name: it.category_name,
            qty_sold: 0,
            revenue_paisa: 0,
          };
        }
        grouped[pId].qty_sold += it.qty_sold;
        grouped[pId].revenue_paisa += it.revenue_paisa;
      });
  
      return Object.values(grouped)
        .sort((a: any, b: any) => b.qty_sold - a.qty_sold)
        .slice(0, limit);
    });

  // Stock Valuation Report
  /*
   * What the shop is owed, and what it owes.
   *
   * Deliberately takes no date range. Every other report on this page answers
   * "over these dates"; a due is a balance and only ever means "right now" -
   * asking what was outstanding across a fortnight has no answer. The caller
   * gets `as_of` so the screen can say which moment it is showing.
   *
   * Receivable comes from v_customer_due (sales minus payments, refunds already
   * netted off by migration 002) rather than a stored column, so it cannot
   * drift from the ledger it is summarising.
   */
  ipcMain.handle('api:reports:getDueReport', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();

      const receivables = db.prepare(`
        SELECT
          c.id, c.name, c.phone,
          COALESCE(vd.total_sales_paisa, 0) AS total_sales_paisa,
          COALESCE(vd.total_paid_paisa, 0)  AS total_paid_paisa,
          COALESCE(vd.due_paisa, 0)         AS due_paisa,
          (
            SELECT MAX(s.created_at) FROM sales s
            WHERE s.customer_id = c.id AND s.deleted_at IS NULL AND s.status != 'held'
          ) AS last_sale_at
        FROM customers c
        LEFT JOIN v_customer_due vd ON c.id = vd.customer_id
        WHERE c.deleted_at IS NULL AND COALESCE(vd.due_paisa, 0) > 0
        ORDER BY due_paisa DESC
      `).all() as any[];

      const payables = db.prepare(`
        SELECT id, name, phone, contact_person, payment_terms_days,
               COALESCE(total_payable_paisa, 0) AS payable_paisa
        FROM suppliers
        WHERE deleted_at IS NULL AND COALESCE(total_payable_paisa, 0) > 0
        ORDER BY payable_paisa DESC
      `).all() as any[];

      const sum = (rows: any[], key: string) =>
        rows.reduce((total: number, row: any) => total + (row[key] || 0), 0);

      const totalReceivablePaisa = sum(receivables, 'due_paisa');
      const totalPayablePaisa = sum(payables, 'payable_paisa');

      // How many customers exist at all, so the screen can say "12 of 340 owe"
      // rather than a bare count with nothing to measure it against.
      const customerCount = (db.prepare(
        'SELECT COUNT(*) AS n FROM customers WHERE deleted_at IS NULL'
      ).get() as any).n as number;
      const supplierCount = (db.prepare(
        'SELECT COUNT(*) AS n FROM suppliers WHERE deleted_at IS NULL'
      ).get() as any).n as number;

      return {
        as_of: new Date().toISOString(),
        total_receivable_paisa: totalReceivablePaisa,
        total_payable_paisa: totalPayablePaisa,
        // Positive means more is owed to the shop than by it.
        net_position_paisa: totalReceivablePaisa - totalPayablePaisa,
        customers_with_due_count: receivables.length,
        total_customers_count: customerCount,
        suppliers_with_payable_count: payables.length,
        total_suppliers_count: supplierCount,
        receivables,
        payables,
      };
    });

  ipcMain.handle('api:reports:getStockValuation', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
  
      /*
       * Valued from the FIFO batches, not products.cost_price_paisa.
       *
       * Every purchase overwrites that column with its own landed cost, so
       * valuing stock by it prices goods bought months ago at today's rate: ten
       * filters at 250 and ten more at 400 cost 6,500, but the old sum reported
       * 8,000. The batches carry what was actually paid for what is actually
       * left - and that is the same cost the profit report bills a sale against,
       * so the two screens now answer with one definition of money.
       */
      const rows = db.prepare(`
        SELECT
          p.stock_qty,
          p.cost_price_paisa,
          p.sell_price_paisa,
          COALESCE(b.qty, 0) AS batch_qty,
          COALESCE(b.value_paisa, 0) AS batch_value_paisa
        FROM products p
        LEFT JOIN (
          SELECT product_id,
                 SUM(remaining_qty) AS qty,
                 SUM(remaining_qty * cost_price_paisa) AS value_paisa
          FROM inventory_batches
          WHERE remaining_qty > 0
          GROUP BY product_id
        ) b ON b.product_id = p.id
        WHERE p.deleted_at IS NULL
      `).all() as any[];

      let totalStockUnits = 0;
      let totalCostValuation = 0;
      let totalRetailValuation = 0;
      let driftProductCount = 0;
      let unbackedUnits = 0;

      rows.forEach((r) => {
        const qty = r.stock_qty || 0;
        totalStockUnits += qty;
        totalRetailValuation += (r.sell_price_paisa || 0) * qty;

        const batchQty = r.batch_qty || 0;
        totalCostValuation += r.batch_value_paisa || 0;

        if (qty > batchQty) {
          // Stock that no batch accounts for: rows predating batch tracking, or
          // a drift. Nothing records what these cost, so the product's own price
          // is the only figure there is - the old behaviour, now confined to the
          // units that actually need it.
          const missing = qty - batchQty;
          unbackedUnits += missing;
          totalCostValuation += missing * (r.cost_price_paisa || 0);
        }

        if (qty !== batchQty) driftProductCount += 1;
      });

      const potentialGrossProfit = totalRetailValuation - totalCostValuation;
      const potentialMargin = totalRetailValuation > 0
        ? parseFloat(((potentialGrossProfit / totalRetailValuation) * 100).toFixed(1))
        : 0;
      return {
        total_products_count: rows.length,
        total_stock_units: totalStockUnits,
        total_cost_valuation_paisa: totalCostValuation,
        total_retail_valuation_paisa: totalRetailValuation,
        potential_gross_profit_paisa: potentialGrossProfit,
        potential_margin_percent: potentialMargin,
        // Surfaced rather than swallowed: while these disagree the valuation is
        // an estimate, and the owner is the one who can go and count the shelf.
        drift_product_count: driftProductCount,
        unbacked_units: unbackedUnits,
      };
    });

}
