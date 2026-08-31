const fs = require('fs');

let shared = fs.readFileSync('electron/ipc/shared.ts', 'utf-8');
const oldHandlers = fs.readFileSync('old_handlers.txt', 'utf-8');

// 1. extract generateInvoiceNumber
const invoiceMatch = oldHandlers.match(/function generateInvoiceNumber[\s\S]*?return \\$\{prefix\}\$\{datePart\}\$\{serialStr\}\;\n\}/);
if (invoiceMatch && !shared.includes('generateInvoiceNumber')) {
  shared += '\n\nexport ' + invoiceMatch[0] + '\n';
}

// 2. extract processStockIn
const stockMatch = oldHandlers.match(/function processStockIn[\s\S]*?device_id: deviceId\n    \}\)\);\n  \}/);
if (stockMatch && !shared.includes('processStockIn')) {
  shared += '\n\nexport ' + stockMatch[0] + '\n';
}

fs.writeFileSync('electron/ipc/shared.ts', shared);

// Update route files to import from shared instead of fake services, and fix other imports
const path = require('path');
const routesDir = path.join(__dirname, 'electron', 'ipc', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  // Fix pdfGenerator import
  content = content.replace(/import \{ generateInvoiceNumber, InvoicePdfData, generateInvoicePdf \} from '..\/..\/services\/pdfGenerator';/g, "");
  content = content.replace(/import \{ generateInvoicePdf, InvoicePdfData \} from '\.\.\/services\/invoicePdf';/g, "");

  if (file === 'sales.ts') {
    content = "import { generateInvoicePdf, InvoicePdfData } from '../../services/invoicePdf';\n" + content;
    if (!content.includes('generateInvoiceNumber } from')) {
      content = content.replace(/from '\.\.\/shared';/, ", generateInvoiceNumber } from '../shared';");
    }
  }

  // Fix processStockIn
  content = content.replace(/import \{ processStockIn \} from '..\/..\/services\/inventoryManager';/g, "");
  if (file === 'products.ts') {
    if (!content.includes('processStockIn } from')) {
      content = content.replace(/from '\.\.\/shared';/, ", processStockIn } from '../shared';");
    }
  }

  // Fix syncEngine
  content = content.replace(/import \{ getSyncStatus, executeDeltaSync, encryptSecret \} from '..\/..\/services\/syncEngine';/g, "");
  if (file === 'sync.ts') {
    content = "import { getSyncStatus, executeDeltaSync } from '../../services/syncEngine';\nimport { encryptSecret, decryptSecret } from '../../services/safeStore';\n" + content;
  }

  // Fix backupManager
  content = content.replace(/import \{ listBackups, createDatabaseBackup, restoreDatabase \} from '..\/..\/services\/backupManager';/g, "");
  if (file === 'backup.ts') {
    content = "import { listBackups, createDatabaseBackup, restoreDatabase } from '../../services/backupManager';\n" + content;
  }

  fs.writeFileSync(filePath, content);
});

console.log('Fixed helper extraction and imports!');
