const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/types/ipc.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/total_paisa: number;\s*previous_due_paid_paisa\?: number;/g, 'total_paisa: number;');
content = content.replace(/total_paisa: number;/g, 'total_paisa: number;\n  previous_due_paid_paisa?: number;');

// Remove duplicates in SalePayload if any
content = content.replace(/previous_due_paid_paisa\?: number;\s*previous_due_paid_paisa\?: number;/g, 'previous_due_paid_paisa?: number;');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ipc.ts');
