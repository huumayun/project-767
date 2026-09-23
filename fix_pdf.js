const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Inject into 80mm layout
// Target the array containing the totals inside generateInvoicePdf
const thermalTarget = `                  data.discountPaisa > 0
                    ? [{ text: 'Discount:', fontSize: size.total }, { text: \`- Tk \${discountTaka}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  [
                    { text: 'Grand Total:', bold: true, fontSize: size.grandTotal },
                    { text: \`Tk \${totalTaka}\`, bold: true, alignment: 'right', fontSize: size.grandTotal },
                  ],
                  [{ text: 'Total Paid:', fontSize: size.total }, { text: \`Tk \${paidTaka}\`, alignment: 'right', fontSize: size.total }],
                  data.changePaisa && data.changePaisa > 0
                    ? [{ text: 'Change Returned:', fontSize: size.total }, { text: \`Tk \${changeTaka}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  data.duePaisa && data.duePaisa > 0
                    ? [{ text: 'Remaining Due:', bold: true, fontSize: size.total, color: '#dc2626' }, { text: \`Tk \${dueTaka}\`, bold: true, alignment: 'right', fontSize: size.total, color: '#dc2626' }]
                    : [],
                ].filter(row => row.length > 0),`;

const thermalReplace = `                  data.discountPaisa > 0
                    ? [{ text: 'Discount:', fontSize: size.total }, { text: \`- Tk \${discountTaka}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  (data.previousDuePaidPaisa && data.previousDuePaidPaisa > 0)
                    ? [{ text: 'Prev. Due Collected:', fontSize: size.total }, { text: \`Tk \${(data.previousDuePaidPaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  [
                    { text: 'Grand Total To Pay:', bold: true, fontSize: size.grandTotal },
                    { text: \`Tk \${((data.totalPaisa + (data.previousDuePaidPaisa || 0)) / 100).toFixed(2)}\`, bold: true, alignment: 'right', fontSize: size.grandTotal },
                  ],
                  [{ text: 'Total Paid:', fontSize: size.total }, { text: \`Tk \${paidTaka}\`, alignment: 'right', fontSize: size.total }],
                  data.changePaisa && data.changePaisa > 0
                    ? [{ text: 'Change Returned:', fontSize: size.total }, { text: \`Tk \${changeTaka}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  data.duePaisa && data.duePaisa > 0
                    ? [{ text: 'Remaining Due:', bold: true, fontSize: size.total, color: '#dc2626' }, { text: \`Tk \${dueTaka}\`, bold: true, alignment: 'right', fontSize: size.total, color: '#dc2626' }]
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
                  [{ text: 'Previous Due:', fontSize: size.meta }, { text: \`Tk \${(data.customerPreviousDuePaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }],
                  [{ text: 'Paid Today:', fontSize: size.meta }, { text: \`Tk \${(data.previousDuePaidPaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }],
                  [{ text: 'Remaining Due:', bold: true, fontSize: size.meta }, { text: \`Tk \${(data.customerRemainingDuePaisa / 100).toFixed(2)}\`, bold: true, alignment: 'right', fontSize: size.meta }]
                ]
              },
              layout: { hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0, vLineWidth: () => 0 },
              margin: [0, 4, 0, 6]
            } : {},`;

// Fix thermalTarget replacement correctly matching the end
content = content.replace(thermalTarget.slice(0, 500), thermalReplace.slice(0, 500)); // That might fail, let's use regex instead

const thermalRegex = /\[\s*\{\s*text:\s*'Grand Total:',\s*bold:\s*true,\s*fontSize:\s*size\.grandTotal\s*\},[\s\S]*?\]\.filter\(row => row\.length > 0\),/m;
const thermalRegexReplace = `(data.previousDuePaidPaisa && data.previousDuePaidPaisa > 0)
                    ? [{ text: 'Prev. Due Collected:', fontSize: size.total }, { text: \`Tk \${(data.previousDuePaidPaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  [
                    { text: 'Grand Total To Pay:', bold: true, fontSize: size.grandTotal },
                    { text: \`Tk \${((data.totalPaisa + (data.previousDuePaidPaisa || 0)) / 100).toFixed(2)}\`, bold: true, alignment: 'right', fontSize: size.grandTotal },
                  ],
                  [{ text: 'Total Paid:', fontSize: size.total }, { text: \`Tk \${paidTaka}\`, alignment: 'right', fontSize: size.total }],
                  data.changePaisa && data.changePaisa > 0
                    ? [{ text: 'Change Returned:', fontSize: size.total }, { text: \`Tk \${changeTaka}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  data.duePaisa && data.duePaisa > 0
                    ? [{ text: 'Remaining Due:', bold: true, fontSize: size.total, color: '#dc2626' }, { text: \`Tk \${dueTaka}\`, bold: true, alignment: 'right', fontSize: size.total, color: '#dc2626' }]
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
                  [{ text: 'Previous Due:', fontSize: size.meta }, { text: \`Tk \${(data.customerPreviousDuePaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }],
                  [{ text: 'Paid Today:', fontSize: size.meta }, { text: \`Tk \${(data.previousDuePaidPaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }],
                  [{ text: 'Remaining Due:', bold: true, fontSize: size.meta }, { text: \`Tk \${(data.customerRemainingDuePaisa / 100).toFixed(2)}\`, bold: true, alignment: 'right', fontSize: size.meta }]
                ]
              },
              layout: { hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0, vLineWidth: () => 0, hLineColor: () => '#94a3b8' },
              margin: [0, 4, 0, 6]
            } : {},`;

content = content.replace(thermalRegex, thermalRegexReplace);

// 2. Inject into A4 totals body
const a4Target = `    const finalTotal = data.totalPaisa - (data.returnedPaisa || 0);
    totalsBody.push(totalsRow('Net Payable :', money(finalTotal), { bold: true, rule: true }));`;
    
const a4Replace = `    if (data.previousDuePaidPaisa && data.previousDuePaidPaisa > 0) {
      totalsBody.push(totalsRow('Prev. Due Collected :', money(data.previousDuePaidPaisa)));
    }
    const finalTotal = data.totalPaisa - (data.returnedPaisa || 0) + (data.previousDuePaidPaisa || 0);
    totalsBody.push(totalsRow('Net Payable :', money(finalTotal), { bold: true, rule: true }));`;

content = content.replace(a4Target, a4Replace);

// 3. Inject A4 Customer Balance Summary
const a4TableTarget = `          {
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
      },`;
      
const a4TableReplace = `          {
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
        : {},`;
        
// There are multiple instances of a4TableTarget (one in memo, one in return note), so we only replace the FIRST one which is the memo
content = content.replace(a4TableTarget, a4TableReplace);

fs.writeFileSync(path, content, 'utf8');
console.log('PDF layout updated');
