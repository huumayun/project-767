const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/shifts/ShiftsHistoryView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix React table
content = content.replace(
  /\{tk\(row\.paid_paisa\)\}\{row\.previous_due_paid_paisa \? \(\+ Due\) \: \'\'\}<\/td>/g,
  '{tk(row.paid_paisa)}{row.previous_due_paid_paisa ? ` (+ ৳ ${tk(row.previous_due_paid_paisa)} Due)` : \'\'}</td>'
);

// Fix Print table
content = content.replace(
  /<td class="num">৳ \$\{tk\(t\.paid_paisa\)\}<\/td>/g,
  '<td class="num">৳ ${tk(t.paid_paisa)}${t.previous_due_paid_paisa ? ` <br><small class="muted">(+ ৳ ${tk(t.previous_due_paid_paisa)} Due)</small>` : \'\'}</td>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ShiftsHistoryView.tsx');
