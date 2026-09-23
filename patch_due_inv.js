const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/customers.ts', 'utf8');

const t1 = `invoiceNo = generateInvoiceNumber(db);`;
const r1 = `const nowObj = new Date();
      const datePart = nowObj.getFullYear().toString().slice(-2) +
        (nowObj.getMonth() + 1).toString().padStart(2, '0') +
        nowObj.getDate().toString().padStart(2, '0');
      const prefix = \`DUE-\${datePart}-\`;
      const row = db.prepare(\`
        SELECT MAX(CAST(substr(invoice_no, ?) AS INTEGER)) AS max_serial
        FROM sales
        WHERE invoice_no LIKE ?
      \`).get(prefix.length + 1, \`\${prefix}%\`) as any;
      const nextSerial = (row?.max_serial || 0) + 1;
      invoiceNo = \`\${prefix}\${nextSerial.toString().padStart(4, '0')}\`;`;

c = c.replace(t1, r1);

fs.writeFileSync('electron/ipc/routes/customers.ts', c);
