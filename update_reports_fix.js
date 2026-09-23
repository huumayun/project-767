const fs = require('fs');

const viewsPath = 'c:/Users/humay/Music/project-767/src/components/reports/ReportsView.tsx';
let viewsContent = fs.readFileSync(viewsPath, 'utf8');

// Replace salesReport with salesReport? where it might be null, but actually I should just move it inside the block.
// Let's just use salesReport?.
viewsContent = viewsContent.replace(
  /\{salesReport\.due_collection_details && salesReport\.due_collection_details\.length > 0 && \(/g,
  '{salesReport?.due_collection_details && salesReport.due_collection_details.length > 0 && ('
);
viewsContent = viewsContent.replace(
  /\{salesReport\.due_collection_details\.length\} records/g,
  '{salesReport?.due_collection_details?.length} records'
);
viewsContent = viewsContent.replace(
  /salesReport\.due_collection_details\.map/g,
  'salesReport?.due_collection_details?.map'
);

// But wait, if activeSubTab is NOT 'sales', it shouldn't show up.
// It is currently rendering globally across tabs!
// Let's fix that. I'll remove the old injection and put it in the right place.

const tableCode = `
            {/* Due Collection Details Table */}
            {salesReport?.due_collection_details && salesReport.due_collection_details.length > 0 && (
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

// Remove the global one
viewsContent = viewsContent.replace(/\{\/\* Due Collection Details Table \*\/\}[\s\S]*?<\/\table>\s*<\/div>\s*<\/div>\s*\)\}\s*/, '');

// Inject right before the closing div of the Sales Tab
viewsContent = viewsContent.replace(/<\/table>\s*<\/div>\s*<\/div>\s*\)\}/, '</table >\n            </div>\n' + tableCode + '\n          </div>\n        )}');

fs.writeFileSync(viewsPath, viewsContent, 'utf8');
console.log('Fixed ReportsView.tsx');
