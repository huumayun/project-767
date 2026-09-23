const db=require('better-sqlite3')('database.sqlite');
const res = db.prepare(`
  SELECT COALESCE(SUM(amount_paisa), 0) AS total
  FROM payments
  WHERE deleted_at IS NULL AND type = 'due_collection' AND direction = 'in'
`).get();
console.log('Total standalone due collected ever:', res.total);

const res2 = db.prepare(`
  SELECT COALESCE(SUM(amount_paisa), 0) AS total
  FROM payments
  WHERE deleted_at IS NULL AND type = 'due_collection' AND direction = 'in'
  AND date(created_at, '+6 hours') = '2026-09-22'
`).get();
console.log('Total standalone due collected today (+6 hrs):', res2.total);

const res3 = db.prepare(`
  SELECT COALESCE(SUM(amount_paisa), 0) AS total
  FROM payments
  WHERE deleted_at IS NULL AND type = 'due_collection' AND direction = 'in'
  AND date(created_at, 'localtime') = '2026-09-22'
`).get();
console.log('Total standalone due collected today (localtime):', res3.total);

