const fs = require('fs');

const path = 'c:/Users/humay/Music/project-767/src/components/pos/PosView.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add state for previousDuePaidTaka
content = content.replace(
  "const [cashAmount, setCashAmount] = useState<string>('');",
  "const [cashAmount, setCashAmount] = useState<string>('');\n  const [previousDuePaidTaka, setPreviousDuePaidTaka] = useState<string>('');"
);

// 2. Clear state on handleClearCart
content = content.replace(
  "setOtherAmount('');",
  "setOtherAmount('');\n    setPreviousDuePaidTaka('');"
);

// 3. Calculation logic
const calcTarget = `const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);
  
    const cashPaisa = Math.round((parseFloat(cashAmount) || 0) * 100);`;

const calcReplace = `const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);
  
    const previousDuePaidPaisa = Math.round((parseFloat(previousDuePaidTaka) || 0) * 100);
    const grandTotalExpectedPaisa = totalPaisa + previousDuePaidPaisa;

    const cashPaisa = Math.round((parseFloat(cashAmount) || 0) * 100);`;

content = content.replace(calcTarget, calcReplace);

const paidLogicTarget = `const isFullDue = isDueSaleMode && Boolean(selectedCustomerId) && totalPaidPaisa === 0;
    const effectiveCashPaisa = (!isFullDue && totalPaidPaisa === 0) ? totalPaisa : cashPaisa;
    const effectivePaidPaisa = isFullDue ? 0 : (totalPaidPaisa === 0 ? totalPaisa : totalPaidPaisa);
    const effectiveChangePaisa = Math.max(0, effectivePaidPaisa - totalPaisa);
    const effectiveDuePaisa = Math.max(0, totalPaisa - effectivePaidPaisa);
  
    const changePaisa = Math.max(0, totalPaidPaisa - totalPaisa);
    const duePaisa = Math.max(0, totalPaisa - totalPaidPaisa);`;

const paidLogicReplace = `const isFullDue = isDueSaleMode && Boolean(selectedCustomerId) && totalPaidPaisa === 0;
    const effectiveCashPaisa = (!isFullDue && totalPaidPaisa === 0) ? grandTotalExpectedPaisa : cashPaisa;
    const effectivePaidPaisa = isFullDue ? 0 : (totalPaidPaisa === 0 ? grandTotalExpectedPaisa : totalPaidPaisa);
    const effectiveChangePaisa = Math.max(0, effectivePaidPaisa - grandTotalExpectedPaisa);
    const effectiveDuePaisa = Math.max(0, grandTotalExpectedPaisa - effectivePaidPaisa);
  
    const changePaisa = Math.max(0, totalPaidPaisa - grandTotalExpectedPaisa);
    const duePaisa = Math.max(0, grandTotalExpectedPaisa - totalPaidPaisa);`;

content = content.replace(paidLogicTarget, paidLogicReplace);

// 4. Fix confirm messages replacing totalPaisa with grandTotalExpectedPaisa
content = content.replace(
  "message: `Record ৳ ${(totalPaisa / 100).toFixed(",
  "message: `Record ৳ ${(grandTotalExpectedPaisa / 100).toFixed("
);
content = content.replace(
  "message: `Has the customer paid the full ৳ ${(totalPaisa / 100).toFixed(2)} in cash?`,",
  "message: `Has the customer paid the full ৳ ${(grandTotalExpectedPaisa / 100).toFixed(2)} in cash?`,"
);
content = content.replace(
  "setCashAmount((totalPaisa / 100).toFixed(2));",
  "setCashAmount((grandTotalExpectedPaisa / 100).toFixed(2));"
);
content = content.replace(
  "Due sale: ৳${(totalPaisa / 100).toFixed(2)} — press Complete Sale",
  "Due sale: ৳${(grandTotalExpectedPaisa / 100).toFixed(2)} — press Complete Sale"
);
content = content.replace(
  "change ৳${(amount - totalPaisa / 100).toFixed(2)}",
  "change ৳${(amount - grandTotalExpectedPaisa / 100).toFixed(2)}"
);


// 5. Add to payload
content = content.replace(
  "customer_id: selectedCustomerId || null,",
  "customer_id: selectedCustomerId || null,\n          previous_due_paid_paisa: previousDuePaidPaisa,"
);

// 6. UI Injection
const uiTarget = `{customerPickerOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-jungle-teal-50 border`;

const uiReplace = `{selectedCustomer && (selectedCustomer.due_paisa || 0) > 0 && (
                  <div className="w-full mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                    <span className="text-ui-2xs font-semibold text-amber-800">Collect Previous Due ৳</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Amount"
                      value={previousDuePaidTaka}
                      onChange={(e) => setPreviousDuePaidTaka(e.target.value)}
                      className="w-20 text-right bg-white border border-amber-300 rounded text-ui-sm font-mono text-amber-900 px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                )}
                
                {customerPickerOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-jungle-teal-50 border`;

content = content.replace(uiTarget, uiReplace);

// 7. Update display total in bottom totals box
content = content.replace(
  `<span className="text-xl font-bold font-mono">৳ {(totalPaisa / 100).toFixed(2)}</span>`,
  `<span className="text-xl font-bold font-mono">৳ {(grandTotalExpectedPaisa / 100).toFixed(2)}</span>`
);
content = content.replace(
  `{discountPaisa > 0 && (`,
  `{previousDuePaidPaisa > 0 && (
                    <div className="flex justify-between items-center text-amber-700">
                      <span>Prev. Due Add</span>
                      <span className="font-mono font-semibold">+৳ {(previousDuePaidPaisa / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {discountPaisa > 0 && (`
);

fs.writeFileSync(path, content, 'utf8');
console.log('PosView.tsx updated again');
