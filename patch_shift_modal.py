import re

with open('src/components/shifts/ShiftModal.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# First replace: Add digitalSalesTaka variable
# Replace `const otherTaka = ...` with both `otherTaka` and `digitalSalesTaka`
c = re.sub(
    r"const otherTaka = \(\(\(targetSummary\?\.total_other_sales_paisa \|\| 0\)\) / 100\)\.toFixed\(2\);",
    r"const otherTaka = (((targetSummary?.total_other_sales_paisa || 0)) / 100).toFixed(2);\n    const digitalSalesTaka = (((targetSummary?.total_bkash_sales_paisa || 0) + (targetSummary?.total_nagad_sales_paisa || 0) + (targetSummary?.total_card_sales_paisa || 0) + (targetSummary?.total_other_sales_paisa || 0)) / 100).toFixed(2);",
    c
)

# Second replace: Modify the Digital Sales box in the UI
old_box = r"""<div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                  <span className="text-\[10\.5px\] text-jungle-teal-600 font-sans block">Digital Sales</span>
                  <span className="text-sm font-bold text-azure-mist-700">৳ {otherTaka}</span>
                </div>"""

new_box = r"""<div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                  <span className="text-[10.5px] text-jungle-teal-600 font-sans block">Digital Sales</span>
                  <span className="text-sm font-bold text-azure-mist-700">৳ {digitalSalesTaka}</span>
                  {(Number(bkashTaka) > 0 || Number(nagadTaka) > 0 || Number(cardTaka) > 0) && (
                    <div className="mt-1 text-[10px] text-slate-500 font-mono leading-tight">
                      {Number(bkashTaka) > 0 && <div>bKash: ৳{bkashTaka}</div>}
                      {Number(nagadTaka) > 0 && <div>Nagad: ৳{nagadTaka}</div>}
                      {Number(cardTaka) > 0 && <div>Card: ৳{cardTaka}</div>}
                    </div>
                  )}
                </div>"""

c = c.replace(old_box, new_box)

with open('src/components/shifts/ShiftModal.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
