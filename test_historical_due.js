const Database = require('better-sqlite3');
const db = new Database(process.env.APPDATA + '\\fatema-electronics-pos\\shop.db');

const sale = db.prepare("SELECT * FROM sales WHERE invoice_no = 'INV-260923-0009'").get();

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

console.log("History due:", historyDue);
