const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /\{\s*width:\s*230,\s*table:\s*\{\s*widths:\s*\['\*',\s*78\],\s*body:\s*totalsBody\s*\},\s*layout:\s*\{\s*defaultBorder:\s*false,\s*hLineWidth:\s*\([^)]*\)\s*=>\s*\([^)]*\)\s*\?\s*0\.8\s*:\s*0\),\s*vLineWidth:\s*\(\)\s*=>\s*0,\s*hLineColor:\s*\(\)\s*=>\s*RULE,\s*\},\s*\},\s*\],\s*margin:\s*\[0,\s*0,\s*0,\s*4\],\s*\},/;

const match = content.match(regex);
if (match) {
  const replace = match[0] + \`
    // Customer Balance Summary (A4)
    data.customerPreviousDuePaisa !== undefined && data.previousDuePaidPaisa !== undefined && data.customerRemainingDuePaisa !== undefined
      ? {
          columns: [
            { width: '*', text: '' },
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
      
  content = content.replace(regex, replace);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Done!');
} else {
  console.log('Not found');
}
