const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/shared.ts';
let content = fs.readFileSync(path, 'utf8');

const returnStatementRegex = /total_sales_paisa: totalSalesPaisa,/g;
content = content.replace(returnStatementRegex, 'total_sales_paisa: totalSalesPaisa,\n    cash_due_collected_paisa: cashDueCollectedPaisa,\n    other_due_collected_paisa: otherDueCollectedPaisa,');

fs.writeFileSync(path, content, 'utf8');
console.log('Patched shared.ts return statement');
