const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/types/ipc.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /net_sales_paisa: number;\s*payments_breakdown:/g,
  'net_sales_paisa: number;\n    due_collection_paisa: number;\n    payments_breakdown:'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ipc.ts types');
