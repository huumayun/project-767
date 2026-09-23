const fs = require('fs');
let c = fs.readFileSync('src/components/pos/InvoiceModal.tsx', 'utf8');

c = c.replace(/    };\r?\n\r?\n  useEffect\(\(\) => {\r?\n    if \(isOpen && invoiceNo\) {/,
  `    };

  useEffect(() => {
    if (initialPdf) {
      setPdfData(initialPdf);
    }
  }, [initialPdf, invoiceNo]);

  useEffect(() => {
    if (isOpen && invoiceNo) {`);

fs.writeFileSync('src/components/pos/InvoiceModal.tsx', c);
