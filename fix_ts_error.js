const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/sales.ts';
let content = fs.readFileSync(path, 'utf8');

const target = "const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(payload.customer_id);";
const replace = "const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(payload.customer_id) as any;";

content = content.replace(target, replace);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed typescript any error');
