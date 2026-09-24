const fs = require('fs');

let c = fs.readFileSync('electron/ipc/routes/sales.ts', 'utf8');

const backendCheck = `
      if (payload.customer_id) {
        if ((payload.previous_due_paid_paisa || 0) > customerPreviousDuePaisa) {
          throw new Error('Cannot collect more than the current due.');
        }
      }
`;

// Insert after getting customerPreviousDuePaisa
const targetLine = 'const totalCollected = payload.payments.reduce((sum, p) => sum + (p.amount_paisa || 0), 0);';
c = c.replace(targetLine, backendCheck.trim() + '\n\n      ' + targetLine);

fs.writeFileSync('electron/ipc/routes/sales.ts', c);
