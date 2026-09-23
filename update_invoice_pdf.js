const fs = require('fs');

const path = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Update A4 layout
const a4Regex = /\[\{ text: 'Previous Due :', alignment: 'left', fontSize: size\.fine, color: MUTED \}, \{ text: money\(data\.customerPreviousDuePaisa\), alignment: 'right', fontSize: size\.fine, color: INK \}\],\s*\[\{ text: 'Paid Today :', alignment: 'left', fontSize: size\.fine, color: MUTED \}, \{ text: money\(data\.previousDuePaidPaisa\), alignment: 'right', fontSize: size\.fine, color: INK \}\],\s*\[\{ text: 'Remaining Due :', alignment: 'left', bold: true, fontSize: size\.fine, color: INK \}, \{ text: money\(data\.customerRemainingDuePaisa\), bold: true, alignment: 'right', fontSize: size\.fine, color: INK \}\]/;

const a4Repl = `[{ text: 'Previous Due :', alignment: 'left', fontSize: size.fine, color: MUTED }, { text: money(data.customerPreviousDuePaisa), alignment: 'right', fontSize: size.fine, color: INK }],
                              ...(data.duePaisa > 0 ? [[{ text: "Today's Due :", alignment: 'left', fontSize: size.fine, color: MUTED }, { text: money(data.duePaisa), alignment: 'right', fontSize: size.fine, color: INK }]] : []),
                              ...(data.previousDuePaidPaisa > 0 ? [[{ text: 'Paid Today :', alignment: 'left', fontSize: size.fine, color: MUTED }, { text: money(data.previousDuePaidPaisa), alignment: 'right', fontSize: size.fine, color: INK }]] : []),
                              [{ text: 'Remaining Due :', alignment: 'left', bold: true, fontSize: size.fine, color: INK }, { text: money(data.customerRemainingDuePaisa), bold: true, alignment: 'right', fontSize: size.fine, color: INK }]`;

content = content.replace(a4Regex, a4Repl);

// 2. Update Thermal layout
const thermalRegex = /\[\{ text: 'Previous Due:', fontSize: size\.meta \}, \{ text: `Tk \$\{\(data\.customerPreviousDuePaisa \/ 100\)\.toFixed\(2\)\}`, alignment: 'right', fontSize: size\.meta \}\],\s*\[\{ text: 'Paid Today:', fontSize: size\.meta \}, \{ text: `Tk \$\{\(data\.previousDuePaidPaisa \/ 100\)\.toFixed\(2\)\}`, alignment: 'right', fontSize: size\.meta \}\],\s*\[\{ text: 'Remaining Due:', bold: true, fontSize: size\.meta \}, \{ text: `Tk \$\{\(data\.customerRemainingDuePaisa \/ 100\)\.toFixed\(2\)\}`, bold: true, alignment: 'right', fontSize: size\.meta \}\]/;

const thermalRepl = `[{ text: 'Previous Due:', fontSize: size.meta }, { text: \`Tk \${(data.customerPreviousDuePaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }],
                    ...(data.duePaisa > 0 ? [[{ text: "Today's Due:", fontSize: size.meta }, { text: \`Tk \${(data.duePaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }]] : []),
                    ...(data.previousDuePaidPaisa > 0 ? [[{ text: 'Paid Today:', fontSize: size.meta }, { text: \`Tk \${(data.previousDuePaidPaisa / 100).toFixed(2)}\`, alignment: 'right', fontSize: size.meta }]] : []),
                    [{ text: 'Remaining Due:', bold: true, fontSize: size.meta }, { text: \`Tk \${(data.customerRemainingDuePaisa / 100).toFixed(2)}\`, bold: true, alignment: 'right', fontSize: size.meta }]`;

content = content.replace(thermalRegex, thermalRepl);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated invoicePdf.ts');
