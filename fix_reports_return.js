const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/reports.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  'net_sales_paisa: netSalesPaisa,',
  'net_sales_paisa: netSalesPaisa,\n          due_collection_paisa: dueCollectionPaisa,'
);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed property in return statement in reports.ts');
