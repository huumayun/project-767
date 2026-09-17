import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  CheckCircle2,
  DollarSign,
  PlusCircle,
  MinusCircle,
  Clock,
  Printer,
  FileText,
  AlertTriangle,
  Receipt,
  User,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowRight,
} from 'lucide-react';
import { ShiftSummaryData, ShopSettings } from '../../types/ipc';

interface ShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'view' | 'open' | 'close';
  onShiftUpdated: () => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  isOpen,
  onClose,
  mode = 'view',
  onShiftUpdated,
}) => {
  const [currentMode, setCurrentMode] = useState<'view' | 'open' | 'close'>(mode);
  const [shiftData, setShiftData] = useState<ShiftSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Open Shift Form State
  const [openingCashTaka, setOpeningCashTaka] = useState<string>('500');
  const [lastClosedFloatTaka, setLastClosedFloatTaka] = useState<string | null>(null);
  const [openNote, setOpenNote] = useState<string>('');

  // Close Shift Form State
  const [actualCashTaka, setActualCashTaka] = useState<string>('');
  const [withdrawnCashTaka, setWithdrawnCashTaka] = useState<string>('0');
  const [closeNote, setCloseNote] = useState<string>('');

  // Cash In / Out Sub-Modal State
  const [showCashTxModal, setShowCashTxModal] = useState(false);
  const [cashTxType, setCashTxType] = useState<'cash_in' | 'cash_out'>('cash_out');
  const [cashTxAmountTaka, setCashTxAmountTaka] = useState<string>('');
  const [cashTxReason, setCashTxReason] = useState<string>('');

  // Z-Report Print state
  const [closedSummary, setClosedSummary] = useState<ShiftSummaryData | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [nowTicker, setNowTicker] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTicker(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (openedAt?: string) => {
    if (!openedAt) return '';
    const diffMs = Math.max(0, nowTicker - new Date(openedAt).getTime());
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const loadCurrentShift = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const [curr, settings, lastFloat] = await Promise.all([
        window.api.shifts ? window.api.shifts.getCurrent().catch(() => null) : Promise.resolve(null),
        window.api.settings ? window.api.settings.get().catch(() => null) : Promise.resolve(null),
        window.api.shifts?.getLastClosedFloat ? window.api.shifts.getLastClosedFloat().catch(() => null) : Promise.resolve(null),
      ]);
      setShiftData(curr);
      setShopSettings(settings);

      if (lastFloat && typeof lastFloat.float_paisa === 'number' && lastFloat.float_paisa >= 0) {
        const lf = (lastFloat.float_paisa / 100).toFixed(0);
        setLastClosedFloatTaka(lf);
        if (!curr) {
          setOpeningCashTaka(lf);
        }
      }

      if (!curr) {
        setCurrentMode('open');
      } else {
        const expTaka = ((curr.expected_cash_paisa || 0) / 100).toFixed(2);
        const cashSaleTaka = ((curr.total_cash_sales_paisa || 0) / 100).toFixed(2);
        setActualCashTaka(expTaka);
        setWithdrawnCashTaka(cashSaleTaka);
        if (currentMode === 'open') {
          setCurrentMode('view');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load shift.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentMode(mode);
      loadCurrentShift();
    } else {
      setClosedSummary(null);
      setError(null);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api) return;
    if (!window.api.shifts?.open) {
      setError('Shift service is initializing or requires app restart.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const openingPaisa = Math.round((parseFloat(openingCashTaka) || 0) * 100);
      const newShift = await window.api.shifts.open({
        opening_cash_paisa: openingPaisa,
        note: openNote.trim() || undefined,
      });
      setShiftData(newShift);
      onShiftUpdated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start shift.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCashTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api || !shiftData) return;
    if (!window.api.shifts?.addCashTx) {
      setError('Shift service is unavailable.');
      return;
    }
    const amount = parseFloat(cashTxAmountTaka);
    if (!amount || amount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    if (!cashTxReason.trim()) {
      setError('Please provide a reason/note.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await window.api.shifts.addCashTx({
        shift_id: shiftData.shift_id,
        type: cashTxType,
        amount_paisa: Math.round(amount * 100),
        reason: cashTxReason.trim(),
      });
      setShowCashTxModal(false);
      setCashTxAmountTaka('');
      setCashTxReason('');
      await loadCurrentShift();
      onShiftUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to add cash transaction.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api || !shiftData) return;
    if (!window.api.shifts?.close) {
      setError('Shift service is unavailable.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const actualPaisa = Math.round((parseFloat(actualCashTaka) || 0) * 100);
      const withdrawnPaisa = Math.round((parseFloat(withdrawnCashTaka) || 0) * 100);
      const floatLeftPaisa = Math.max(0, actualPaisa - withdrawnPaisa);

      const summary = await window.api.shifts.close({
        shift_id: shiftData.shift_id,
        actual_cash_paisa: actualPaisa,
        cash_withdrawn_paisa: withdrawnPaisa,
        float_left_paisa: floatLeftPaisa,
        note: closeNote.trim() || undefined,
      });
      setClosedSummary(summary);
      onShiftUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to close shift.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintZReport = () => {
    if (!printAreaRef.current) return;
    const printContent = printAreaRef.current.innerHTML;
    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shift Z-Report</title>
          <meta charset="utf-8" />
          <style>
            @page { margin: 4mm; size: 80mm auto; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: 4px;
              font-size: 12px;
              line-height: 1.35;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .border-b { border-bottom: 1px dashed #cbd5e1; }
            .border-t { border-top: 1px dashed #cbd5e1; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .w-full { width: 100%; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 4px 2px; }
            th { border-bottom: 1px solid #0f172a; font-size: 11px; text-transform: uppercase; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const shopName = shopSettings?.shop_name || 'Fatema Electronics';
  const targetSummary = closedSummary || shiftData;

  const openingTaka = (((targetSummary?.opening_cash_paisa || 0)) / 100).toFixed(2);
  const totalSalesTaka = (((targetSummary?.total_sales_paisa || 0)) / 100).toFixed(2);
  const cashSalesTaka = (((targetSummary?.total_cash_sales_paisa || 0)) / 100).toFixed(2);
  const bkashTaka = (((targetSummary?.total_bkash_sales_paisa || 0)) / 100).toFixed(2);
  const nagadTaka = (((targetSummary?.total_nagad_sales_paisa || 0)) / 100).toFixed(2);
  const cardTaka = (((targetSummary?.total_card_sales_paisa || 0)) / 100).toFixed(2);
  // Non-cash taken on the merged Other button, plus the older per-wallet rows.
  const otherTaka = (
    ((targetSummary?.total_other_sales_paisa || 0) +
      (targetSummary?.total_bkash_sales_paisa || 0) +
      (targetSummary?.total_nagad_sales_paisa || 0) +
      (targetSummary?.total_card_sales_paisa || 0)) / 100
  ).toFixed(2);
  const tk = (paisa?: number) => ((paisa || 0) / 100).toFixed(2);
  const returnedTaka = tk(targetSummary?.total_returned_paisa);
  const netSalesTaka = tk(targetSummary?.net_sales_paisa);
  const cogsTaka = tk(targetSummary?.total_cogs_paisa);
  const grossProfitTaka = tk(targetSummary?.gross_profit_paisa);
  const dueSalesTaka = tk(targetSummary?.total_due_sales_paisa);
  const dueCollectedTaka = tk(
    (targetSummary?.total_cash_due_collected_paisa || 0) +
      (targetSummary?.total_other_due_collected_paisa || 0)
  );
  const saleRows = targetSummary?.sale_transactions || [];

  const cashInTaka = (((targetSummary?.total_cash_in_paisa || 0)) / 100).toFixed(2);
  const cashOutTaka = (((targetSummary?.total_cash_out_paisa || 0)) / 100).toFixed(2);
  const expectedTaka = (((targetSummary?.expected_cash_paisa || 0)) / 100).toFixed(2);

  const actualTaka = ((closedSummary?.actual_cash_paisa ?? ((parseFloat(actualCashTaka) || 0) * 100)) / 100).toFixed(2);
  const diffPaisa = closedSummary?.cash_difference_paisa ?? (Math.round((parseFloat(actualCashTaka) || 0) * 100) - (targetSummary?.expected_cash_paisa || 0));
  const diffTaka = (Math.abs(diffPaisa) / 100).toFixed(2);

  const withdrawnTaka = ((closedSummary?.closing_cash_withdrawn_paisa ?? ((parseFloat(withdrawnCashTaka) || 0) * 100)) / 100).toFixed(2);
  const floatLeftTaka = ((closedSummary?.closing_float_left_paisa ?? Math.max(0, ((parseFloat(actualCashTaka) || 0) - (parseFloat(withdrawnCashTaka) || 0)) * 100)) / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/80 backdrop-blur-xs p-4 overflow-y-auto font-sans">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-jungle-teal-950 my-6 space-y-4 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-muted-teal-100 text-muted-teal-800 rounded-xl border border-muted-teal-200">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-ui-md font-bold text-jungle-teal-950">
                {closedSummary
                  ? 'Shift Closed (Z-Report Summary)'
                  : currentMode === 'open'
                  ? 'Start New Shift'
                  : currentMode === 'close'
                  ? 'Close Shift & Reconcile Cash'
                  : 'Active Shift Status & Cash Drawer'}
              </h3>
              <p className="text-ui-2xs text-jungle-teal-600 font-mono">
                {targetSummary?.user_name ? `Cashier: ${targetSummary.user_name}` : 'Cash Register'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-jungle-teal-400 hover:text-jungle-teal-800 hover:bg-jungle-teal-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-ui-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Closed Summary / Z-Report View */}
        {closedSummary ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-1">
              <div className="inline-flex p-2 bg-emerald-100 text-emerald-800 rounded-full mb-1">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="font-extrabold text-emerald-950 text-sm">Shift Successfully Closed!</h4>
              <p className="text-xs text-emerald-800">The cash drawer has been closed and saved.</p>
            </div>

            {/* Printable Area */}
            <div ref={printAreaRef} className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs font-mono text-xs space-y-2">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <h3 className="font-bold text-sm uppercase">{shopName}</h3>
                <p className="text-[10px] text-slate-500">SHIFT Z-REPORT · DRAWER RECONCILIATION</p>
                <p className="text-[10px] text-slate-500">{new Date().toLocaleString()}</p>
              </div>

              <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span className="font-bold">{closedSummary.user_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Started:</span>
                  <span>{new Date(closedSummary.opened_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Closed:</span>
                  <span>{closedSummary.closed_at ? new Date(closedSummary.closed_at).toLocaleTimeString() : ''}</span>
                </div>
              </div>

              <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-slate-300">
                <div className="flex justify-between">
                  <span>Opening Float:</span>
                  <span>৳ {openingTaka}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Sales:</span>
                  <span>+ ৳ {cashSalesTaka}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Other (digital / card) Sales:</span>
                  <span>৳ {otherTaka}</span>
                </div>
                {Number(dueCollectedTaka) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Old Balances Collected:</span>
                    <span>+ ৳ {dueCollectedTaka}</span>
                  </div>
                )}
                {Number(cashInTaka) > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Cash In (+):</span>
                    <span>+ ৳ {cashInTaka}</span>
                  </div>
                )}
                {Number(cashOutTaka) > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Cash Out / Expenses (-):</span>
                    <span>- ৳ {cashOutTaka}</span>
                  </div>
                )}
              </div>

              {/* What the shift traded, as opposed to what passed through the drawer. */}
              <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-slate-300">
                <div className="font-bold text-slate-800 pb-1">Trading</div>
                <div className="flex justify-between text-slate-600">
                  <span>Gross Sales:</span>
                  <span>৳ {totalSalesTaka}</span>
                </div>
                {Number(returnedTaka) > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Returns (-):</span>
                    <span>- ৳ {returnedTaka}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-slate-800">
                  <span>Net Sales:</span>
                  <span>৳ {netSalesTaka}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cost of Goods Sold:</span>
                  <span>- ৳ {cogsTaka}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-800">
                  <span>Gross Profit:</span>
                  <span>৳ {grossProfitTaka}</span>
                </div>
                {Number(dueSalesTaka) > 0 && (
                  <div className="flex justify-between text-amber-800 pt-1 border-t border-dashed border-slate-200">
                    <span>Sold on Credit ({targetSummary?.due_sales_count || 0} bills):</span>
                    <span>৳ {dueSalesTaka}</span>
                  </div>
                )}
              </div>

              {closedSummary?.user_breakdown && closedSummary.user_breakdown.length > 0 && (
                <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-slate-300">
                  <div className="font-bold text-slate-800 pb-1">User Breakdown:</div>
                  {closedSummary.user_breakdown.map((u, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>{u.user_name} ({u.sales_count} sales)</span>
                      <span>৳ {(u.total_sales_paisa / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1 text-xs pt-1">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Expected Cash:</span>
                  <span>৳ {expectedTaka}</span>
                </div>
                <div className="flex justify-between font-extrabold text-slate-900">
                  <span>Actual Counted Cash:</span>
                  <span>৳ {actualTaka}</span>
                </div>
                <div className="flex justify-between font-extrabold pt-1 border-t border-slate-200">
                  <span>Difference:</span>
                  <span className={diffPaisa === 0 ? 'text-emerald-700' : diffPaisa > 0 ? 'text-blue-700' : 'text-rose-700'}>
                    {diffPaisa === 0 ? '৳ 0.00 (Matched)' : diffPaisa > 0 ? `+ ৳ ${diffTaka} (Over)` : `- ৳ ${diffTaka} (Short)`}
                  </span>
                </div>
                <div className="flex justify-between text-slate-700 pt-1 border-t border-dashed border-slate-200">
                  <span>Cash Withdrawn:</span>
                  <span className="font-bold">৳ {withdrawnTaka}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-extrabold">
                  <span>Float Left in Drawer:</span>
                  <span>৳ {floatLeftTaka}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePrintZReport}
                className="flex-1 py-3 bg-linear-to-r from-azure-mist-700 to-azure-mist-600 hover:from-azure-mist-600 hover:to-azure-mist-500 text-white font-bold rounded-xl text-ui-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print Z-Report Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClosedSummary(null);
                  onClose();
                }}
                className="px-5 py-3 bg-jungle-teal-200 hover:bg-jungle-teal-300 text-jungle-teal-900 font-bold rounded-xl text-ui-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : currentMode === 'open' ? (
          /* 2. Open Shift Form */
          <form onSubmit={handleOpenShift} className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-jungle-teal-200 shadow-xs space-y-3">
              
              {/* Previous Shift Float Hint Banner */}
              {lastClosedFloatTaka !== null && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between font-mono">
                  <div>
                    <span className="text-xs font-bold text-emerald-950 font-sans block">
                      Left in the drawer last shift: ৳ {lastClosedFloatTaka}
                    </span>
                    <span className="text-[10.5px] text-emerald-700 font-sans">
                      Cash left behind when the shop closed
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpeningCashTaka(lastClosedFloatTaka)}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold font-mono transition-colors shadow-xs"
                  >
                    Use ৳ {lastClosedFloatTaka}
                  </button>
                </div>
              )}

              <div>
                <label className="block text-ui-xs font-bold text-jungle-teal-900 mb-1">
                  Opening Cash Float (৳):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-jungle-teal-500 font-bold text-base">৳</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    required
                    autoFocus
                    value={openingCashTaka}
                    onChange={(e) => setOpeningCashTaka(e.target.value)}
                    placeholder="500"
                    className="w-full h-12 bg-jungle-teal-50 border border-jungle-teal-300 focus:border-muted-teal-600 rounded-xl pl-9 pr-3 text-lg font-mono font-bold text-jungle-teal-950 focus:outline-hidden"
                  />
                </div>
                <p className="text-[11px] text-jungle-teal-500 mt-1 font-sans">
                  * Change this to whatever is actually in the drawer.
                </p>
              </div>

              {/* Quick Amount Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {lastClosedFloatTaka !== null && Number(lastClosedFloatTaka) > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpeningCashTaka(lastClosedFloatTaka)}
                    className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-lg text-ui-xs font-mono font-bold border border-emerald-300 transition-colors"
                  >
                    Last shift: ৳ {lastClosedFloatTaka}
                  </button>
                )}
                {[0, 500, 1000, 2000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setOpeningCashTaka(amt.toString())}
                    className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg text-ui-xs font-mono font-bold border border-jungle-teal-200 transition-colors"
                  >
                    ৳ {amt}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-ui-2xs font-semibold text-jungle-teal-700 mb-1">
                  Optional Note:
                </label>
                <input
                  type="text"
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  placeholder="Morning shift / Counter 1"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 py-2 text-ui-xs text-jungle-teal-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-ui-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 bg-muted-teal-700 hover:bg-muted-teal-800 text-white rounded-xl text-ui-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{loading ? 'Starting Shift…' : 'Start Shift'}</span>
              </button>
            </div>
          </form>
        ) : currentMode === 'close' ? (
          /* 3. Close Shift & Drawer Count Form */
          <form onSubmit={handleCloseShift} className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-jungle-teal-200 shadow-xs space-y-3.5">
              
              {/* Shift Summary Breakdown Cards */}
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 bg-jungle-teal-50 rounded-xl border border-jungle-teal-200">
                  <span className="text-[10px] text-jungle-teal-600 font-sans block">Opening Float</span>
                  <span className="text-xs font-bold text-jungle-teal-900">৳ {openingTaka}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 font-sans block">Cash Sales (+)</span>
                  <span className="text-xs font-bold text-emerald-800">৳ {cashSalesTaka}</span>
                </div>
                <div className="p-2.5 bg-azure-mist-50 rounded-xl border border-azure-mist-200">
                  <span className="text-[10px] text-azure-mist-700 font-sans block">Expected Cash</span>
                  <span className="text-xs font-bold text-azure-mist-900">৳ {expectedTaka}</span>
                </div>
              </div>

              {/* 1. Actual Counted Cash */}
              <div>
                <label className="block text-ui-xs font-bold text-jungle-teal-900 mb-1">
                  1. Actual total cash counted in the drawer (৳):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-jungle-teal-500 font-bold text-base">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    value={actualCashTaka}
                    onChange={(e) => {
                      const val = e.target.value;
                      setActualCashTaka(val);
                    }}
                    placeholder="0.00"
                    className="w-full h-11 bg-jungle-teal-50 border border-jungle-teal-300 focus:border-muted-teal-600 rounded-xl pl-9 pr-3 text-base font-mono font-bold text-jungle-teal-950 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* 2. Amount Withdrawn / Taken Out by Owner */}
              <div className="pt-1 border-t border-slate-100">
                <label className="block text-ui-xs font-bold text-jungle-teal-900 mb-1">
                  2. Cash withdrawn / taken home (৳):
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-500 font-bold text-base">৳</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={parseFloat(actualCashTaka) || undefined}
                    required
                    value={withdrawnCashTaka}
                    onChange={(e) => setWithdrawnCashTaka(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-11 bg-rose-50/60 border border-rose-300 focus:border-rose-600 rounded-xl pl-9 pr-3 text-base font-mono font-bold text-rose-950 focus:outline-hidden"
                  />
                </div>

                {/* Quick Withdrawn Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setWithdrawnCashTaka(cashSalesTaka)}
                    className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg text-[11px] font-mono font-bold border border-jungle-teal-200"
                  >
                    Take the sales (৳ {cashSalesTaka})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const total = parseFloat(actualCashTaka) || 0;
                      setWithdrawnCashTaka(Math.max(0, total - 1000).toString());
                    }}
                    className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg text-[11px] font-mono font-bold border border-jungle-teal-200"
                  >
                    Leave 1000 in the drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const total = parseFloat(actualCashTaka) || 0;
                      setWithdrawnCashTaka(Math.max(0, total - 500).toString());
                    }}
                    className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg text-[11px] font-mono font-bold border border-jungle-teal-200"
                  >
                    Leave 500 in the drawer
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawnCashTaka('0')}
                    className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg text-[11px] font-mono font-bold border border-jungle-teal-200"
                  >
                    Take nothing (৳ 0)
                  </button>
                </div>
              </div>

              {/* 3. Resulting Cash Left in Drawer for Tomorrow */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between font-mono">
                <div>
                  <span className="text-xs font-bold text-emerald-950 font-sans block">
                    Left in Drawer for Next Day:
                  </span>
                  <span className="text-[10.5px] text-emerald-700 font-sans">
                    This becomes the opening float when the shop opens tomorrow.
                  </span>
                </div>
                <span className="text-base font-extrabold text-emerald-900 shrink-0">
                  ৳ {(Math.max(0, (parseFloat(actualCashTaka) || 0) - (parseFloat(withdrawnCashTaka) || 0))).toFixed(2)}
                </span>
              </div>

              {/* Difference Status */}
              {actualCashTaka !== '' && (
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs font-mono font-bold ${
                    diffPaisa === 0
                      ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                      : diffPaisa > 0
                      ? 'bg-blue-50 border-blue-200 text-blue-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <span className="font-sans">Reconciliation Difference:</span>
                  <span>
                    {diffPaisa === 0
                      ? '৳ 0.00 (Balanced)'
                      : diffPaisa > 0
                      ? `+ ৳ ${diffTaka} (Over)`
                      : `- ৳ ${diffTaka} (Short)`}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-ui-2xs font-semibold text-jungle-teal-700 mb-1">
                  Closing Note (optional):
                </label>
                <input
                  type="text"
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="Day-end cash handover"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 py-2 text-ui-xs text-jungle-teal-900 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setCurrentMode('view')}
                className="px-4 py-2.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-ui-xs font-semibold"
              >
                Back to Shift
              </button>
              <button
                type="submit"
                disabled={loading || actualCashTaka === ''}
                className="px-6 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-ui-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Closing Shift…' : 'Confirm & Close Shift (F8)'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* 4. Live Active Shift View */
          <div className="space-y-4">
            {/* Shift Active Info Banner */}
            <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-jungle-teal-950 font-sans block">
                  Cashier: {shiftData?.user_name || 'Cashier'}
                </span>
                <span className="text-[11px] text-jungle-teal-600 font-sans">
                  Started: {shiftData?.opened_at ? new Date(shiftData.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                </span>
              </div>
              <div className="px-2.5 py-1 bg-emerald-100/90 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Running: {formatDuration(shiftData?.opened_at)}</span>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono">
              <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-jungle-teal-600 font-sans block">Opening Float</span>
                <span className="text-sm font-bold text-jungle-teal-900">৳ {openingTaka}</span>
              </div>
              <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-jungle-teal-600 font-sans block">Cash Sales</span>
                <span className="text-sm font-bold text-emerald-700">৳ {cashSalesTaka}</span>
              </div>
              <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-jungle-teal-600 font-sans block">Digital Sales</span>
                <span className="text-sm font-bold text-azure-mist-700">৳ {otherTaka}</span>
              </div>
              <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-emerald-700 font-sans block">Cash In (+)</span>
                <span className="text-sm font-bold text-emerald-700">+ ৳ {cashInTaka}</span>
              </div>
              <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-rose-700 font-sans block">Cash Out (-)</span>
                <span className="text-sm font-bold text-rose-700">- ৳ {cashOutTaka}</span>
              </div>
              <div className="p-3 bg-jungle-teal-900 border border-jungle-teal-950 text-white rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-jungle-teal-300 font-sans block">Expected Cash</span>
                <span className="text-sm font-extrabold text-azure-mist-300">৳ {expectedTaka}</span>
              </div>
            </div>

            {/* What the shift traded. The tiles above are the drawer; these are
                the shop - a cashier can close a drawer perfectly while having
                sold at a loss or lent out half the takings. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
              <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-jungle-teal-600 font-sans block">Net Sales</span>
                <span className="text-sm font-bold text-jungle-teal-900">৳ {netSalesTaka}</span>
                {Number(returnedTaka) > 0 && (
                  <span className="text-[10px] text-rose-700 font-sans block">
                    after ৳ {returnedTaka} returned
                  </span>
                )}
              </div>
              <div className="p-3 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-jungle-teal-600 font-sans block">Cost of Goods</span>
                <span className="text-sm font-bold text-jungle-teal-900">৳ {cogsTaka}</span>
              </div>
              <div className="p-3 bg-white border border-muted-teal-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-muted-teal-700 font-sans block">Gross Profit</span>
                <span className="text-sm font-bold text-muted-teal-800">৳ {grossProfitTaka}</span>
              </div>
              <div className="p-3 bg-white border border-amber-200 rounded-2xl shadow-xs">
                <span className="text-[10.5px] text-amber-800 font-sans block">Sold on Credit</span>
                <span className="text-sm font-bold text-amber-800">৳ {dueSalesTaka}</span>
                <span className="text-[10px] text-jungle-teal-500 font-sans block">
                  {targetSummary?.due_sales_count || 0} bill{(targetSummary?.due_sales_count || 0) === 1 ? '' : 's'}
                  {Number(dueCollectedTaka) > 0 ? ` · ৳ ${dueCollectedTaka} collected` : ''}
                </span>
              </div>
            </div>

            {/* Every bill rung up in this shift. */}
            {saleRows.length > 0 && (
              <div className="border border-jungle-teal-200 rounded-2xl overflow-hidden bg-white">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-jungle-teal-200 bg-jungle-teal-50">
                  <Receipt className="w-3.5 h-3.5 text-azure-mist-700" />
                  <span className="text-ui-xs font-semibold text-jungle-teal-900">
                    Transactions ({saleRows.length})
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-ui-2xs font-mono">
                    <thead className="text-jungle-teal-600 bg-jungle-teal-50/60 sticky top-0">
                      <tr>
                        <th className="text-left font-medium px-3 py-1.5">Time</th>
                        <th className="text-left font-medium px-2 py-1.5">Invoice</th>
                        <th className="text-left font-medium px-2 py-1.5">Customer</th>
                        <th className="text-right font-medium px-2 py-1.5">Total</th>
                        <th className="text-right font-medium px-2 py-1.5">Paid</th>
                        <th className="text-right font-medium px-3 py-1.5">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-jungle-teal-100">
                      {saleRows.map((row) => (
                        <tr key={row.id} className="text-jungle-teal-800">
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">{row.invoice_no}</td>
                          <td className="px-2 py-1.5 font-sans truncate max-w-[120px]">{row.customer_name}</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">৳ {tk(row.total_paisa)}</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap text-muted-teal-800">
                            ৳ {tk(row.paid_paisa)}
                          </td>
                          <td className={`px-3 py-1.5 text-right whitespace-nowrap ${row.due_paisa > 0 ? 'text-rose-700 font-bold' : 'text-jungle-teal-400'}`}>
                            {row.due_paisa > 0 ? `৳ ${tk(row.due_paisa)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Petty Cash In / Out Quick Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCashTxType('cash_in');
                  setShowCashTxModal(true);
                }}
                className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold rounded-xl text-ui-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                <span>+ Cash In</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCashTxType('cash_out');
                  setShowCashTxModal(true);
                }}
                className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-bold rounded-xl text-ui-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <MinusCircle className="w-4 h-4 text-rose-600" />
                <span>- Cash Out</span>
              </button>
            </div>

            {/* User Breakdown */}
            {shiftData?.user_breakdown && shiftData.user_breakdown.length > 0 && (
              <div className="bg-white rounded-2xl p-3 border border-jungle-teal-200 shadow-xs space-y-2">
                <span className="text-[11px] font-bold text-jungle-teal-800 uppercase tracking-wider block font-sans">
                  User Sales Breakdown:
                </span>
                <div className="divide-y divide-slate-100 max-h-32 overflow-y-auto text-xs font-mono">
                  {shiftData.user_breakdown.map((u, i) => (
                    <div key={i} className="py-1 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 font-sans">{u.user_name}</span>
                        <span className="text-[10px] text-slate-400 block ml-1">{u.sales_count} sales</span>
                      </div>
                      <span className="font-bold text-jungle-teal-700">
                        ৳ {(u.total_sales_paisa / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Cash Transactions List */}
            {shiftData?.cash_transactions && shiftData.cash_transactions.length > 0 && (
              <div className="bg-white rounded-2xl p-3 border border-jungle-teal-200 shadow-xs space-y-2">
                <span className="text-[11px] font-bold text-jungle-teal-800 uppercase tracking-wider block font-sans">
                  Recent Petty Cash Transactions:
                </span>
                <div className="divide-y divide-slate-100 max-h-32 overflow-y-auto text-xs font-mono">
                  {shiftData.cash_transactions.map((tx) => (
                    <div key={tx.id} className="py-1.5 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 font-sans">{tx.reason}</span>
                        <span className="text-[10px] text-slate-400 block">{new Date(tx.created_at).toLocaleTimeString()}</span>
                      </div>
                      <span className={tx.type === 'cash_in' ? 'font-bold text-emerald-700' : 'font-bold text-rose-700'}>
                        {tx.type === 'cash_in' ? '+' : '-'} ৳ {(tx.amount_paisa / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-jungle-teal-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-ui-xs font-semibold"
              >
                Close Window
              </button>

              <button
                type="button"
                onClick={() => {
                  setActualCashTaka(expectedTaka);
                  setCurrentMode('close');
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-ui-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <span>End / Close Shift</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Petty Cash In / Out Input Modal */}
        {showCashTxModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-slate-900 space-y-4 animate-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="font-bold text-sm text-slate-900">
                  {cashTxType === 'cash_in' ? '+ Cash In' : '- Cash Out'}
                </h4>
                <button onClick={() => setShowCashTxModal(false)} className="text-slate-400 hover:text-slate-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleAddCashTx} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Amount (৳):</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    autoFocus
                    value={cashTxAmountTaka}
                    onChange={(e) => setCashTxAmountTaka(e.target.value)}
                    placeholder="100"
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 font-mono font-bold text-base focus:outline-hidden focus:border-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reason / Purpose:</label>
                  <input
                    type="text"
                    required
                    value={cashTxReason}
                    onChange={(e) => setCashTxReason(e.target.value)}
                    placeholder={cashTxType === 'cash_in' ? 'Extra cash added' : 'Tea / Snacks / Delivery'}
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 text-xs focus:outline-hidden focus:border-slate-800"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCashTxModal(false)}
                    className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`px-4 py-2 text-white font-bold rounded-lg text-xs shadow-xs ${
                      cashTxType === 'cash_in' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {loading ? 'Saving…' : 'Submit Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
