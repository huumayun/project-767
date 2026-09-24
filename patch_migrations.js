const fs = require('fs');
let c = fs.readFileSync('electron/db/migrations.ts', 'utf8');

c = c.replace(
  '      deleted_at TEXT\n      );',
  '      deleted_at TEXT,\n      initial_due_paisa INTEGER NOT NULL DEFAULT 0\n      );'
);

c = c.replace(
  'COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa',
  'c.initial_due_paisa + COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa'
);

const usersRegex = /users:\s*\{\s*pin_code:\s*'TEXT',\s*\},\r?\n/m;
c = c.replace(usersRegex, `users: {\n      pin_code: 'TEXT',\n    },\n    customers: {\n      initial_due_paisa: 'INTEGER NOT NULL DEFAULT 0',\n    },\n`);

fs.writeFileSync('electron/db/migrations.ts', c);
