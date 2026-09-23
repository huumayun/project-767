const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/types/ipc.ts';
let content = fs.readFileSync(path, 'utf8');

// I will just use regex to remove all instances of `previous_due_paid_paisa?: number;` and add it back exactly where needed.
content = content.replace(/previous_due_paid_paisa\?: number;\r?\n\s*/g, '');

content = content.replace(
  /export interface SaleRecord \{/g,
  'export interface SaleRecord {\n    previous_due_paid_paisa?: number;'
);

content = content.replace(
  /export interface ShiftSaleRow \{/g,
  'export interface ShiftSaleRow {\n    previous_due_paid_paisa?: number;'
);

content = content.replace(
  /export interface SalePayload \{/g,
  'export interface SalePayload {\n    previous_due_paid_paisa?: number;'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed ipc.ts perfectly');
