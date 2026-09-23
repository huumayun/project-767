const Database = require('better-sqlite3');
const db = new Database(process.env.APPDATA + '\\fatema-electronics-pos\\shop.db');

const sale = db.prepare('SELECT * FROM sales ORDER BY created_at DESC LIMIT 1').get();
console.log("Last Sale:", sale);

const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id);
console.log("Payments for last sale:", payments);

const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(sale.customer_id);
console.log("Customer:", customer);

const all_sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at ASC').all(sale.customer_id);
console.log("All sales for customer:");
all_sales.forEach(s => console.log(s.created_at, s.invoice_no, "total:", s.total_paisa, "prev_due_paid:", s.previous_due_paid_paisa));

const all_payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at ASC').all(sale.customer_id);
console.log("All payments for customer:");
all_payments.forEach(p => console.log(p.created_at, "amount:", p.amount_paisa, "type:", p.type, "sale_id:", p.sale_id));
