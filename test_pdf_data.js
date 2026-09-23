const { app } = require('electron');
const Database = require('better-sqlite3');
const db = new Database(process.env.APPDATA + '\\fatema-electronics-pos\\shop.db');

app.whenReady().then(() => {
  const sale = db.prepare("SELECT * FROM sales WHERE invoice_no = 'INV-260923-0009'").get();
  
  const returnedPaisa = (db.prepare(`
    SELECT COALESCE(SUM(ri.amount_paisa), 0) AS n
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    WHERE r.sale_id = ? AND r.deleted_at IS NULL AND ri.deleted_at IS NULL
  `).get(sale.id)).n;

  const refundedPaisa = (db.prepare(`
    SELECT COALESCE(SUM(amount_paisa), 0) AS n FROM payments
    WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND deleted_at IS NULL
  `).get(sale.id)).n;

  const payments = db.prepare(
    `SELECT * FROM payments WHERE sale_id = ? AND direction = 'in' AND deleted_at IS NULL`
  ).all(sale.id);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount_paisa, 0);

  const duePaisa = Math.max(0, (sale.total_paisa - returnedPaisa) - (totalPaid - refundedPaisa));

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
  
  const customerPreviousDuePaisa = historyDue ? historyDue.historical_due : 0;
  
  const pdfData = {
    totalPaisa: sale.total_paisa,
    totalPaidPaisa: totalPaid,
    duePaisa,
    customerPreviousDuePaisa: sale.customer_id ? customerPreviousDuePaisa : undefined,
    previousDuePaidPaisa: sale.customer_id ? (sale.previous_due_paid_paisa || 0) : undefined,
    customerRemainingDuePaisa: sale.customer_id ? customerPreviousDuePaisa - (sale.previous_due_paid_paisa || 0) + duePaisa : undefined,
  };

  console.log("PDF Data:", pdfData);
  app.quit();
});
