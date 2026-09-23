const fs = require('fs');
let c = fs.readFileSync('electron/services/invoicePdf.ts', 'utf8');
c = c.replace(/customerRemainingDuePaisa\?: number;[\s\r\n]+duePaisa\?: number;/, 'customerRemainingDuePaisa?: number;');
fs.writeFileSync('electron/services/invoicePdf.ts', c, 'utf8');
