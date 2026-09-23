const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/pos/PosView.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Definition
content = content.replace(
  /const totalPaisa = Math\.max\(0, subtotalPaisa - discountPaisa\);/,
  "const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);\n  const previousDuePaidPaisa = Math.round((parseFloat(previousDuePaidTaka) || 0) * 100);\n  const grandTotalExpectedPaisa = totalPaisa + previousDuePaidPaisa;"
);

// 2. Paid Logic
const isFullDueRe = /const isFullDue = isDueSaleMode && Boolean\(selectedCustomerId\) && totalPaidPaisa === 0;\s*const effectiveCashPaisa = \(!isFullDue && totalPaidPaisa === 0\) \? totalPaisa : cashPaisa;\s*const effectivePaidPaisa = isFullDue \? 0 : \(totalPaidPaisa === 0 \? totalPaisa : totalPaidPaisa\);\s*const effectiveChangePaisa = Math\.max\(0, effectivePaidPaisa - totalPaisa\);\s*const effectiveDuePaisa = Math\.max\(0, totalPaisa - effectivePaidPaisa\);\s*const changePaisa = Math\.max\(0, totalPaidPaisa - totalPaisa\);\s*const duePaisa = Math\.max\(0, totalPaisa - totalPaidPaisa\);/g;

const isFullDueReplace = `const isFullDue = isDueSaleMode && Boolean(selectedCustomerId) && totalPaidPaisa === 0;
  const effectiveCashPaisa = (!isFullDue && totalPaidPaisa === 0) ? grandTotalExpectedPaisa : cashPaisa;
  const effectivePaidPaisa = isFullDue ? 0 : (totalPaidPaisa === 0 ? grandTotalExpectedPaisa : totalPaidPaisa);
  const effectiveChangePaisa = Math.max(0, effectivePaidPaisa - grandTotalExpectedPaisa);
  const effectiveDuePaisa = Math.max(0, grandTotalExpectedPaisa - effectivePaidPaisa);

  const changePaisa = Math.max(0, totalPaidPaisa - grandTotalExpectedPaisa);
  const duePaisa = Math.max(0, grandTotalExpectedPaisa - totalPaidPaisa);`;

content = content.replace(isFullDueRe, isFullDueReplace);

fs.writeFileSync(path, content, 'utf8');
console.log('regex replace applied');
