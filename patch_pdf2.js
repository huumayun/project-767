const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

c = c.replace(/const netPaidPaisa = collectedPaisa - refundedBeforePaisa;[\s\n\r]*const saleValueLeftPaisa = ret\.original_total_paisa - \(returnedBeforeTotalPaisa \+ totalRefundPaisa\);[\s\n\r]*const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;[\s\n\r]*const cashRefundPaisa = Math\.max\(0, Math\.min\(totalRefundPaisa, netPaidPaisa, overpaidPaisa\)\);[\s\n\r]*const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;/g, 
`const refundPayment = db.prepare(\`
          SELECT amount_paisa FROM payments 
          WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND created_at = ?
        \`).get(ret.sale_id, ret.created_at) as any;
        const cashRefundPaisa = refundPayment ? refundPayment.amount_paisa : 0;
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;`);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
