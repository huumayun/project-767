const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'electron', 'ipc', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

// Retrieve calculateShiftSummary from old_handlers.txt
const oldHandlers = fs.readFileSync('old_handlers.txt', 'utf-8');
const calcRegex = /function calculateShiftSummary[\s\S]*?return summary;\n\}/;
const match = oldHandlers.match(calcRegex);
const calcFn = match ? match[0] : '';

// 1. Add calculateShiftSummary to shared.ts
let shared = fs.readFileSync('electron/ipc/shared.ts', 'utf-8');
if (calcFn && !shared.includes('export function calculateShiftSummary')) {
  shared += '\n\nexport ' + calcFn + '\n';
  fs.writeFileSync('electron/ipc/shared.ts', shared);
}

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Fix cartCalculations path
  content = content.replace(
    /import \{ calculateCartTotals \} from '.*?cartCalculations';/g,
    "// cart calculations not needed"
  );
  
  if (file === 'auth.ts') {
    if (!content.includes('let failedAttemptsMap')) {
      content = "let failedAttemptsMap: Record<string, number> = {};\n\n" + content;
    }
  }

  if (file === 'backup.ts') {
    if (!content.includes('import { listBackups')) {
      content = "import { listBackups, createDatabaseBackup, restoreDatabase } from '../../services/backupManager';\n" + content;
    }
  }

  if (file === 'products.ts') {
    if (!content.includes('import { processStockIn')) {
      content = "import { processStockIn } from '../../services/inventoryManager';\n" + content;
    }
  }

  if (file === 'sales.ts') {
    if (!content.includes('import { generateInvoiceNumber')) {
      content = "import { generateInvoiceNumber, InvoicePdfData, generateInvoicePdf } from '../../services/pdfGenerator';\n" + content;
    }
  }
  
  if (file === 'sync.ts') {
    if (!content.includes('import { getSyncStatus')) {
      content = "import { getSyncStatus, executeDeltaSync, encryptSecret } from '../../services/syncEngine';\n" + content;
    }
  }

  if (file === 'shifts.ts') {
    if (!content.includes('calculateShiftSummary } from')) {
      content = content.replace(/from '\.\.\/shared';/, ", calculateShiftSummary } from '../shared';");
    }
  }

  fs.writeFileSync(filePath, content);
});

console.log('Fixed everything');
