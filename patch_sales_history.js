const fs = require('fs');

let c = fs.readFileSync('src/components/pos/SalesHistoryView.tsx', 'utf8');

c = c.replace(/\{\(sale\.status === 'completed' \|\| sale\.status === 'partial_refund'\) && \(/g, 
`{(sale.status === 'completed' || sale.status === 'partial_refund') && !sale.invoice_no.startsWith('DUE-') && !(sale.total_paisa === 0 && sale.subtotal_paisa === 0) && (`);

fs.writeFileSync('src/components/pos/SalesHistoryView.tsx', c);
