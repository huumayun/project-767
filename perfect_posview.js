const fs = require('fs');
const path = 'c:/Users/humay/Music/project-767/src/components/pos/PosView.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. State
content = content.replace(
  "const [cashAmount, setCashAmount] = useState<string>('');",
  "const [cashAmount, setCashAmount] = useState<string>('');\n  const [previousDuePaidTaka, setPreviousDuePaidTaka] = useState<string>('');"
);

// 2. Clear state
content = content.replace(
  "setOtherAmount('');",
  "setOtherAmount('');\n    setPreviousDuePaidTaka('');"
);

// 3. Calculation definitions
content = content.replace(
  /const totalPaisa = Math\.max\(0, subtotalPaisa - discountPaisa\);/,
  "const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);\n  const previousDuePaidPaisa = Math.round((parseFloat(previousDuePaidTaka) || 0) * 100);\n  const grandTotalExpectedPaisa = totalPaisa + previousDuePaidPaisa;"
);

// 4. Quick cash generation
content = content.replace(
  "if (totalPaisa <= 0) return [] as number[];\n    const totalTaka = totalPaisa / 100;",
  "if (grandTotalExpectedPaisa <= 0) return [] as number[];\n    const totalTaka = grandTotalExpectedPaisa / 100;"
);

// 5. Paid logic (effectiveCashPaisa, etc)
const isFullDueRe = /const isFullDue = isDueSaleMode && Boolean\(selectedCustomerId\) && totalPaidPaisa === 0;\s*const effectiveCashPaisa = \(!isFullDue && totalPaidPaisa === 0\) \? totalPaisa : cashPaisa;\s*const effectivePaidPaisa = isFullDue \? 0 : \(totalPaidPaisa === 0 \? totalPaisa : totalPaidPaisa\);\s*const effectiveChangePaisa = Math\.max\(0, effectivePaidPaisa - totalPaisa\);\s*const effectiveDuePaisa = Math\.max\(0, totalPaisa - effectivePaidPaisa\);\s*const changePaisa = Math\.max\(0, totalPaidPaisa - totalPaisa\);\s*const duePaisa = Math\.max\(0, totalPaisa - totalPaidPaisa\);/g;

const isFullDueReplace = `const isFullDue = isDueSaleMode && Boolean(selectedCustomerId) && totalPaidPaisa === 0;
  const effectiveCashPaisa = (!isFullDue && totalPaidPaisa === 0) ? grandTotalExpectedPaisa : cashPaisa;
  const effectivePaidPaisa = isFullDue ? 0 : (totalPaidPaisa === 0 ? grandTotalExpectedPaisa : totalPaidPaisa);
  const effectiveChangePaisa = Math.max(0, effectivePaidPaisa - grandTotalExpectedPaisa);
  const effectiveDuePaisa = Math.max(0, grandTotalExpectedPaisa - effectivePaidPaisa);

  const changePaisa = Math.max(0, totalPaidPaisa - grandTotalExpectedPaisa);
  const duePaisa = Math.max(0, grandTotalExpectedPaisa - totalPaidPaisa);`;

content = content.replace(isFullDueRe, isFullDueReplace);

// 6. Fix confirm messages & fallback filling
content = content.replace(
  "message: `Record ৳ ${(totalPaisa / 100).toFixed(",
  "message: `Record ৳ ${(grandTotalExpectedPaisa / 100).toFixed("
);
content = content.replace(
  "message: `Has the customer paid the full ৳ ${(totalPaisa / 100).toFixed(2)} in cash?`,",
  "message: `Has the customer paid the full ৳ ${(grandTotalExpectedPaisa / 100).toFixed(2)} in cash?`,"
);
// THIS IS THE ONE THAT WAS MISSING EARLIER:
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

// 7. Add to payload
content = content.replace(
  "customer_id: selectedCustomerId || null,",
  "customer_id: selectedCustomerId || null,\n          previous_due_paid_paisa: previousDuePaidPaisa,"
);

// 8. Inject UI exactly using regex
const uiRe = /<\/button>\s*\{customerPickerOpen && \(/;
const uiReplace = `</button>

                {selectedCustomer && (selectedCustomer.due_paisa || 0) > 0 && (
                  <div className="w-full mt-2 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold text-amber-800">Collect Previous Due ৳</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="Amount"
                      value={previousDuePaidTaka}
                      onChange={(e) => setPreviousDuePaidTaka(e.target.value)}
                      className="w-24 text-right bg-white border border-amber-300 rounded-lg text-sm font-mono font-bold text-amber-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    />
                  </div>
                )}
                
                {customerPickerOpen && (`
content = content.replace(uiRe, uiReplace);

// 9. Update display total in bottom totals box
const payableRe = /<div className="flex items-center bg-white text-jungle-teal-900 px-3\.5 py-2 rounded-xl mt-1">\s*<span className="text-ui-xs text-jungle-teal-700 font-sans">Payable<\/span>\s*<span className="ml-auto text-ui-2xl font-semibold font-mono tracking-tight leading-none">\s*৳ \{\(totalPaisa \/ 100\)\.toFixed\(2\)\}\s*<\/span>\s*<\/div>/;
const payableReplace = `<div className="flex flex-col gap-1 mt-1">
              {previousDuePaidPaisa > 0 && (
                <div className="flex items-center bg-amber-50 text-amber-900 px-3.5 py-1.5 rounded-xl border border-amber-200">
                  <span className="text-ui-xs text-amber-700 font-sans font-medium">Prev. Due Added</span>
                  <span className="ml-auto text-sm font-semibold font-mono tracking-tight leading-none">
                    + ৳ {(previousDuePaidPaisa / 100).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center bg-white text-jungle-teal-900 px-3.5 py-2 rounded-xl border border-jungle-teal-200/50">
                <span className="text-ui-xs text-jungle-teal-700 font-sans">Payable</span>
                <span className="ml-auto text-ui-2xl font-semibold font-mono tracking-tight leading-none">
                  ৳ {(grandTotalExpectedPaisa / 100).toFixed(2)}
                </span>
              </div>
            </div>`;
content = content.replace(payableRe, payableReplace);

// 10. Pass to ReceiptPreviewModal
const modalRe = /<ReceiptPreviewModal\s*isOpen=\{showPreviewModal\}\s*onClose=\{\(\) => setShowPreviewModal\(false\)\}\s*onConfirmSale=\{executeFinalCheckout\}\s*cart=\{cart\}\s*customer=\{selectedCustomer\}\s*subtotalPaisa=\{subtotalPaisa\}\s*discountPaisa=\{discountPaisa\}\s*totalPaisa=\{totalPaisa\}/;
const modalReplace = `<ReceiptPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          onConfirmSale={executeFinalCheckout}
          cart={cart}
          customer={selectedCustomer}
          subtotalPaisa={subtotalPaisa}
          discountPaisa={discountPaisa}
          previousDuePaidPaisa={previousDuePaidPaisa}
          totalPaisa={totalPaisa}`;
content = content.replace(modalRe, modalReplace);

// 11. Fix another setCashAmount that uses totalPaisa instead of grandTotalExpectedPaisa inside handleQuickCash
content = content.replace(
  "setCashAmount((totalPaisa / 100).toFixed(2));",
  "setCashAmount((grandTotalExpectedPaisa / 100).toFixed(2));"
);

// 12. Fix the assignNonCash totalPaisa checks
content = content.replace(
  "if (cashPaisa >= totalPaisa) {\n      setCashAmount('');\n      setAmount((totalPaisa / 100).toFixed(2));",
  "if (cashPaisa >= grandTotalExpectedPaisa) {\n      setCashAmount('');\n      setAmount((grandTotalExpectedPaisa / 100).toFixed(2));"
);
content = content.replace(
  "const outstandingPaisa = totalPaisa - cashPaisa;",
  "const outstandingPaisa = grandTotalExpectedPaisa - cashPaisa;"
);

fs.writeFileSync(path, content, 'utf8');
console.log('perfect_posview updated with everything');
