const fs = require('fs');

// 1. Fix sales.ts logic
const salesPath = 'c:/Users/humay/Music/project-767/electron/ipc/routes/sales.ts';
let sales = fs.readFileSync(salesPath, 'utf8');

// Replace previousDuePaidPaisa logic everywhere in sales.ts
sales = sales.replace(/previousDuePaidPaisa: payload\.customer_id && payload\.previous_due_paid_paisa \? payload\.previous_due_paid_paisa : undefined/g, 'previousDuePaidPaisa: payload.customer_id ? (payload.previous_due_paid_paisa || 0) : undefined');
sales = sales.replace(/previousDuePaidPaisa: sale\.customer_id && sale\.previous_due_paid_paisa \? sale\.previous_due_paid_paisa : undefined/g, 'previousDuePaidPaisa: sale.customer_id ? (sale.previous_due_paid_paisa || 0) : undefined');

fs.writeFileSync(salesPath, sales, 'utf8');
console.log('Fixed sales.ts conditions');

// 2. Fix invoicePdf.ts logic
const pdfPath = 'c:/Users/humay/Music/project-767/electron/services/invoicePdf.ts';
let pdf = fs.readFileSync(pdfPath, 'utf8');

// The A4 QR Code section
const qrRegex = /(stack:\s*\[[\s\S]*?\{ text: takaInWords\(data\.totalPaisa\),[\s\S]*?\},)\s*(qrDataUrl \? \{ image: qrDataUrl, fit: \[56, 56\], margin: \[0, 8, 0, 0\] \} : \{\},)\s*(\],)/;

const qrReplacement = `$1
              {
                columns: [
                  qrDataUrl ? { width: 64, image: qrDataUrl, fit: [56, 56], margin: [0, 8, 0, 0] } : { width: 0, text: '' },
                  (data.customerPreviousDuePaisa !== undefined && data.previousDuePaidPaisa !== undefined && data.customerRemainingDuePaisa !== undefined) && 
                  (data.customerPreviousDuePaisa > 0 || data.previousDuePaidPaisa > 0 || data.customerRemainingDuePaisa > 0)
                    ? {
                        width: 180,
                        table: {
                          widths: ['*', 65],
                          body: [
                            [{ text: 'Customer Balance Summary', bold: true, colSpan: 2, fontSize: size.meta - 1, margin: [0, 0, 0, 2], alignment: 'left', color: INK }, {}],
                            [{ text: 'Previous Due :', alignment: 'left', fontSize: size.fine, color: MUTED }, { text: money(data.customerPreviousDuePaisa), alignment: 'right', fontSize: size.fine, color: INK }],
                            [{ text: 'Paid Today :', alignment: 'left', fontSize: size.fine, color: MUTED }, { text: money(data.previousDuePaidPaisa), alignment: 'right', fontSize: size.fine, color: INK }],
                            [{ text: 'Remaining Due :', alignment: 'left', bold: true, fontSize: size.fine, color: INK }, { text: money(data.customerRemainingDuePaisa), bold: true, alignment: 'right', fontSize: size.fine, color: INK }]
                          ]
                        },
                        layout: 'noBorders',
                        margin: [0, 8, 0, 0]
                      }
                    : { width: '*', text: '' }
                ]
              }
$3`;

pdf = pdf.replace(qrRegex, qrReplacement);

// Remove the old A4 Customer Balance Summary at the bottom
const oldA4SummaryRegex = /\/\/\s*Customer Balance Summary \(A4\)[\s\S]*?data\.customerPreviousDuePaisa !== undefined[\s\S]*?\? \{\s*columns: \[\s*\{\s*width: '\*', text: '' \},\s*\/\/ Spacer[\s\S]*?margin: \[0, 4, 0, 4\]\s*\}\s*\]\s*\}\s*: \{\},/g;
pdf = pdf.replace(oldA4SummaryRegex, '');

// Update the Thermal condition to be smarter too
const thermalRegex = /(data\.customerPreviousDuePaisa !== undefined && data\.previousDuePaidPaisa !== undefined && data\.customerRemainingDuePaisa !== undefined)\s*\? \{/g;
pdf = pdf.replace(thermalRegex, '$1 && (data.customerPreviousDuePaisa > 0 || data.previousDuePaidPaisa > 0 || data.customerRemainingDuePaisa > 0) ? {');

fs.writeFileSync(pdfPath, pdf, 'utf8');
console.log('Fixed invoicePdf.ts layout');
