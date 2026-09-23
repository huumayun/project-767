const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/customers/CustomerLedgerModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update Print HTML Template
const printRowRegex = /<td class="num">\$\{tx\.credit_paisa > 0 \? tk\(tx\.credit_paisa\) : \'\'\}<\/td>/g;
// Wait, I need to check exactly how the print row is rendered.
