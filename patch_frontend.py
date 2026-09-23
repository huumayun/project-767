import re

with open('src/components/pos/ReturnRefundModal.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

pattern = re.compile(
    r"const cashRefundPaisa = Math\.max\(0, Math\.min\(totalRefundPaisa, netPaidPaisa, overpaidPaisa\)\);\s+"
    r"const creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;",
    re.MULTILINE
)

replacement = """let cashRefundPaisa = Math.max(0, Math.min(totalRefundPaisa, netPaidPaisa, overpaidPaisa));
            let creditedToDuePaisa = totalRefundPaisa - cashRefundPaisa;
            if (creditedToDuePaisa > 0 && customerInfo) {
              const currentGlobalDue = customerInfo.due_paisa || 0;
              if (creditedToDuePaisa > currentGlobalDue) {
                const excessCredit = creditedToDuePaisa - Math.max(0, currentGlobalDue);
                creditedToDuePaisa -= excessCredit;
                cashRefundPaisa += excessCredit;
              }
            }"""

c, count = pattern.subn(replacement, c)
print(f"Replaced {count} occurrences")

with open('src/components/pos/ReturnRefundModal.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
