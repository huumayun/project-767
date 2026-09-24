const fs = require('fs');

let c1 = fs.readFileSync('src/types/ipc.ts', 'utf8');
c1 = c1.replace(/'sale' \| 'payment' \| 'return' \| 'refund'/g, "'sale' | 'payment' | 'return' | 'refund' | 'opening_balance'");
fs.writeFileSync('src/types/ipc.ts', c1);

let c2 = fs.readFileSync('electron/ipc/routes/customers.ts', 'utf8');
c2 = c2.replace(/'sale' \| 'payment' \| 'return' \| 'refund'/g, "'sale' | 'payment' | 'return' | 'refund' | 'opening_balance'");
fs.writeFileSync('electron/ipc/routes/customers.ts', c2);
