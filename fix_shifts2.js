const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/shifts/ShiftsHistoryView.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /<td className="px-3 py-2 text-right whitespace-nowrap text-muted-teal-800">৳ \{tk\(row\.paid_paisa\)\}.*<\/td>/g,
  '<td className="px-3 py-2 text-right whitespace-nowrap text-muted-teal-800">৳ {tk(row.paid_paisa)}{row.previous_due_paid_paisa ? ` (+ ৳ ${tk(row.previous_due_paid_paisa)} Due)` : \'\'}</td>'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed React table');
