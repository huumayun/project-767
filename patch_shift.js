const fs = require('fs');
let c = fs.readFileSync('src/components/shifts/ShiftModal.tsx', 'utf8');

const regex = /<span className="text-sm font-bold text-azure-mist-700">.*?\{otherTaka\}<\/span>/;
const newContent = `<span className="text-sm font-bold text-azure-mist-700">৳ {digitalSalesTaka}</span>
                  {(Number(bkashTaka) > 0 || Number(nagadTaka) > 0 || Number(cardTaka) > 0) && (
                    <div className="mt-1 text-[10px] text-slate-500 font-mono leading-tight">
                      {Number(bkashTaka) > 0 && <div>bKash: ৳{bkashTaka}</div>}
                      {Number(nagadTaka) > 0 && <div>Nagad: ৳{nagadTaka}</div>}
                      {Number(cardTaka) > 0 && <div>Card: ৳{cardTaka}</div>}
                    </div>
                  )}`;

c = c.replace(regex, newContent);

fs.writeFileSync('src/components/shifts/ShiftModal.tsx', c);
