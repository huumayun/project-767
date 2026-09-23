const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/reports/ReportsView.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">/g;
content = content.replace(regex, '<div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">');

const netSalesEnd = /Gross Sales - Refunds\n                <\/span>\n              <\/div>/;

const dueCollectionCard = `Gross Sales - Refunds
                </span>
              </div>
              
              {/* Due Collection */}
              <div className="bg-white border border-indigo-200 bg-indigo-50/40 p-4 rounded-3xl shadow-xs">
                <span className="text-[11px] text-indigo-800 font-sans block mb-1">Due Collection</span>
                <span
                  className="text-xl font-extrabold text-indigo-900 block truncate"
                  title={formatCompactTaka(salesReport.dueCollectionPaisa || 0).full}
                >
                  {formatCompactTaka(salesReport.dueCollectionPaisa || 0).compact}
                </span>
                <span className="text-[10.5px] text-indigo-700 font-sans block mt-1">
                  Collected from past dues
                </span>
              </div>`;

content = content.replace(netSalesEnd, dueCollectionCard);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched ReportsView.tsx');
