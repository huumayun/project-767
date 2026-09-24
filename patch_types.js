const fs = require('fs');
let c = fs.readFileSync('src/types/ipc.ts', 'utf8');

c = c.replace(
  /export interface Customer \{([\s\S]+?)\}/,
  (match, inner) => `export interface Customer {${inner}  initial_due_paisa?: number;\n}`
);

c = c.replace(
  /create: \(data: \{ name: string; phone\?: string \| null; address\?: string \| null; note\?: string \| null \}\) => Promise<Customer>;/,
  'create: (data: { name: string; phone?: string | null; address?: string | null; note?: string | null; initialDuePaisa?: number }) => Promise<Customer>;'
);

fs.writeFileSync('src/types/ipc.ts', c);
