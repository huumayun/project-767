const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/shared.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add s.previous_due_paid_paisa to the sales query
content = content.replace(
  /s\.customer_id,\s*COALESCE\(c\.name, 'Walk-in'\) AS customer_name,/g,
  `s.customer_id,
      COALESCE(s.previous_due_paid_paisa, 0) AS previous_due_paid_paisa,
      COALESCE(c.name, 'Walk-in') AS customer_name,`
);

// 2. Distribute previous_due_paid_paisa after payments loop
const paymentsLoopRegex = /(payments\.forEach\(\(p\) => \{[\s\S]*?\}\);\s*)/;
const distributionLogic = `
  // Move previous_due_paid_paisa from sales totals to due collected totals
  sales.forEach((s) => {
    let duePaid = s.previous_due_paid_paisa;
    if (duePaid > 0) {
      if (cashSalesPaisa >= duePaid) {
        cashSalesPaisa -= duePaid;
        cashDueCollectedPaisa += duePaid;
      } else {
        duePaid -= cashSalesPaisa;
        cashDueCollectedPaisa += cashSalesPaisa;
        cashSalesPaisa = 0;
        
        if (bkashSalesPaisa >= duePaid) {
          bkashSalesPaisa -= duePaid;
          otherDueCollectedPaisa += duePaid;
        } else {
          duePaid -= bkashSalesPaisa;
          otherDueCollectedPaisa += bkashSalesPaisa;
          bkashSalesPaisa = 0;
          
          if (nagadSalesPaisa >= duePaid) {
            nagadSalesPaisa -= duePaid;
            otherDueCollectedPaisa += duePaid;
          } else {
            duePaid -= nagadSalesPaisa;
            otherDueCollectedPaisa += nagadSalesPaisa;
            nagadSalesPaisa = 0;
            
            if (cardSalesPaisa >= duePaid) {
              cardSalesPaisa -= duePaid;
              otherDueCollectedPaisa += duePaid;
            } else {
              duePaid -= cardSalesPaisa;
              otherDueCollectedPaisa += cardSalesPaisa;
              cardSalesPaisa = 0;
              
              if (otherSalesPaisa >= duePaid) {
                otherSalesPaisa -= duePaid;
                otherDueCollectedPaisa += duePaid;
              }
            }
          }
        }
      }
    }
  });
`;

content = content.replace(paymentsLoopRegex, (match) => match + distributionLogic);

fs.writeFileSync(path, content, 'utf8');
console.log('Patched shared.ts for shift calculations');
