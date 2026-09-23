const fs = require('fs');
let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

c = c.replace(/INSERT INTO sales \([\s\n\r]*id, invoice_no, status, customer_id, subtotal_paisa, discount_paisa, total_paisa,[\s\n\r]*user_id, device_id, created_at, updated_at[\s\n\r]*\) VALUES \(\?, \?, 'completed', \?, \?, \?, \?, \?, \?, \?, \?\)/,
  `INSERT INTO sales (
            id, invoice_no, status, customer_id, subtotal_paisa, discount_paisa, total_paisa,
            user_id, device_id, created_at, updated_at, previous_due_paid_paisa
          ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

c = c.replace(/saleId, invoiceNo, payload\.customer_id \|\| null, payload\.subtotal_paisa,[\s\n\r]*payload\.discount_paisa, payload\.total_paisa, userId, deviceId, now, now[\s\n\r]*\);/,
  `saleId, invoiceNo, payload.customer_id || null, payload.subtotal_paisa,
            payload.discount_paisa, payload.total_paisa, userId, deviceId, now, now, payload.previous_due_paid_paisa || 0
          );`);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
