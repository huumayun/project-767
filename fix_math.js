const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/sales.ts';
let content = fs.readFileSync(path, 'utf8');

// The incorrect logic in getByInvoice and generatePdf looks like:
/*
        let customerPreviousDuePaisa = 0;
        if (sale.customer_id) {
          const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(sale.customer_id) as any;
          if (dueRow) customerPreviousDuePaisa = dueRow.due_paisa;
        }
*/

// We need to replace it with:
/*
        let customerPreviousDuePaisa = 0;
        if (sale.customer_id) {
          const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(sale.customer_id) as any;
          const currentDue = dueRow ? dueRow.due_paisa : 0;
          customerPreviousDuePaisa = currentDue + (sale.previous_due_paid_paisa || 0) - duePaisa;
        }
*/

// Replace it globally in the file (it appears twice, once for getByInvoice, once for generatePdf)
const incorrectRegex = /let customerPreviousDuePaisa = 0;\s*if \(sale\.customer_id\) \{\s*const dueRow = db\.prepare\('SELECT due_paisa FROM v_customer_due WHERE customer_id = \?'\)\.get\(sale\.customer_id\) as any;\s*if \(dueRow\) customerPreviousDuePaisa = dueRow\.due_paisa;\s*\}/g;

const correctCode = `let customerPreviousDuePaisa = 0;
        if (sale.customer_id) {
          const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(sale.customer_id) as any;
          const currentDue = dueRow ? dueRow.due_paisa : 0;
          customerPreviousDuePaisa = currentDue + (sale.previous_due_paid_paisa || 0) - duePaisa;
        }`;

content = content.replace(incorrectRegex, correctCode);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed math in sales.ts');
