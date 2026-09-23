const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/customers.ts', 'utf8');

c = c.replace(/db\.transaction\(\(\) => \{\s+db\.prepare\(\`\s+INSERT INTO payments \(\s+id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at\s+\) VALUES \(\?, \?, 'in', \?, \?, 'due_collection', \?, \?, \?, \?\)\s+\`\)\.run\(paymentId, payload\.customer_id, payload\.method, amountPaisa, userId, deviceId, now, now\);\s+\}\)\(\);/m, `    const saleId = uuidv7();
    let invoiceNo = '';

    const writeTransaction = db.transaction(() => {
      invoiceNo = generateInvoiceNumber(db);
      db.prepare(\`
        INSERT INTO sales (
          id, invoice_no, status, subtotal_paisa, discount_paisa, total_paisa,
          customer_id, user_id, device_id, created_at, updated_at,
          previous_due_paid_paisa
        ) VALUES (?, ?, 'completed', 0, 0, 0, ?, ?, ?, ?, ?, ?)
      \`).run(saleId, invoiceNo, payload.customer_id, userId, deviceId, now, now, amountPaisa);

      db.prepare(\`
        INSERT INTO payments (
          id, sale_id, customer_id, direction, method, amount_paisa, type, user_id, device_id, created_at, updated_at
        ) VALUES (?, ?, ?, 'in', ?, ?, 'sale_payment', ?, ?, ?, ?)
      \`).run(paymentId, saleId, payload.customer_id, payload.method, amountPaisa, userId, deviceId, now, now);
    });

    for (let attempt = 1; ; attempt++) {
      try {
        writeTransaction();
        break;
      } catch (err) {
        if (attempt >= 5 || !isInvoiceNumberCollision(err)) throw err;
      }
    }`);

fs.writeFileSync('electron/ipc/routes/customers.ts', c);
