const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/types/ipc.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  'net_sales_paisa: number;\n    payments_breakdown:',
  'net_sales_paisa: number;\n    due_collection_paisa: number;\n    payments_breakdown:'
);

content = content.replace(
  'net_sales_paisa?: number;\n    /** What those goods cost, at the FIFO cost captured on each sale line. */',
  'net_sales_paisa?: number;\n    cash_due_collected_paisa?: number;\n    other_due_collected_paisa?: number;\n    /** What those goods cost, at the FIFO cost captured on each sale line. */'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ipc.ts types');
