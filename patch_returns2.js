const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

const t1 = `      const netPaidPaisa = collectedPaisa - refundedBeforePaisa;
      const saleValueLeftPaisa = ret.original_total_paisa - (returnedBeforeTotalPaisa + totalRefundPaisa);
      const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;
      const cashRefundPaisa = Math.max(0, Math.min(totalRefundPaisa, netPaidPaisa, overpaidPaisa));
      const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;`;

const r1 = `      const refundPayment = db.prepare(\`
        SELECT amount_paisa FROM payments 
        WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND created_at = ?
      \`).get(ret.sale_id, ret.created_at) as any;
      const cashRefundPaisa = refundPayment ? refundPayment.amount_paisa : 0;
      const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;`;

c = c.replace(t1, r1);

// Wait, the indent in getReturnByInvoice vs generateReturnPdf might be slightly different.
// Let's do a more robust replace:

const patchPDF = (code) => {
  return code.replace(/const netPaidPaisa = collectedPaisa - refundedBeforePaisa;\s+const saleValueLeftPaisa = ret\.original_total_paisa - \(returnedBeforeTotalPaisa \+ totalRefundPaisa\);\s+const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;\s+const cashRefundPaisa = Math\.max\(0, Math\.min\(totalRefundPaisa, netPaidPaisa, overpaidPaisa\)\);\s+const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;/g, 
  \`const refundPayment = db.prepare(\\\\\`
          SELECT amount_paisa FROM payments 
          WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND created_at = ?
        \\\\\`).get(ret.sale_id, ret.created_at) as any;
        const cashRefundPaisa = refundPayment ? refundPayment.amount_paisa : 0;
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;\`);
}

c = patchPDF(c);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
