const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/shifts/ShiftsHistoryView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Print table headers
content = content.replace(
  /<th class="num">Paid<\/th><th class="num">Returned<\/th>/g,
  '<th class="num">Paid</th><th class="num">Due Collected</th><th class="num">Returned</th>'
);

// Print table row
content = content.replace(
  /<td class="num">৳ \$\{tk\(t\.paid_paisa\)\}\$\{t\.previous_due_paid_paisa \? ` <br><small class="muted">\(\+ ৳ \$\{tk\(t\.previous_due_paid_paisa\)\} Due\)<\/small>` : \'\'\}<\/td>/g,
  '<td class="num">৳ ${tk(t.paid_paisa)}</td>\n                        <td class="num">${t.previous_due_paid_paisa ? \'৳ \' + tk(t.previous_due_paid_paisa) : \'—\'}</td>'
);

// React table headers
content = content.replace(
  /<th className="text-right font-medium px-3 py-2">Paid<\/th>\s*<th className="text-right font-medium px-3 py-2">Returned<\/th>/g,
  '<th className="text-right font-medium px-3 py-2">Paid</th>\n                          <th className="text-right font-medium px-3 py-2">Due Collected</th>\n                          <th className="text-right font-medium px-3 py-2">Returned</th>'
);

// React table row
content = content.replace(
  /<td className="px-3 py-2 text-right whitespace-nowrap text-muted-teal-800">৳ \{tk\(row\.paid_paisa\)\}\{row\.previous_due_paid_paisa \? ` \(\+ ৳ \$\{tk\(row\.previous_due_paid_paisa\)\} Due\)` : \'\'\}<\/td>/g,
  '<td className="px-3 py-2 text-right whitespace-nowrap text-muted-teal-800">৳ {tk(row.paid_paisa)}</td>\n                            <td className="px-3 py-2 text-right whitespace-nowrap text-indigo-600 font-semibold">{row.previous_due_paid_paisa ? `৳ ${tk(row.previous_due_paid_paisa)}` : \'—\'}</td>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Added Due Collected column');
