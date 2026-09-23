const fs = require('fs');

const path = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /money\(data\.customerPreviousDuePaisa\)/g,
  'money(data.customerPreviousDuePaisa || 0)'
);
content = content.replace(
  /money\(data\.previousDuePaidPaisa\)/g,
  'money(data.previousDuePaidPaisa || 0)'
);
content = content.replace(
  /money\(data\.customerRemainingDuePaisa\)/g,
  'money(data.customerRemainingDuePaisa || 0)'
);
content = content.replace(
  /\(data\.customerPreviousDuePaisa \/ 100\)/g,
  '((data.customerPreviousDuePaisa || 0) / 100)'
);
content = content.replace(
  /\(data\.previousDuePaidPaisa \/ 100\)/g,
  '((data.previousDuePaidPaisa || 0) / 100)'
);
content = content.replace(
  /\(data\.customerRemainingDuePaisa \/ 100\)/g,
  '((data.customerRemainingDuePaisa || 0) / 100)'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed more typescript errors in invoicePdf.ts');
