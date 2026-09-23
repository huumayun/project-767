import re

with open('electron/ipc/routes/sales.ts', 'r', encoding='utf-8') as f:
    c = f.read()

pattern = re.compile(
    r"const netPaidPaisa = collectedPaisa - refundedBeforePaisa;\s+"
    r"const saleValueLeftPaisa = ret\.original_total_paisa - \(returnedBeforeTotalPaisa \+ totalRefundPaisa\);\s+"
    r"const overpaidPaisa = netPaidPaisa - saleValueLeftPaisa;\s+"
    r"const cashRefundPaisa = Math\.max\(0, Math\.min\(totalRefundPaisa, netPaidPaisa, overpaidPaisa\)\);\s+"
    r"const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;",
    re.MULTILINE
)

replacement = """const refundPayment = db.prepare(`
          SELECT amount_paisa FROM payments 
          WHERE sale_id = ? AND direction = 'out' AND type = 'refund' AND created_at = ?
        `).get(ret.sale_id, ret.created_at) as any;
        const cashRefundPaisa = refundPayment ? refundPayment.amount_paisa : 0;
        const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;"""

c, count = pattern.subn(replacement, c)
print(f"Replaced {count} occurrences")

with open('electron/ipc/routes/sales.ts', 'w', encoding='utf-8') as f:
    f.write(c)
