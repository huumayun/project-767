const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/electron/ipc/routes/sales.ts';
let content = fs.readFileSync(path, 'utf8');

const schemaRe = /payments: z\.array\(z\.object\(\{\s*method: z\.enum\(\['cash', 'bkash', 'nagad', 'card', 'other'\]\),\s*amount_paisa: z\.number\(\)\.int\(\)\.min\(0\),\s*\}\)\)\.min\(1\),/;
const schemaRep = `payments: z.array(z.object({
            method: z.enum(['cash', 'bkash', 'nagad', 'card', 'other']),
            amount_paisa: z.number().int().min(0),
          })).min(1),
          previous_due_paid_paisa: z.number().int().min(0).optional().default(0),`;

content = content.replace(schemaRe, schemaRep);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed schema');
