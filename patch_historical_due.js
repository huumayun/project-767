const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

const newQuery = `
              const historyDue = db.prepare(\`
                SELECT 
                  COALESCE((SELECT initial_due_paisa FROM customers WHERE id = ?), 0) +
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
              \`).get(sale.customer_id, sale.created_at, sale.customer_id, sale.created_at, sale.customer_id, sale.created_at) as any;
`;

c = c.replace(
  /const historyDue = db\.prepare\(`[\s\S]+?`\)\.get\([^)]+\) as any;/,
  newQuery.trim()
);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
