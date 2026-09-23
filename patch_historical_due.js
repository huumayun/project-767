const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

const t = `        let customerPreviousDuePaisa = 0;
          if (sale.customer_id) {
            const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(sale.customer_id) as any;
            const currentDue = dueRow ? dueRow.due_paisa : 0;
            customerPreviousDuePaisa = currentDue + (sale.previous_due_paid_paisa || 0) - duePaisa;
          }`;

const r = `        let customerPreviousDuePaisa = 0;
          if (sale.customer_id) {
            const historyDue = db.prepare(\`
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
            \`).get(sale.created_at, sale.customer_id, sale.created_at, sale.customer_id, sale.created_at) as any;
            
            customerPreviousDuePaisa = historyDue ? historyDue.historical_due : 0;
          }`;

// Let's use robust whitespace replacement just in case indentation differs
c = c.replace(/let customerPreviousDuePaisa = 0;[\s\n\r]*if \(sale\.customer_id\) \{[\s\n\r]*const dueRow = db\.prepare\('SELECT due_paisa FROM v_customer_due WHERE customer_id = \?'\)\.get\(sale\.customer_id\) as any;[\s\n\r]*const currentDue = dueRow \? dueRow\.due_paisa : 0;[\s\n\r]*customerPreviousDuePaisa = currentDue \+ \(sale\.previous_due_paid_paisa \|\| 0\) - duePaisa;[\s\n\r]*\}/g, r);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
