const fs = require('fs');

let c = fs.readFileSync('electron/db/migrations.ts', 'utf8');

const newMigration = `
  {
    id: '010_initial_due_view',
    name: 'Update v_customer_due to include initial_due_paisa',
    up: (db: Database.Database) => {
      db.exec(\`
        DROP VIEW IF EXISTS v_customer_due;
        CREATE VIEW v_customer_due AS
        SELECT 
          c.id AS customer_id,
          c.name,
          c.phone,
          COALESCE(sales_total.sum_sales, 0) AS total_sales_paisa,
          COALESCE(payments_total.sum_payments, 0) AS total_paid_paisa,
          (c.initial_due_paisa + COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa
        FROM customers c
        LEFT JOIN (
          SELECT s.customer_id, 
                 SUM(s.total_paisa - COALESCE((
                   SELECT SUM(ri.amount_paisa) 
                   FROM returns r 
                   JOIN return_items ri ON r.id = ri.return_id 
                   WHERE r.sale_id = s.id
                 ), 0)) AS sum_sales 
          FROM sales s
          WHERE s.deleted_at IS NULL AND s.customer_id IS NOT NULL AND s.status != 'held'
          GROUP BY s.customer_id
        ) sales_total ON c.id = sales_total.customer_id
        LEFT JOIN (
          SELECT p.customer_id, 
                 SUM(CASE WHEN p.direction = 'in' THEN p.amount_paisa ELSE -p.amount_paisa END) AS sum_payments 
          FROM payments p
          WHERE p.deleted_at IS NULL AND p.customer_id IS NOT NULL
          GROUP BY p.customer_id
        ) payments_total ON c.id = payments_total.customer_id
        WHERE c.deleted_at IS NULL;
      \`);
    }
  },
`;

c = c.replace(
  /export const MIGRATIONS: Migration\[\] = \[/,
  'export const MIGRATIONS: Migration[] = [\n' + newMigration
);

fs.writeFileSync('electron/db/migrations.ts', c);
