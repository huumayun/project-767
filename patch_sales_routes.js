const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/sales.ts';
let content = fs.readFileSync(path, 'utf8');

// We need to patch api:sales:getByInvoice and api:sales:generatePdf to fetch current due and pass the 3 fields.

function patchFunction(content, funcName) {
  // Find where pdfData is defined
  const pdfDataRegex = new RegExp(`(ipcMain\\.handle\\('${funcName}'[\\s\\S]*?const pdfData: InvoicePdfData = \\{[\\s\\S]*?)(duePaisa,\\s*)([\\s\\S]*?\\};)`, 'g');
  
  return content.replace(pdfDataRegex, (match, prefix, duePaisaLine, suffix) => {
    // Before creating pdfData, we need to fetch customerPreviousDuePaisa
    // Wait, let's inject the fetch logic right before pdfData:
    
    // Check if we already injected it
    if (prefix.includes('let customerPreviousDuePaisa = 0;')) {
      return match; // Already patched
    }

    const fetchLogic = `
      let customerPreviousDuePaisa = 0;
      if (sale.customer_id) {
        const dueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(sale.customer_id) as any;
        if (dueRow) customerPreviousDuePaisa = dueRow.due_paisa;
      }
    `;
    
    const newPrefix = prefix.replace(/const pdfData: InvoicePdfData = \{/, fetchLogic + '\n      const pdfData: InvoicePdfData = {');
    
    const newFields = `
          customerPreviousDuePaisa: sale.customer_id ? customerPreviousDuePaisa : undefined,
          previousDuePaidPaisa: sale.customer_id && sale.previous_due_paid_paisa ? sale.previous_due_paid_paisa : undefined,
          customerRemainingDuePaisa: sale.customer_id ? customerPreviousDuePaisa - (sale.previous_due_paid_paisa || 0) + duePaisa : undefined,
    `;
    
    // Remove the old previousDuePaidPaisa if it exists in suffix
    let cleanSuffix = suffix.replace(/previousDuePaidPaisa:[\s\S]*?,/g, '');
    
    return newPrefix + duePaisaLine + newFields + cleanSuffix;
  });
}

content = patchFunction(content, 'api:sales:getByInvoice');
content = patchFunction(content, 'api:sales:generatePdf');

fs.writeFileSync(path, content, 'utf8');
console.log('Patched getByInvoice and generatePdf');
