const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. A4
const a4Target = \`    const finalTotal = data.totalPaisa - (data.returnedPaisa || 0);
    totalsBody.push(totalsRow('Net Payable :', money(finalTotal), { bold: true, rule: true }));\`;
const a4Replace = \`    if (data.previousDuePaidPaisa && data.previousDuePaidPaisa > 0) {
      totalsBody.push(totalsRow('Prev. Due Collected :', money(data.previousDuePaidPaisa)));
    }
    const finalTotal = data.totalPaisa - (data.returnedPaisa || 0) + (data.previousDuePaidPaisa || 0);
    totalsBody.push(totalsRow('Net Payable :', money(finalTotal), { bold: true, rule: true }));\`;
content = content.replace(a4Target, a4Replace);

const a4SummaryTarget = \`          {
            width: 230,
            table: { widths: ['*', 78], body: totalsBody },
            layout: {
              defaultBorder: false,
              hLineWidth: (i: number, node: any) => (node.table.body[i]?.[0]?.border?.[1] ? 0.8 : 0),
              vLineWidth: () => 0,
              hLineColor: () => RULE,
            },
          },
        ],
        margin: [0, 0, 0, 4],
      },\`;
const a4SummaryReplace = \`          {
            width: 230,
            table: { widths: ['*', 78], body: totalsBody },
            layout: {
              defaultBorder: false,
              hLineWidth: (i: number, node: any) => (node.table.body[i]?.[0]?.border?.[1] ? 0.8 : 0),
              vLineWidth: () => 0,
              hLineColor: () => RULE,
            },
          },
        ],
        margin: [0, 0, 0, 4],
      },
      // Customer Balance Summary (A4)
      data.customerPreviousDuePaisa !== undefined && data.previousDuePaidPaisa !== undefined && data.customerRemainingDuePaisa !== undefined
        ? {
            columns: [
              { width: '*', text: '' }, // Spacer to push to right
              {
                width: 230,
                table: {
                  widths: ['*', 78],
                  body: [
                    [{ text: 'Customer Balance Summary', bold: true, colSpan: 2, fontSize: size.meta, margin: [0, 4, 0, 2], alignment: 'right' }, {}],
                    [{ text: 'Previous Due :', alignment: 'right', fontSize: size.meta }, { text: money(data.customerPreviousDuePaisa), alignment: 'right', fontSize: size.meta }],
                    [{ text: 'Paid Today :', alignment: 'right', fontSize: size.meta }, { text: money(data.previousDuePaidPaisa), alignment: 'right', fontSize: size.meta }],
                    [{ text: 'Remaining Due :', alignment: 'right', bold: true, fontSize: size.meta, margin: [0,0,0,0], border: [false, false, false, true] }, { text: money(data.customerRemainingDuePaisa), bold: true, alignment: 'right', fontSize: size.meta, border: [false, false, false, true] }]
                  ]
                },
                layout: {
                  hLineWidth: (i, node) => (i === node.table.body.length) ? 0.8 : 0,
                  vLineWidth: () => 0,
                  hLineColor: () => RULE,
                },
                margin: [0, 4, 0, 4]
              }
            ]
          }
        : {},\`;
content = content.replace(a4SummaryTarget, a4SummaryReplace);

// 2. 80mm Thermal
const thermalTarget = \`                  data.discountPaisa > 0
                    ? [{ text: 'Discount:', fontSize: size.total }, { text: \\\`- Tk \${discountTaka}\\\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  [
                    { text: 'Grand Total:', bold: true, fontSize: size.grandTotal },
                    { text: \\\`Tk \${totalTaka}\\\`, bold: true, alignment: 'right', fontSize: size.grandTotal },
                  ],
                  [{ text: 'Total Paid:', fontSize: size.total }, { text: \\\`Tk \${paidTaka}\\\`, alignment: 'right', fontSize: size.total }],
                  data.changePaisa && data.changePaisa > 0
                    ? [{ text: 'Change Returned:', fontSize: size.total }, { text: \\\`Tk \${changeTaka}\\\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  data.duePaisa && data.duePaisa > 0
                    ? [{ text: 'Remaining Due:', bold: true, fontSize: size.total, color: '#dc2626' }, { text: \\\`Tk \${dueTaka}\\\`, bold: true, alignment: 'right', fontSize: size.total, color: '#dc2626' }]
                    : [],
                ].filter(row => row.length > 0),
              },
              layout: 'noBorders',
            },
          ],
          margin: [0, 0, 0, 6],
        },\`;
const thermalReplace = \`                  data.discountPaisa > 0
                    ? [{ text: 'Discount:', fontSize: size.total }, { text: \\\`- Tk \${discountTaka}\\\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  (data.previousDuePaidPaisa && data.previousDuePaidPaisa > 0)
                    ? [{ text: 'Prev. Due Collected:', fontSize: size.total }, { text: \\\`Tk \${(data.previousDuePaidPaisa / 100).toFixed(2)}\\\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  [
                    { text: 'Grand Total To Pay:', bold: true, fontSize: size.grandTotal },
                    { text: \\\`Tk \${((data.totalPaisa + (data.previousDuePaidPaisa || 0)) / 100).toFixed(2)}\\\`, bold: true, alignment: 'right', fontSize: size.grandTotal },
                  ],
                  [{ text: 'Total Paid:', fontSize: size.total }, { text: \\\`Tk \${paidTaka}\\\`, alignment: 'right', fontSize: size.total }],
                  data.changePaisa && data.changePaisa > 0
                    ? [{ text: 'Change Returned:', fontSize: size.total }, { text: \\\`Tk \${changeTaka}\\\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  data.duePaisa && data.duePaisa > 0
                    ? [{ text: 'Remaining Due:', bold: true, fontSize: size.total, color: '#dc2626' }, { text: \\\`Tk \${dueTaka}\\\`, bold: true, alignment: 'right', fontSize: size.total, color: '#dc2626' }]
                    : [],
                ].filter(row => row.length > 0),
              },
              layout: 'noBorders',
            },
            
            // Customer Balance Summary (Thermal)
            data.customerPreviousDuePaisa !== undefined && data.previousDuePaidPaisa !== undefined && data.customerRemainingDuePaisa !== undefined ? {
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Customer Balance Summary', bold: true, colSpan: 2, fontSize: size.meta, margin: [0, 6, 0, 2], alignment: 'center' }, {}],
                  [{ text: 'Previous Due:', fontSize: size.meta }, { text: \\\`Tk \${(data.customerPreviousDuePaisa / 100).toFixed(2)}\\\`, alignment: 'right', fontSize: size.meta }],
                  [{ text: 'Paid Today:', fontSize: size.meta }, { text: \\\`Tk \${(data.previousDuePaidPaisa / 100).toFixed(2)}\\\`, alignment: 'right', fontSize: size.meta }],
                  [{ text: 'Remaining Due:', bold: true, fontSize: size.meta }, { text: \\\`Tk \${(data.customerRemainingDuePaisa / 100).toFixed(2)}\\\`, bold: true, alignment: 'right', fontSize: size.meta }]
                ]
              },
              layout: { hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0, vLineWidth: () => 0, hLineColor: () => '#94a3b8' },
              margin: [0, 4, 0, 6]
            } : {},
          ],
          margin: [0, 0, 0, 6],
        },\`;
content = content.replace(thermalTarget.replace(/\\r\\n/g, '\\n'), thermalReplace);
// Also try with standard just in case
content = content.replace(thermalTarget, thermalReplace);

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
