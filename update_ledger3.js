const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/customers/CustomerLedgerModal.tsx';
let content = fs.readFileSync(path, 'utf8');

const printRowRepl = `const rows = history
      .map((tx) => {
        let displayPaid = tx.credit_paisa;
        let displayDueColl = 0;
        if (tx.type === 'sale') {
          if (tx.credit_paisa > tx.debit_paisa) {
            displayPaid = tx.debit_paisa;
            displayDueColl = tx.credit_paisa - tx.debit_paisa;
          }
        } else if (tx.type === 'payment' && tx.credit_paisa > 0) {
          displayPaid = 0;
          displayDueColl = tx.credit_paisa;
        }

        return \`
        <tr>
          <td class="date">\${esc(new Date(tx.date).toLocaleDateString('en-GB'))}</td>
          <td class="ref">\${esc(tx.ref_no)}</td>
          <td>\${esc(tx.description)}</td>
          <td class="num">\${tx.debit_paisa ? taka(tx.debit_paisa) : ''}</td>
          <td class="num">\${displayPaid ? taka(displayPaid) : ''}</td>
          <td class="num">\${displayDueColl ? taka(displayDueColl) : ''}</td>
          <td class="num strong">\${taka(tx.running_balance_paisa || 0)}</td>
        </tr>\`
      })
      .join('');`;

content = content.replace(/const rows = history\s*\.map\(\s*\(tx\) => `[\s\S]*?`\s*\)\s*\.join\(''\);/, printRowRepl);

// Update print headers
content = content.replace(
  /<th class="num">Paid \(৳\)<\/th>/,
  '<th class="num">Paid (৳)</th>\n                    <th class="num">Due Coll. (৳)</th>'
);
content = content.replace(
  /<td colspan="6"/,
  '<td colspan="7"'
);

// React UI row mapping
// Look for how history.map is rendered
