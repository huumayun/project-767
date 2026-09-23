const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/customers/CustomerLedgerModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// React component changes
const reactPaidRegex = /let displayPaid = tx\.credit_paisa;\s*if \(tx\.type === 'sale'\) \{\s*if \(tx\.credit_paisa > tx\.debit_paisa\) \{\s*displayPaid = tx\.debit_paisa;\s*\}\s*\} else if \(tx\.type === 'payment' && tx\.credit_paisa > 0\) \{\s*displayPaid = 0;\s*\}/g;
const reactPaidRepl = `let displayPaid = tx.credit_paisa;
                          if (tx.type === 'payment' && tx.credit_paisa > 0) {
                            displayPaid = 0; // Pure due collection, not a sale
                          }`;

content = content.replace(reactPaidRegex, reactPaidRepl);

// Print HTML template changes
const printPaidRegex = /let displayPaid = tx\.credit_paisa;\s*let displayDueColl = 0;\s*if \(tx\.type === 'sale'\) \{\s*if \(tx\.credit_paisa > tx\.debit_paisa\) \{\s*displayPaid = tx\.debit_paisa;\s*displayDueColl = tx\.credit_paisa - tx\.debit_paisa;\s*\}\s*\} else if \(tx\.type === 'payment' && tx\.credit_paisa > 0\) \{\s*displayPaid = 0;\s*displayDueColl = tx\.credit_paisa;\s*\}/g;
const printPaidRepl = `let displayPaid = tx.credit_paisa;
        let displayDueColl = 0;
        if (tx.type === 'sale') {
          if (tx.credit_paisa > tx.debit_paisa) {
            displayDueColl = tx.credit_paisa - tx.debit_paisa;
          }
        } else if (tx.type === 'payment' && tx.credit_paisa > 0) {
          displayPaid = 0;
          displayDueColl = tx.credit_paisa;
        }`;

content = content.replace(printPaidRegex, printPaidRepl);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated PAID to show full amount');
