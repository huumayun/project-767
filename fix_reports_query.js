const fs = require('fs');

const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/reports.ts';
let content = fs.readFileSync(path, 'utf8');

// The standalone query has: AND ${saleDay} BETWEEN ? AND ?
// Change to: AND date(p.created_at, '+6 hours') BETWEEN ? AND ?
content = content.replace(
  /WHERE p\.deleted_at IS NULL AND p\.type = 'due_collection' AND p\.direction = 'in'\s+AND \$\{saleDay\} BETWEEN \? AND \?/,
  "WHERE p.deleted_at IS NULL AND p.type = 'due_collection' AND p.direction = 'in'\n          AND date(p.created_at, '+6 hours') BETWEEN ? AND ?"
);

// The sales due query has: AND ${saleDay} BETWEEN ? AND ?
// Change to: AND date(s.created_at, '+6 hours') BETWEEN ? AND ?
content = content.replace(
  /WHERE s\.deleted_at IS NULL AND s\.status != 'held' AND s\.previous_due_paid_paisa > 0\s+AND \$\{saleDay\} BETWEEN \? AND \?/,
  "WHERE s.deleted_at IS NULL AND s.status != 'held' AND s.previous_due_paid_paisa > 0\n          AND date(s.created_at, '+6 hours') BETWEEN ? AND ?"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ambiguous column names in getSalesReport');
