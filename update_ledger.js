const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/customers/CustomerLedgerModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Grouping logic
const fetchLedgerRegex = /const list = await window\.api\.customers\.getHistory\(customer\.id\);\s*setHistory\(list\);/;
const fetchLedgerReplacement = `const list = await window.api.customers.getHistory(customer.id);
        const grouped = [];
        for (let i = 0; i < list.length; i++) {
          const row = list[i];
          if (row.type === 'sale') {
            const nextRow = i + 1 < list.length ? list[i + 1] : null;
            if (nextRow && nextRow.type === 'payment' && nextRow.ref_no === row.ref_no) {
              grouped.push({
                ...row,
                description: \`Invoice \${row.ref_no}\`,
                credit_paisa: nextRow.credit_paisa,
                running_balance_paisa: nextRow.running_balance_paisa
              });
              i++;
              continue;
            }
          }
          grouped.push(row);
        }
        setHistory(grouped);`;
content = content.replace(fetchLedgerRegex, fetchLedgerReplacement);

// 2. Print HTML Headers & Footers
content = content.replace(/<span>Total Debit<\/span>/g, '<span>Total Bill</span>');
content = content.replace(/<span>Total Credit<\/span>/g, '<span>Total Paid/Return</span>');
content = content.replace(/<span>Closing Balance<\/span>/g, '<span>Current Due</span>');
content = content.replace(/<th class="num">Debit<\/th>/g, '<th class="num">Bill (৳)</th>');
content = content.replace(/<th class="num">Credit<\/th>/g, '<th class="num">Paid (৳)</th>');
content = content.replace(/<th class="num">Balance<\/th>/g, '<th class="num">Due (৳)</th>');
content = content.replace(/Debit raises the balance\s*\(invoices, refunds paid out\); credit reduces it \(payments received, returns\)\./g, 'Bill increases the due (purchases); Paid decreases it (cash/returns).');

// 3. React UI Headers
content = content.replace(/Total Debit \(invoices \+ refunds\)/g, 'Total Bill (Invoices)');
content = content.replace(/Total Credit \(paid \+ returns\)/g, 'Total Paid / Returned');
content = content.replace(/Debit \/ Sale \(৳\)/g, 'Bill / Sale (৳)');
content = content.replace(/Credit \/ Paid \(৳\)/g, 'Paid / Return (৳)');
content = content.replace(/Closing Balance \(amount due\)/g, 'Closing Balance (Current Due)');

// Write back
fs.writeFileSync(path, content, 'utf8');
console.log('CustomerLedgerModal.tsx updated');
