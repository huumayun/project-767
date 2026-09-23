const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/reports.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add due collection from sales
const trendsMapRegex = /const trendsMap: Record<string, \{/g;

const fetchDueCollectionLogic = `
      // Due collection from standalone payments
      const standaloneDue = db.prepare(\`
        SELECT COALESCE(SUM(amount_paisa), 0) AS total
        FROM payments
        WHERE deleted_at IS NULL AND type = 'due_collection' AND direction = 'in'
          AND \${saleDay} BETWEEN ? AND ?
      \`).get(startDate, endDate) as any;

      // Due collection from sales
      const salesDue = db.prepare(\`
        SELECT COALESCE(SUM(previous_due_paid_paisa), 0) AS total
        FROM sales
        WHERE deleted_at IS NULL AND status != 'held'
          AND \${saleDay} BETWEEN ? AND ?
      \`).get(startDate, endDate) as any;

      const dueCollectionPaisa = (standaloneDue.total || 0) + (salesDue.total || 0);
      
      const trendsMap: Record<string, {`;

content = content.replace(trendsMapRegex, fetchDueCollectionLogic);

// 2. Return dueCollectionPaisa in the final object
const returnRegex = /netSalesPaisa,\s*returnsCount: refundsCount,\s*returnedPaisa: totalReturnedPaisa,/g;
content = content.replace(returnRegex, 'netSalesPaisa,\n        dueCollectionPaisa,\n        returnsCount: refundsCount,\n        returnedPaisa: totalReturnedPaisa,');

// Also update the trend arrays if they need dueCollectionPaisa, but the frontend dashboard only expects the total.
// Wait, the frontend dashboard uses `reportRes.dueCollectionPaisa`? Let's check if we can add it to the report object.

fs.writeFileSync(path, content, 'utf8');
console.log('Patched reports.ts');
