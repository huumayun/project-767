const fs = require('fs');
let c = fs.readFileSync('electron/services/invoicePdf.ts', 'utf8');

const oldBlock = `        // Totals & Calculations
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 'auto',
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Subtotal:', fontSize: size.total }, { text: \`Tk \${subtotalTaka}\`, alignment: 'right', fontSize: size.total }],
                  data.discountPaisa > 0
                    ? [{ text: 'Discount:', fontSize: size.total }, { text: \`- Tk \${discountTaka}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  (data.previousDuePaidPaisa && data.previousDuePaidPaisa > 0)
                      ? [{ text: 'Prev. Due Collected:', fontSize: size.total }, { text: \`Tk \${((data.previousDuePaidPaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.total }]
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
              data.customerPreviousDuePaisa !== undefined && data.previousDuePaidPaisa !== undefined && data.customerRemainingDuePaisa !== undefined && (data.customerPreviousDuePaisa > 0 || data.previousDuePaidPaisa > 0 || data.customerRemainingDuePaisa > 0) ? {
                table: {
                  widths: ['*', 'auto'],
                  body: [
                    [{ text: 'Customer Balance Summary', bold: true, colSpan: 2, fontSize: size.meta, margin: [0, 6, 0, 2], alignment: 'center' }, {}],
                    [{ text: 'Previous Due:', fontSize: size.meta }, { text: \`Tk \${((data.customerPreviousDuePaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }],
                      ...((data.duePaisa || 0) > 0 ? [[{ text: "Today's Due:", fontSize: size.meta }, { text: \`Tk \${((data.duePaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }]] : []),
                      ...(data.previousDuePaidPaisa > 0 ? [[{ text: 'Paid Today:', fontSize: size.meta }, { text: \`Tk \${((data.previousDuePaidPaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }]] : []),
                      [{ text: 'Remaining Due:', bold: true, fontSize: size.meta }, { text: \`Tk \${((data.customerRemainingDuePaisa || 0) / 100).toFixed(2)}\`, bold: true, alignment: 'right', fontSize: size.meta }]
                  ]
                },
                layout: { hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length) ? 0.5 : 0, vLineWidth: () => 0, hLineColor: () => '#94a3b8' },
                margin: [0, 4, 0, 6]
              } : {},
            ],
            margin: [0, 0, 0, 6],
          },`;

const newBlock = `        // Totals & Calculations
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 'auto',
              table: {
                widths: ['*', 'auto'],
                body: [
                  [{ text: 'Subtotal:', fontSize: size.total }, { text: \`Tk \${subtotalTaka}\`, alignment: 'right', fontSize: size.total }],
                  data.discountPaisa > 0
                    ? [{ text: 'Discount:', fontSize: size.total }, { text: \`- Tk \${discountTaka}\`, alignment: 'right', fontSize: size.total }]
                    : [],
                  (data.previousDuePaidPaisa && data.previousDuePaidPaisa > 0)
                      ? [{ text: 'Prev. Due Collected:', fontSize: size.total }, { text: \`Tk \${((data.previousDuePaidPaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.total }]
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
            ],
            margin: [0, 0, 0, 6],
          },

        // Customer Balance Summary (Thermal)
        !isThermal ? {} : data.customerPreviousDuePaisa !== undefined && data.previousDuePaidPaisa !== undefined && data.customerRemainingDuePaisa !== undefined && (data.customerPreviousDuePaisa > 0 || data.previousDuePaidPaisa > 0 || data.customerRemainingDuePaisa > 0) ? {
          table: {
            widths: ['*', 'auto'],
            body: [
              [{ text: 'Customer Balance Summary', bold: true, colSpan: 2, fontSize: size.meta, margin: [0, 6, 0, 2], alignment: 'center' }, {}],
              [{ text: 'Previous Due:', fontSize: size.meta }, { text: \`Tk \${((data.customerPreviousDuePaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }],
                ...((data.duePaisa || 0) > 0 ? [[{ text: "Today's Due:", fontSize: size.meta }, { text: \`Tk \${((data.duePaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }]] : []),
                ...(data.previousDuePaidPaisa > 0 ? [[{ text: 'Paid Today:', fontSize: size.meta }, { text: \`Tk \${((data.previousDuePaidPaisa || 0) / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }]] : []),
                [{ text: 'Remaining Due:', bold: true, fontSize: size.meta }, { text: \`Tk \${((data.customerRemainingDuePaisa || 0) / 100).toFixed(2)}\`, bold: true, alignment: 'right', fontSize: size.meta }]
            ]
          },
          layout: { hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0.5 : 0, vLineWidth: () => 0, hLineColor: () => '#94a3b8' },
          margin: [0, 4, 0, 6]
        } : {},`;

c = c.replace(oldBlock.replace(/\r\n/g, '\n'), newBlock);
c = c.replace(oldBlock, newBlock); // fallback

fs.writeFileSync('electron/services/invoicePdf.ts', c);
