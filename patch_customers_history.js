const fs = require('fs');
let c = fs.readFileSync('electron/ipc/routes/customers.ts', 'utf8');

c = c.replace(
  /const history: Array<\{([\s\S]+?)\}> = \[\];/,
  `const history: Array<{$1}> = [];
      if (initialDue > 0) {
        history.push({
          id: 'opening_balance',
          type: 'opening_balance' as any,
          date: customerRow.created_at,
          ref_no: 'Opening Balance',
          description: 'Previous Due Account Opening',
          debit_paisa: initialDue,
          credit_paisa: 0,
          seq: -1
        });
      }`
);

fs.writeFileSync('electron/ipc/routes/customers.ts', c);
