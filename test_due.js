const db = require('better-sqlite3')('C:/Users/humay/AppData/Roaming/fatema-electronics-pos/shop.db');
const sale = db.prepare("SELECT id, customer_id, created_at, previous_due_paid_paisa, total_paisa FROM sales WHERE invoice_no = 'INV-260923-0004'").get();
console.log(sale);

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
`).get(sale.created_at, sale.customer_id, sale.created_at, sale.customer_id, sale.created_at);

console.log('Historical Due:', historyDue.historical_due);
