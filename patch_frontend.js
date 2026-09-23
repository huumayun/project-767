const fs = require('fs');
let c = fs.readFileSync('src/components/pos/ReturnRefundModal.tsx', 'utf8');
c = c.replace(/const cashRefundPaisa = Math\.max\(0, Math\.min\(totalRefundPaisa, netPaidPaisa, overpaidPaisa\)\);\s+const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;/g, 
`let cashRefundPaisa = Math.max(0, Math.min(totalRefundPaisa, netPaidPaisa, overpaidPaisa));
            let creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;
            if (creditedToDuePaisa > 0 && customerInfo) {
              const currentGlobalDue = customerInfo.due_paisa || 0;
              if (creditedToDuePaisa > currentGlobalDue) {
                const excessCredit = creditedToDuePaisa - Math.max(0, currentGlobalDue);
                creditedToDuePaisa -= excessCredit;
                cashRefundPaisa += excessCredit;
              }
            }`);
fs.writeFileSync('src/components/pos/ReturnRefundModal.tsx', c);
