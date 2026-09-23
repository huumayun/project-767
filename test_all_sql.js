const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
const { localDaySql } = require('./dist-electron/ipc/shared.js');

const startDate = '2026-09-01';
const endDate = '2026-09-22';
const saleDay = localDaySql('created_at');

function testQuery(name, sql, params = []) {
  try {
    db.prepare(sql).all(...params);
    console.log(`[OK] ${name}`);
  } catch (e) {
    if (e.message.includes('run()')) {
      try {
        db.prepare(sql).get(...params);
        console.log(`[OK] ${name}`);
      } catch(e2) {
        console.error(`[FAIL] ${name}: ${e2.message}`);
      }
    } else {
      console.error(`[FAIL] ${name}: ${e.message}`);
    }
  }
}

// 1. getSalesReport totals
testQuery('getSalesReport totals', `
  SELECT COUNT(id) AS total_orders, COALESCE(SUM(total_paisa), 0) AS gross_sales_paisa
  FROM sales
  WHERE deleted_at IS NULL AND status != 'held' AND ${saleDay} BETWEEN ? AND ?
`, [startDate, endDate]);

testQuery('getSalesReport returnsAgg', `
  SELECT COUNT(*) AS refunds_count, COALESCE(SUM(amount_paisa), 0) AS returned_paisa
  FROM (
    SELECT r.id, COALESCE(SUM(ri.amount_paisa), 0) AS amount_paisa
    FROM returns r
    JOIN return_items ri ON ri.return_id = r.id
    WHERE r.deleted_at IS NULL AND ri.deleted_at IS NULL
      AND ${localDaySql('r.created_at')} BETWEEN ? AND ?
    GROUP BY r.id
  )
`, [startDate, endDate]);

testQuery('getSalesReport paymentGroups', `
  SELECT method, direction, type, COALESCE(SUM(amount_paisa), 0) AS amount_paisa
  FROM payments
  WHERE deleted_at IS NULL AND ${saleDay} BETWEEN ? AND ?
  GROUP BY method, direction, type
`, [startDate, endDate]);

testQuery('getSalesReport standaloneDue', `
  SELECT COALESCE(SUM(amount_paisa), 0) AS total
  FROM payments
  WHERE deleted_at IS NULL AND type = 'due_collection' AND direction = 'in'
    AND ${saleDay} BETWEEN ? AND ?
`, [startDate, endDate]);

testQuery('getSalesReport salesDue', `
  SELECT COALESCE(SUM(previous_due_paid_paisa), 0) AS total
  FROM sales
  WHERE deleted_at IS NULL AND status != 'held'
    AND ${saleDay} BETWEEN ? AND ?
`, [startDate, endDate]);

testQuery('getSalesReport standaloneDueDetails', `
  SELECT 
    p.created_at, 
    c.name as customer_name,
    'Standalone' as source,
    NULL as invoice_no,
    0 as bill_amount_paisa,
    p.amount_paisa as collected_paisa,
    p.method as payment_method
  FROM payments p
  LEFT JOIN customers c ON p.customer_id = c.id
  WHERE p.deleted_at IS NULL AND p.type = 'due_collection' AND p.direction = 'in'
    AND COALESCE(date(p.created_at, 'localtime'), substr(p.created_at, 1, 10)) BETWEEN ? AND ?
`, [startDate, endDate]);

testQuery('getSalesReport salesDueDetails', `
  SELECT 
    s.created_at,
    c.name as customer_name,
    'Invoice' as source,
    s.invoice_no,
    s.total_paisa as bill_amount_paisa,
    s.previous_due_paid_paisa as collected_paisa,
    'Mixed' as payment_method
  FROM sales s
  LEFT JOIN customers c ON s.customer_id = c.id
  WHERE s.deleted_at IS NULL AND s.status != 'held' AND s.previous_due_paid_paisa > 0
    AND COALESCE(date(s.created_at, 'localtime'), substr(s.created_at, 1, 10)) BETWEEN ? AND ?
`, [startDate, endDate]);

testQuery('getSalesReport trendRows', `
  SELECT ${saleDay} AS day,
         COUNT(id) AS orders_count,
         COALESCE(SUM(total_paisa), 0) AS sales_paisa
  FROM sales
  WHERE deleted_at IS NULL AND status != 'held'
    AND ${saleDay} BETWEEN ? AND ?
  GROUP BY day
`, [startDate, endDate]);

testQuery('getSalesReport trendRefundRows', `
  SELECT ${localDaySql('created_at')} AS day,
         COALESCE(SUM(amount_paisa), 0) AS refunded_paisa
  FROM payments
  WHERE deleted_at IS NULL 
    AND direction = 'out' 
    AND type = 'refund'
    AND ${localDaySql('created_at')} BETWEEN ? AND ?
  GROUP BY day
`, [startDate, endDate]);

// --- getProfitReport
testQuery('getProfitReport filtered', `
  SELECT
    si.id as sale_item_id,
    si.sale_id,
    COALESCE(p.id, si.product_id) as product_id,
    COALESCE(p.name, 'Deleted Product') as product_name,
    p.barcode,
    COALESCE(si.unit_cost_paisa, p.cost_price_paisa, 0) as cost_price_paisa,
    COALESCE((SELECT SUM(qty) FROM return_items WHERE sale_item_id = si.id), 0) as returned_qty,
    COALESCE((SELECT SUM(amount_paisa) FROM return_items WHERE sale_item_id = si.id), 0) as returned_paisa,
    s.discount_paisa as sale_discount_paisa,
    s.created_at
  FROM sale_items si
  JOIN sales s ON si.sale_id = s.id
  LEFT JOIN products p ON si.product_id = p.id
  WHERE s.deleted_at IS NULL AND s.status != 'held' AND si.deleted_at IS NULL
    AND ${localDaySql('s.created_at')} BETWEEN ? AND ?
`, [startDate, endDate]);

// --- getBestSelling
testQuery('getBestSelling filtered', `
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
    AND ${localDaySql('s.created_at')} BETWEEN ? AND ?
`, [startDate, endDate]);

