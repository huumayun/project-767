const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/reports.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace('dueCollectionPaisa,\n        returnsCount: refundsCount,', 'due_collection_paisa: dueCollectionPaisa,\n        returnsCount: refundsCount,');
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed property name in reports.ts');
