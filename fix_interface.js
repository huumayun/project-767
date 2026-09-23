const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let content = fs.readFileSync(path, 'utf8');

const target = "customerAddress?: string | null;";
const replace = "customerAddress?: string | null;\n  customerPreviousDuePaisa?: number;\n  previousDuePaidPaisa?: number;\n  customerRemainingDuePaisa?: number;";

content = content.replace(target, replace);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed interface!');
