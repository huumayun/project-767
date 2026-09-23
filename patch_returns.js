const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

// 1. Patch processReturn
const processReturnRegex = /const cashRefundPaisa = Math\.max\(0, Math\.min\(totalRefundPaisa, netPaidPaisa, overpaidPaisa\)\);\s+const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;/;
const processReturnPatch = `let cashRefundPaisa = Math.max(0, Math.min(totalRefundPaisa, netPaidPaisa, overpaidPaisa));
        let creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;

        if (creditedToDuePaisa > 0 && sale.customer_id) {
          const customerDueRow = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(sale.customer_id) as any;
          const currentGlobalDue = customerDueRow ? customerDueRow.due_paisa : 0;
          if (creditedToDuePaisa > currentGlobalDue) {
            const excessCredit = creditedToDuePaisa - Math.max(0, currentGlobalDue);
            creditedToDuePaisa -= excessCredit;
            cashRefundPaisa += excessCredit;
          }
        }`;

c = c.replace(processReturnRegex, processReturnPatch);

// 2. Patch generateReturnPdf & getReturnByInvoice
// They both have this block:
/*
        const refundedBeforePaisa = (db.prepare(`
          SELECT COALESCE(SUM(amount_paisa), 0) AS n
          FROM payments
          WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND deleted_at IS NULL AND created_at < ?
        `).get(ret.sale_id, ret.created_at) as any).n;

        const netPaidPaisa = collectedPaisa - refundedBeforePaisa;
        const saleValueLeftPaisa = ret.original_total_paisa - (returnedBeforeTotalPaisa + totalRefundPaisa);
        const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;
        const cashRefundPaisa = Math.max(0, Math.min(totalRefundPaisa, netPaidPaisa, overpaidPaisa));
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;
*/
const pdfRegex = /const refundedBeforePaisa = \(db\.prepare\(\`\s+SELECT COALESCE\(SUM\(amount_paisa\), 0\) AS n\s+FROM payments\s+WHERE sale_id = \? AND direction = 'out' AND type = 'refund' AND deleted_at IS NULL AND created_at < \?\s+\`\)\.get\(ret\.sale_id, ret\.created_at\) as any\)\.n;\s+const netPaidPaisa = collectedPaisa - refundedBeforePaisa;\s+const saleValueLeftPaisa = ret\.original_total_paisa - \(returnedBeforeTotalPaisa \+ totalRefundPaisa\);\s+const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;\s+const cashRefundPaisa = Math\.max\(0, Math\.min\(totalRefundPaisa, netPaidPaisa, overpaidPaisa\)\);\s+const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;/g;

const pdfPatch = `const refundPayment = db.prepare(\`
          SELECT amount_paisa FROM payments 
          WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND created_at = ?
        \`).get(ret.sale_id, ret.created_at) as any;
        const cashRefundPaisa = refundPayment ? refundPayment.amount_paisa : 0;
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;`;

c = c.replace(pdfRegex, pdfPatch);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
