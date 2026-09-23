const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/dashboard/DashboardView.tsx';
let content = fs.readFileSync(path, 'utf8');

// Change grid-cols-5 to grid-cols-6
content = content.replace(/grid-cols-5/g, 'grid-cols-6');

// Add the Due Collection card after the Cash & Digital card
const dueCollectionCard = `
        {/* 2.5 Total Due Collection */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">
                {'Due Collection'}
              </span>
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            {(() => {
              const dueCollected = salesReport?.due_collection_paisa ?? 0;
              const { compact, full } = formatCompactTaka(dueCollected);
              return (
                <div className="mt-2.5">
                  <div
                    className="text-ui-2xl font-bold text-indigo-800 font-mono tracking-tight whitespace-nowrap truncate"
                    title={full}
                  >
                    {compact}
                  </div>
                  <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
                    {'Collected from past dues'}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500" />
        </div>
`;

content = content.replace(
  /\{\/\* 3\. Total Realized Profit \(Owner\) \/ Total Invoices \(Staff\) \*\/\}/g,
  dueCollectionCard + '\n        {/* 3. Total Realized Profit (Owner) / Total Invoices (Staff) */}'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched DashboardView.tsx');
