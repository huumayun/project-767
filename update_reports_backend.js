const fs = require('fs');

// 1. Update src/types/ipc.ts
const typesPath = 'c:/Users/humay/Music/project-767/src/types/ipc.ts';
let typesContent = fs.readFileSync(typesPath, 'utf8');

const newType = `  due_collection_details?: Array<{
    date: string;
    customer_name: string;
    source: string;
    invoice_no?: string;
    bill_amount_paisa: number;
    collected_paisa: number;
    payment_method: string;
  }>;
`;

if (!typesContent.includes('due_collection_details')) {
  typesContent = typesContent.replace(/due_collection_paisa: number;/g, 'due_collection_paisa: number;\n' + newType);
  fs.writeFileSync(typesPath, typesContent, 'utf8');
  console.log('Updated ipc.ts');
}

// 2. Update electron/ipc/routes/reports.ts
const reportsPath = 'c:/Users/humay/Music/project-767/electron/ipc/routes/reports.ts';
let reportsContent = fs.readFileSync(reportsPath, 'utf8');

const dueQueryCode = `      const dueCollectionPaisa = (standaloneDue.total || 0) + (salesDue.total || 0);

      // Fetch due collection details
      const standaloneDueDetails = db.prepare(\`
        SELECT 
          p.created_at, 
          c.name as customer_name,
          'Standalone' as source,
          NULL as invoice_no,
          0 as bill_amount_paisa,
          p.amount_paisa as collected_paisa,
          p.method as payment_method
        FROM payments p
        LEFT JOIN customers c ON p.customer_id = c.id
        WHERE p.deleted_at IS NULL AND p.type = 'due_collection' AND p.direction = 'in'
          AND \${saleDay} BETWEEN ? AND ?
      \`).all(startDate, endDate);

      const salesDueDetails = db.prepare(\`
        SELECT 
          s.created_at,
          c.name as customer_name,
          'Invoice' as source,
          s.invoice_no,
          s.total_paisa as bill_amount_paisa,
          s.previous_due_paid_paisa as collected_paisa,
          'Mixed' as payment_method
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE s.deleted_at IS NULL AND s.status != 'held' AND s.previous_due_paid_paisa > 0
          AND \${saleDay} BETWEEN ? AND ?
      \`).all(startDate, endDate);

      const dueCollectionDetails = [...standaloneDueDetails, ...salesDueDetails].sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).map((d: any) => ({
        date: d.created_at,
        customer_name: d.customer_name || 'Walk-in Customer',
        source: d.source,
        invoice_no: d.invoice_no,
        bill_amount_paisa: d.bill_amount_paisa,
        collected_paisa: d.collected_paisa,
        payment_method: d.payment_method
      }));
`;

reportsContent = reportsContent.replace(/const dueCollectionPaisa = \(standaloneDue\.total \|\| 0\) \+ \(salesDue\.total \|\| 0\);/, dueQueryCode);
reportsContent = reportsContent.replace(/due_collection_paisa: dueCollectionPaisa,/, 'due_collection_paisa: dueCollectionPaisa,\n          due_collection_details: dueCollectionDetails,');

fs.writeFileSync(reportsPath, reportsContent, 'utf8');
console.log('Updated reports.ts');
