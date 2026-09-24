const fs = require('fs');
let c = fs.readFileSync('electron/db/migrations.ts', 'utf8');

// The file might be messy now. Let's reset from git
const { execSync } = require('child_process');
execSync('git checkout electron/db/migrations.ts');

c = fs.readFileSync('electron/db/migrations.ts', 'utf8');

// Fix Customer Table
c = c.replace(
  /CREATE TABLE IF NOT EXISTS customers \([\s\S]+?deleted_at TEXT\s*\);/,
  (match) => match.replace('deleted_at TEXT', 'deleted_at TEXT,\n        initial_due_paisa INTEGER NOT NULL DEFAULT 0')
);

// Fix v_customer_due
c = c.replace(
  /\(COALESCE\(sales_total\.sum_sales, 0\) - COALESCE\(payments_total\.sum_payments, 0\)\) AS due_paisa/,
  '(c.initial_due_paisa + COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa'
);

// Add to ADDITIVE_COLUMNS
const usersRegex = /users:\s*\{\s*pin_code:\s*'TEXT',\s*\},\r?\n/m;
c = c.replace(usersRegex, `users: {\n      pin_code: 'TEXT',\n    },\n    customers: {\n      initial_due_paisa: 'INTEGER NOT NULL DEFAULT 0',\n    },\n`);

fs.writeFileSync('electron/db/migrations.ts', c);
