const fs = require('fs');
let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

c = c.replace(
  `INSERT INTO sales (
              id, invoice_no, status, customer_id, subtotal_paisa, discount_paisa, total_paisa,
              user_id, device_id, created_at, updated_at
            ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?)
          \`).run(
            saleId, invoiceNo, payload.customer_id || null, payload.subtotal_paisa,
            payload.discount_paisa, payload.total_paisa, userId, deviceId, now, now
          );`,
  `INSERT INTO sales (
              id, invoice_no, status, customer_id, subtotal_paisa, discount_paisa, total_paisa,
              user_id, device_id, created_at, updated_at, previous_due_paid_paisa
            ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          \`).run(
            saleId, invoiceNo, payload.customer_id || null, payload.subtotal_paisa,
            payload.discount_paisa, payload.total_paisa, userId, deviceId, now, now, payload.previous_due_paid_paisa || 0
          );`
);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
