const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/customers/CustomerLedgerModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// React headers
content = content.replace(
  /<th className="p-3 text-right">Paid \/ Return \(৳\)<\/th>/,
  '<th className="p-3 text-right">Paid / Return (৳)</th>\n                  <th className="p-3 text-right">Due Coll. (৳)</th>'
);

content = content.replace(
  /<td colSpan=\{6\}/g,
  '<td colSpan={7}'
);

const reactRowRegex = /<td className="p-3 text-right text-muted-teal-800 font-bold">\s*\{tx\.credit_paisa > 0 \? `৳ \$\{\(tx\.credit_paisa \/ 100\)\.toFixed\(2\)\}` : '-'\}\s*<\/td>/g;

const reactRowRepl = `                      <td className="p-3 text-right text-muted-teal-800 font-bold">
                        {(() => {
                          let displayPaid = tx.credit_paisa;
                          if (tx.type === 'sale') {
                            if (tx.credit_paisa > tx.debit_paisa) {
                              displayPaid = tx.debit_paisa;
                            }
                          } else if (tx.type === 'payment' && tx.credit_paisa > 0) {
                            displayPaid = 0;
                          }
                          return displayPaid > 0 ? \`৳ \${(displayPaid / 100).toFixed(2)}\` : '-';
                        })()}
                      </td>
                      <td className="p-3 text-right text-indigo-700 font-bold">
                        {(() => {
                          let displayDueColl = 0;
                          if (tx.type === 'sale') {
                            if (tx.credit_paisa > tx.debit_paisa) {
                              displayDueColl = tx.credit_paisa - tx.debit_paisa;
                            }
                          } else if (tx.type === 'payment' && tx.credit_paisa > 0) {
                            displayDueColl = tx.credit_paisa;
                          }
                          return displayDueColl > 0 ? \`৳ \${(displayDueColl / 100).toFixed(2)}\` : '-';
                        })()}
                      </td>`;

content = content.replace(reactRowRegex, reactRowRepl);


// Print row replacements (using the ones from before, but let's just do them all here)
const printRowRegex = /const rows = history\s*\.map\(\s*\(tx\) => `[\s\S]*?`\s*\)\s*\.join\(''\);/;

const printRowRepl2 = `const rows = history
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
          </tr>\`;
      })
      .join('');`;

content = content.replace(printRowRegex, printRowRepl2);

content = content.replace(
  /<th class="num">Paid \(৳\)<\/th>/,
  '<th class="num">Paid (৳)</th>\n                    <th class="num">Due Coll. (৳)</th>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Update finished');
