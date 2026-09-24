const fs = require('fs');
let c = fs.readFileSync('electron/ipc/routes/customers.ts', 'utf8');

// 1. Update Schema
c = c.replace(
  /const createCustomerSchema = z\.object\(\{([\s\S]+?)\}\);/,
  (match, inner) => {
    return `const createCustomerSchema = z.object({${inner}  initialDuePaisa: z.number().optional().default(0),\n});`;
  }
);

// 2. Update insert query
c = c.replace(
  /INSERT INTO customers \(id, name, phone, address, note, device_id, created_at, updated_at\)\s*VALUES \(\?, \?, \?, \?, \?, \?, \?, \?\)/,
  'INSERT INTO customers (id, name, phone, address, note, device_id, created_at, updated_at, initial_due_paisa)\n        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

c = c.replace(
  /\.run\(id, payload\.name, payload\.phone, payload\.address, payload\.note, payload\.device_id, now, now\);/,
  '.run(id, payload.name, payload.phone, payload.address, payload.note, payload.device_id, now, now, payload.initialDuePaisa || 0);'
);

// 3. Update getHistory
c = c.replace(
  /const returns = db\.prepare\(`/g,
  `const customerRow = db.prepare('SELECT initial_due_paisa, created_at FROM customers WHERE id = ?').get(customerId) as any;
      const initialDue = customerRow?.initial_due_paisa || 0;
      
      const returns = db.prepare(\``
);

c = c.replace(
  /const combined = \[\.\.\.sales, \.\.\.returns, \.\.\.payments\]\./,
  `const combined = [...sales, ...returns, ...payments];
      if (initialDue > 0) {
        combined.push({
          id: 'opening_balance',
          type: 'opening_balance',
          ref_no: 'Opening Balance',
          amount_paisa: initialDue,
          created_at: customerRow.created_at
        });
      }
      combined.`
);

fs.writeFileSync('electron/ipc/routes/customers.ts', c);
