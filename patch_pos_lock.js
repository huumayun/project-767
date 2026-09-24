const fs = require('fs');

let c = fs.readFileSync('src/components/pos/PosView.tsx', 'utf8');

const errorCheck = `
    if (selectedCustomer && previousDuePaidPaisa > (selectedCustomer.due_paisa || 0)) {
      toast.error(\`You cannot collect more than the customer's previous due (৳ \${((selectedCustomer.due_paisa || 0) / 100).toFixed(2)})!\`);
      return;
    }
`;

// Insert into handleStartCheckout
const startIdx = c.indexOf('const handleStartCheckout = () => {');
if (startIdx !== -1) {
  const guardIdx = c.indexOf('if (!canTakeMoney)', startIdx);
  if (guardIdx !== -1) {
    c = c.substring(0, guardIdx) + errorCheck.trim() + '\n\n    ' + c.substring(guardIdx);
  }
}

fs.writeFileSync('src/components/pos/PosView.tsx', c);
