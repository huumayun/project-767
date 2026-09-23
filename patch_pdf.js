const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

let searchStr = `        const netPaidPaisa = collectedPaisa - refundedBeforePaisa;
        const saleValueLeftPaisa = ret.original_total_paisa - (returnedBeforeTotalPaisa + totalRefundPaisa);
        const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;
        const cashRefundPaisa = Math.max(0, Math.min(totalRefundPaisa, netPaidPaisa, overpaidPaisa));
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;`;

let replaceStr = `        const refundPayment = db.prepare(\`
          SELECT amount_paisa FROM payments 
          WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND created_at = ?
        \`).get(ret.sale_id, ret.created_at) as any;
        const cashRefundPaisa = refundPayment ? refundPayment.amount_paisa : 0;
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;`;

// Replace all occurrences (there should be 2)
c = c.split(searchStr).join(replaceStr);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
