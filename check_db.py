import sqlite3
import os

db_path = os.path.expandvars(r'%APPDATA%\fatema-electronics-pos\shop.db')
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

sale = cur.execute('SELECT * FROM sales ORDER BY created_at DESC LIMIT 1').fetchone()
print("Last Sale:", dict(sale))

payments = cur.execute('SELECT * FROM payments WHERE sale_id = ?', (sale['id'],)).fetchall()
print("Payments for last sale:", [dict(p) for p in payments])

customer = cur.execute('SELECT * FROM customers WHERE id = ?', (sale['customer_id'],)).fetchone()
print("Customer:", dict(customer))

print("\nAll sales for customer:")
all_sales = cur.execute('SELECT * FROM sales WHERE customer_id = ? ORDER BY created_at ASC', (sale['customer_id'],)).fetchall()
for s in all_sales:
    print(s['created_at'], s['invoice_no'], "total:", s['total_paisa'], "prev_due_paid:", s['previous_due_paid_paisa'])

print("\nAll payments for customer:")
all_payments = cur.execute('SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at ASC', (sale['customer_id'],)).fetchall()
for p in all_payments:
    print(p['created_at'], "amount:", p['amount_paisa'], "type:", p['type'], "sale_id:", p['sale_id'])
