const fs = require('fs');
let c = fs.readFileSync('electron/db/migrations.ts', 'utf8');
c = c.replace(
  /deleted_at TEXT\r?\n\s+\);/,
  'deleted_at TEXT,\n        initial_due_paisa INTEGER NOT NULL DEFAULT 0\n      );'
);
fs.writeFileSync('electron/db/migrations.ts', c);
