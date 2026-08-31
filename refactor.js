const { Project } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const project = new Project();
const sourceFile = project.addSourceFileAtPath('electron/ipc/handlers.ts');

const handlersDir = 'electron/ipc/routes';
if (!fs.existsSync(handlersDir)) {
  fs.mkdirSync(handlersDir, { recursive: true });
}

const domainMap = new Map();
const registerFn = sourceFile.getFunction('registerIpcHandlers');

const statements = registerFn.getBody().getStatements();
for (const stmt of statements) {
  const text = stmt.getText();
  const match = text.match(/ipcMain\.handle\(['"]api:([^:'"]+):/);
  let domain = 'system';
  if (match) {
    domain = match[1];
  } else {
    // maybe it's ping or something
    const match2 = text.match(/ipcMain\.handle\(['"]([^'"]+)['"]/);
    if (match2) {
      const full = match2[1];
      if (full.startsWith('api:')) {
        domain = full.replace('api:', '').split(':')[0];
      } else {
        domain = full;
      }
    }
  }
  
  if (!domain.match(/^[a-zA-Z0-9_]+$/)) domain = 'system';

  if (!domainMap.has(domain)) {
    domainMap.set(domain, []);
  }
  const leadingComments = stmt.getLeadingCommentRanges().map(c => c.getText()).join('\n');
  domainMap.get(domain).push({ text, leadingComments });
}

const imports = `import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db/database';
import { z } from 'zod';
import { calculateCartTotals } from '../../../src/utils/cartCalculations';
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit, calculateShiftSummary } from '../shared';
`;

const indexExports = [];
const indexImports = [];
const indexCalls = [];

for (const [domain, handlers] of domainMap.entries()) {
  const fileName = `${domain}.ts`;
  const filePath = path.join(handlersDir, fileName);
  
  let fileContent = imports + '\n\n';
  fileContent += `export function register${domain.charAt(0).toUpperCase() + domain.slice(1)}Handlers() {\n`;
  
  for (const handler of handlers) {
    if (handler.leadingComments) {
      fileContent += `  ${handler.leadingComments.replace(/\n/g, '\n  ')}\n`;
    }
    const bodyText = handler.text.split('\n').map((line, i) => i === 0 ? line : `  ${line}`).join('\n');
    fileContent += `  ${bodyText}\n\n`;
  }
  
  fileContent += `}\n`;
  
  if (domain === 'auth') {
    fileContent = fileContent.replace(/activeSession = null;/g, 'setActiveSession(null);');
    fileContent = fileContent.replace(/activeSession = \{/g, 'setActiveSession({');
    fileContent = fileContent.replace(/activeSession = userRow/g, 'setActiveSession(userRow');
  }

  fs.writeFileSync(filePath, fileContent);
  
  const fnName = `register${domain.charAt(0).toUpperCase() + domain.slice(1)}Handlers`;
  indexImports.push(`import { ${fnName} } from './routes/${domain}';`);
  indexCalls.push(`  ${fnName}();`);
}

let sharedContent = `import { getDb } from '../db/database';\n\n`;

const topLevelStmts = sourceFile.getStatements().filter(s => s.getKindName() !== 'ImportDeclaration' && s.getKindName() !== 'FunctionDeclaration');
for (const stmt of topLevelStmts) {
  if (stmt.getText().includes('export interface') || stmt.getText().includes('let activeSession')) {
    sharedContent += stmt.getText() + '\n\n';
  }
}

const fnsToExtract = ['getDeviceId', 'requireRole', 'logAudit', 'calculateShiftSummary'];
for (const fnName of fnsToExtract) {
  const fn = sourceFile.getFunction(fnName);
  if (fn) {
    sharedContent += fn.getText().replace(`function ${fnName}`, `export function ${fnName}`) + '\n\n';
  }
}

sharedContent = sharedContent.replace(`let activeSession`, `export let activeSession`);
sharedContent += `
export function setActiveSession(session: any) {
  activeSession = session;
}
`;

fs.writeFileSync('electron/ipc/shared.ts', sharedContent);

let indexContent = `import { ipcMain } from 'electron';\n`;
indexContent += indexImports.join('\n') + '\n\n';
indexContent += `export function registerIpcHandlers() {\n`;
indexContent += `  // Registered Route Handlers\n`;
indexContent += indexCalls.join('\n') + '\n';
indexContent += `}\n`;

fs.writeFileSync('electron/ipc/handlers_new.ts', indexContent);

console.log('Refactoring complete!');
