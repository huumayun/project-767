import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';


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
  
      // Fetch active sales and filter by local date reliably
      const rawSales = db.prepare(`
        SELECT * FROM sales
        WHERE deleted_at IS NULL AND status != 'held'
        ORDER BY created_at ASC
      `).all() as any[];
  
      const sales = rawSales.filter((s) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        let localDateKey = '';
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          localDateKey = `${year}-${month}-${day}`;
        } else {
          localDateKey = String(s.created_at).slice(0, 10);
        }
        return localDateKey >= startDate && localDateKey <= endDate;
      });
  
      let totalOrders = sales.length;
      let subtotalPaisa = 0;
      let discountPaisa = 0;
      let grossSalesPaisa = 0;
      let refundsCount = 0;
      let totalRefundedPaisa = 0;
  
      sales.forEach(s => {
        subtotalPaisa += s.subtotal_paisa;
        discountPaisa += s.discount_paisa;
        grossSalesPaisa += s.total_paisa;
        if (s.status === 'refunded') {
          refundsCount++;
        }
      });
  
      // Payments in date range
      const rawPayments = db.prepare(`
        SELECT method, direction, amount_paisa, type, created_at FROM payments
        WHERE deleted_at IS NULL
      `).all() as any[];
  
      const payments = rawPayments.filter((p) => {
        if (!p.created_at) return false;
        const d = new Date(p.created_at);
        let localDateKey = '';
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          localDateKey = `${year}-${month}-${day}`;
        } else {
          localDateKey = String(p.created_at).slice(0, 10);
        }
        return localDateKey >= startDate && localDateKey <= endDate;
      });
  
      let cashPaisa = 0;
      let bkashPaisa = 0;
      let nagadPaisa = 0;
      let cardPaisa = 0;
  
      payments.forEach(p => {
        if (p.direction === 'in') {
          if (p.method === 'cash') cashPaisa += p.amount_paisa;
          else if (p.method === 'bkash') bkashPaisa += p.amount_paisa;
          else if (p.method === 'nagad') nagadPaisa += p.amount_paisa;
          else if (p.method === 'card') cardPaisa += p.amount_paisa;
        } else if (p.direction === 'out' && p.type === 'refund') {
          totalRefundedPaisa += p.amount_paisa;
        }
      });
  
      const netSalesPaisa = grossSalesPaisa - totalRefundedPaisa;
  
      // Generate daily trends map with accurate local date grouping
      const trendsMap: Record<string, { orders_count: number; sales_paisa: number }> = {};
      sales.forEach(s => {
        const d = new Date(s.created_at);
        let localDateKey = '';
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          localDateKey = `${year}-${month}-${day}`;
        } else {
          localDateKey = String(s.created_at).slice(0, 10);
        }
  
        if (!trendsMap[localDateKey]) {
          trendsMap[localDateKey] = { orders_count: 0, sales_paisa: 0 };
        }
        trendsMap[localDateKey].orders_count += 1;
        trendsMap[localDateKey].sales_paisa += s.total_paisa;
      });
  
      // Populate daily trends for all dates in range
      const dailyTrends: Array<{ date: string; orders_count: number; sales_paisa: number }> = [];
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
          });
          curr.setDate(curr.getDate() + 1);
        }
      } else {
        Object.keys(trendsMap).sort().forEach(key => {
          dailyTrends.push({
            date: key,
            orders_count: trendsMap[key].orders_count,
            sales_paisa: trendsMap[key].sales_paisa,
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
        net_sales_paisa: netSalesPaisa,
        payments_breakdown: {
          cash_paisa: cashPaisa,
          bkash_paisa: bkashPaisa,
          nagad_paisa: nagadPaisa,
          card_paisa: cardPaisa,
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
  
      const rawProductProfits = db.prepare(`
        SELECT 
          COALESCE(p.id, si.product_id) as product_id,
          COALESCE(p.name, 'Deleted Product') as product_name,
          p.barcode,
          COALESCE(p.cost_price_paisa, si.unit_cost_paisa, 0) as cost_price_paisa,
          (si.qty - COALESCE((SELECT SUM(qty) FROM return_items WHERE sale_item_id = si.id), 0)) as qty_sold,
          (
            (si.unit_price_paisa * si.qty - si.discount_paisa) - 
            COALESCE((SELECT SUM(amount_paisa) FROM return_items WHERE sale_item_id = si.id), 0)
          ) as revenue_paisa,
          (
            COALESCE(si.unit_cost_paisa, p.cost_price_paisa, 0) * 
            (si.qty - COALESCE((SELECT SUM(qty) FROM return_items WHERE sale_item_id = si.id), 0))
          ) as cost_paisa,
          s.created_at
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        WHERE s.deleted_at IS NULL AND s.status != 'held'
      `).all() as any[];
  
      const matchingProfits = rawProductProfits.filter((it) => {
        if (!it.created_at) return false;
        // Only include items where net qty is > 0 or revenue > 0
        if (it.qty_sold <= 0 && it.revenue_paisa <= 0) return false;
        
        const d = new Date(it.created_at);
        let localDateKey = '';
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          localDateKey = `${year}-${month}-${day}`;
        } else {
          localDateKey = String(it.created_at).slice(0, 10);
        }
        return localDateKey >= startDate && localDateKey <= endDate;
      });
  
      const profitByProduct: Record<string, any> = {};
      let totalRevenue = 0;
      let totalCogs = 0;
  
      matchingProfits.forEach((it) => {
        const pId = it.product_id;
        if (!profitByProduct[pId]) {
          profitByProduct[pId] = {
            product_id: it.product_id,
            product_name: it.product_name,
            barcode: it.barcode,
            qty_sold: 0,
            revenue_paisa: 0,
            cost_paisa: 0,
            profit_paisa: 0,
            margin_percent: 0,
          };
        }
        profitByProduct[pId].qty_sold += it.qty_sold;
        profitByProduct[pId].revenue_paisa += it.revenue_paisa;
        profitByProduct[pId].cost_paisa += it.cost_paisa;
        totalRevenue += it.revenue_paisa;
        totalCogs += it.cost_paisa;
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
        total_discounts_paisa: 0,
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
  
      const rawRows = db.prepare(`
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
      `).all() as any[];
  
      const filtered = (startDate && endDate)
        ? rawRows.filter((it) => {
            if (!it.created_at) return false;
            if (it.qty_sold <= 0 && it.revenue_paisa <= 0) return false;
            const d = new Date(it.created_at);
            let localDateKey = '';
            if (!isNaN(d.getTime())) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              localDateKey = `${year}-${month}-${day}`;
            } else {
              localDateKey = String(it.created_at).slice(0, 10);
            }
            return localDateKey >= startDate && localDateKey <= endDate;
          })
        : rawRows.filter(it => it.qty_sold > 0 || it.revenue_paisa > 0);
  
      const grouped: Record<string, any> = {};
      filtered.forEach((it) => {
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
  ipcMain.handle('api:reports:getStockValuation', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
  
      const products = db.prepare(`
        SELECT cost_price_paisa, sell_price_paisa, stock_qty
        FROM products
        WHERE deleted_at IS NULL
      `).all() as any[];
  
      let totalItemsCount = products.length;
      let totalStockUnits = 0;
      let totalCostValuation = 0;
      let totalRetailValuation = 0;
  
      products.forEach(p => {
        const qty = p.stock_qty || 0;
        totalStockUnits += qty;
        totalCostValuation += p.cost_price_paisa * qty;
        totalRetailValuation += p.sell_price_paisa * qty;
      });
  
      const potentialGrossProfit = totalRetailValuation - totalCostValuation;
      const potentialMargin = totalRetailValuation > 0
        ? parseFloat(((potentialGrossProfit / totalRetailValuation) * 100).toFixed(1))
        : 0;
      return {
        total_products_count: totalItemsCount,
        total_stock_units: totalStockUnits,
        total_cost_valuation_paisa: totalCostValuation,
        total_retail_valuation_paisa: totalRetailValuation,
        potential_gross_profit_paisa: potentialGrossProfit,
        potential_margin_percent: potentialMargin,
      };
    });

}
