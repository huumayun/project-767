const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/sales.ts';
let content = fs.readFileSync(path, 'utf8');

const fetchRe = /let customerInfo: any = null;\s*if \(payload\.customer_id\) \{\s*customerInfo = db\.prepare\('SELECT name, phone, address FROM customers WHERE id =\s*\?'\)\.get\(payload\.customer_id\);\s*\}/;
const fetchRep = `let customerInfo: any = null;
        let customerPreviousDuePaisa = 0;
        if (payload.customer_id) {
          customerInfo = db.prepare('SELECT name, phone, address FROM customers WHERE id = ?').get(payload.customer_id);
          const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(payload.customer_id);
          if (dueRow) customerPreviousDuePaisa = dueRow.due_paisa;
        }`;

content = content.replace(fetchRe, fetchRep);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed sales2');
