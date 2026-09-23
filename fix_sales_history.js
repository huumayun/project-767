const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/pos/SalesHistoryView.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `
                        <div className="font-bold text-jungle-teal-900">
                          ৳ {((sale.total_paisa + (sale.previous_due_paid_paisa || 0)) / 100).toFixed(2)}
                        </div>
                        {(sale.previous_due_paid_paisa || 0) > 0 && (
                          <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                            (incl. ৳ {((sale.previous_due_paid_paisa || 0) / 100).toFixed(2)} due)
                          </div>
                        )}
`;

content = content.replace(
  /<div className="font-bold text-jungle-teal-900">\s*৳ \{\(sale\.total_paisa \/ 100\)\.toFixed\(2\)\}\s*<\/div>/g,
  replacement
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed SalesHistoryView.tsx');
