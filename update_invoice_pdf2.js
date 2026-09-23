const fs = require('fs');

const path = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let content = fs.readFileSync(path, 'utf8');

// Add duePaisa to InvoicePdfData interface
content = content.replace(
  /customerRemainingDuePaisa\?: number;/,
  'customerRemainingDuePaisa?: number;\n  duePaisa?: number;'
);

// Fix the undefined check in the template
// Replace `data.duePaisa > 0` with `(data.duePaisa || 0) > 0` and `money(data.duePaisa)` with `money(data.duePaisa || 0)`
// and same for thermal template
content = content.replace(
  /data\.duePaisa > 0 \?/g,
  '(data.duePaisa || 0) > 0 ?'
);
content = content.replace(
  /money\(data\.duePaisa\)/g,
  'money(data.duePaisa || 0)'
);
content = content.replace(
  /\(data\.duePaisa \/ 100\)/g,
  '((data.duePaisa || 0) / 100)'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed typescript error in invoicePdf.ts');
