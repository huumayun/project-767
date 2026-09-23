const fs = require('fs');

const viewsPath = 'c:/Users/humay/Music/project-767/src/components/reports/ReportsView.tsx';
let viewsContent = fs.readFileSync(viewsPath, 'utf8');

// 1. Add Due Collection KPI card to the Sales Grid
// Let's replace `sm:grid-cols-5` with `sm:grid-cols-5 xl:grid-cols-6` and add the card
viewsContent = viewsContent.replace(
  /<div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono">/,
  '<div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 font-mono">'
);

// We need to inject the Due Collection card after Net Sales
const dueCard = `
              {/* Due Collections */}
              <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-3xl shadow-xs">
                <span className="text-[11px] text-indigo-800 font-sans block mb-1">Due Collected</span>
                <span
                  className="text-xl font-extrabold text-indigo-900 block truncate"
                  title={formatCompactTaka(salesReport.due_collection_paisa || 0).full}
                >
                  {formatCompactTaka(salesReport.due_collection_paisa || 0).compact}
                </span>
                <span className="text-[10.5px] text-indigo-700 font-sans block mt-1">
                  From sales & standalone
                </span>
              </div>
            </div>`;

viewsContent = viewsContent.replace(/Net Sales - Refunds\s*<\/span>\s*<\/div>\s*<\/div>/, 'Gross Sales - Refunds\n                </span>\n              </div>\n' + dueCard);


// 2. Add the Due Collection Details table below the Daily Trends table
const dueTableCode = `
            {/* Due Collection Details Table */}
            {salesReport.due_collection_details && salesReport.due_collection_details.length > 0 && (
              <div className="bg-white border border-indigo-200 rounded-3xl overflow-hidden shadow-xs mt-4">
                <div className="p-4 border-b border-indigo-200 bg-indigo-50/50 flex justify-between items-center text-xs">
                  <span className="font-bold text-indigo-900 font-sans">Recent Due Collections Breakdown</span>
                  <span className="font-mono text-indigo-600 font-bold">{salesReport.due_collection_details.length} records</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                    <thead className="bg-indigo-50 text-indigo-700 uppercase font-mono text-[10.5px] border-b border-indigo-200">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Source / Ref</th>
                        <th className="py-3 px-4 text-right">Bill / Invoice (৳)</th>
                        <th className="py-3 px-4 text-right text-indigo-800">Due Collected (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-50 font-mono text-xs">
                      {salesReport.due_collection_details.map((d: any, idx: number) => (
                        <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="py-3 px-4 text-indigo-950">{new Date(d.date).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{d.customer_name}</td>
                          <td className="py-3 px-4 text-slate-600">
                            {d.source} {d.invoice_no ? <span className="text-azure-mist-600 font-bold">({d.invoice_no})</span> : ''}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {d.bill_amount_paisa > 0 ? \`৳ \${(d.bill_amount_paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}\` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-extrabold text-indigo-900">
                            ৳ {(d.collected_paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
`;

// Inject before Tab 3
viewsContent = viewsContent.replace(/\{\/\* 6\. TAB 3: PAYMENT CHANNELS & CASH INFLOW \*\/\}/, dueTableCode + '\n        {/* 6. TAB 3: PAYMENT CHANNELS & CASH INFLOW */}');

fs.writeFileSync(viewsPath, viewsContent, 'utf8');
console.log('Updated ReportsView.tsx');
