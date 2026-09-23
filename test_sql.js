const db=require('better-sqlite3')('database.sqlite');
try {
  db.prepare(`
    SELECT p.created_at FROM payments p
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE p.deleted_at IS NULL AND p.type = 'due_collection' AND p.direction = 'in'
    AND date(p.created_at, '+6 hours') BETWEEN '2026-09-22' AND '2026-09-22'
  `).all();
  console.log('OK1');
  
  db.prepare(`
    SELECT s.created_at FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    WHERE s.deleted_at IS NULL AND s.status != 'held' AND s.previous_due_paid_paisa > 0
    AND date(s.created_at, '+6 hours') BETWEEN '2026-09-22' AND '2026-09-22'
  `).all();
  console.log('OK2');
} catch(e) {
  console.error(e.message);
}
