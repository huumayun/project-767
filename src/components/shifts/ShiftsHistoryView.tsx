import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Printer,
  Search,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Eye,
  RefreshCw,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Wallet,
  Play,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { ShiftSummaryData, ShopSettings, UserSession } from '../../types/ipc';

interface ShiftsHistoryViewProps {
  currentSession: UserSession | null;
  onOpenShiftModal?: () => void;
}

export const ShiftsHistoryView: React.FC<ShiftsHistoryViewProps> = ({
  currentSession,
  onOpenShiftModal,
}) => {
  const [shifts, setShifts] = useState<ShiftSummaryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedShift, setSelectedShift] = useState<ShiftSummaryData | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);

  const printAreaRef = useRef<HTMLDivElement>(null);

  const loadShifts = async () => {
    if (!window.api || !window.api.shifts?.getHistory) return;
    setLoading(true);
    setError(null);
    try {
      const [data, settings] = await Promise.all([
        window.api.shifts.getHistory(100),
        window.api.settings ? window.api.settings.get().catch(() => null) : Promise.resolve(null),
      ]);
      setShifts(data || []);
      setShopSettings(settings);
    } catch (err: any) {
      setError(err.message || 'Failed to load shift history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const filteredShifts = shifts.filter((s) => {
    const cashierName = (s.user_name || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = cashierName.includes(query) || s.shift_id.toLowerCase().includes(query) || (s.note || '').toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate high-level summary metrics
  const totalSalesPaisa = shifts.reduce((acc, s) => acc + (s.total_sales_paisa || 0), 0);
  const totalCashSalesPaisa = shifts.reduce((acc, s) => acc + (s.total_cash_sales_paisa || 0), 0);
  const totalWithdrawnPaisa = shifts.reduce((acc, s) => acc + (s.closing_cash_withdrawn_paisa || 0), 0);
  const totalDiffPaisa = shifts.reduce((acc, s) => acc + (s.cash_difference_paisa || 0), 0);

  const formatDuration = (openedAt: string, closedAt?: string | null) => {
    const start = new Date(openedAt).getTime();
    const end = closedAt ? new Date(closedAt).getTime() : Date.now();
    const diffMin = Math.floor(Math.max(0, end - start) / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const handlePrintSlip = (shift: ShiftSummaryData) => {
    setSelectedShift(shift);
    setTimeout(() => {
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
            <title>Shift Z-Report - ${shift.shift_id}</title>
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
    }, 100);
  };

  const shopName = shopSettings?.shop_name || 'Mechanical Workshop';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 font-sans max-w-7xl mx-auto w-full">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-jungle-teal-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-jungle-teal-100 flex items-center justify-center text-jungle-teal-800">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-jungle-teal-950 flex items-center gap-2">
              <span>শিফট ও ক্যাশ ড্রয়ার তালিকা (Shifts)</span>
              <span className="px-2.5 py-0.5 bg-jungle-teal-100 text-jungle-teal-800 rounded-full text-xs font-mono font-bold">
                {shifts.length}
              </span>
            </h1>
            <p className="text-ui-xs text-jungle-teal-600">
              সকল শিফটের শুরুর ব্যালেন্স, ক্যাশ কালেকশন, টাকা উত্তোলন ও ড্রয়ার হিসাবের বিস্তারিত
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadShifts}
            disabled={loading}
            className="p-2 bg-jungle-teal-50 hover:bg-jungle-teal-100 border border-jungle-teal-200 text-jungle-teal-700 rounded-xl transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {onOpenShiftModal && (
            <button
              type="button"
              onClick={onOpenShiftModal}
              className="px-4 py-2 bg-muted-teal-700 hover:bg-muted-teal-800 text-white rounded-xl text-ui-xs font-bold flex items-center gap-2 shadow-xs transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>শিফট ম্যানেজমেন্ট (Shift Drawer)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-jungle-teal-600 block">মোট বিক্রয় (Total Sales)</span>
          <span className="text-base font-extrabold text-jungle-teal-950">
            ৳ {(totalSalesPaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-emerald-200 bg-emerald-50/40 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-emerald-800 block">ক্যাশ কালেকশন (Cash Sales)</span>
          <span className="text-base font-extrabold text-emerald-900">
            ৳ {(totalCashSalesPaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-rose-200 bg-rose-50/30 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-rose-800 block">মালিক উত্তোলন (Cash Withdrawn)</span>
          <span className="text-base font-extrabold text-rose-900">
            ৳ {(totalWithdrawnPaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-jungle-teal-600 block">ক্যাশ পার্থক্য (Difference)</span>
          <span className={`text-base font-extrabold ${totalDiffPaisa === 0 ? 'text-emerald-700' : totalDiffPaisa > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            {totalDiffPaisa >= 0 ? `+ ৳ ${(totalDiffPaisa / 100).toFixed(2)}` : `- ৳ ${(Math.abs(totalDiffPaisa) / 100).toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-jungle-teal-200 shadow-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-jungle-teal-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ক্যাশিয়ারের নাম বা নোট দিয়ে খুঁজুন..."
              className="w-full h-9 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl pl-9 pr-3 text-ui-xs text-jungle-teal-950 focus:outline-hidden focus:border-muted-teal-600"
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-ui-xs font-bold transition-colors ${
              statusFilter === 'all' ? 'bg-muted-teal-800 text-white' : 'bg-jungle-teal-50 text-jungle-teal-700 hover:bg-jungle-teal-100'
            }`}
          >
            সব ({shifts.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-xl text-ui-xs font-bold transition-colors ${
              statusFilter === 'open' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            চলমান ({shifts.filter((s) => s.status === 'open').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 rounded-xl text-ui-xs font-bold transition-colors ${
              statusFilter === 'closed' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            সম্পন্ন ({shifts.filter((s) => s.status === 'closed').length})
          </button>
        </div>
      </div>

      {/* 4. Shifts Table */}
      <div className="bg-white rounded-3xl border border-jungle-teal-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left text-ui-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-jungle-teal-50 border-b border-jungle-teal-200 text-jungle-teal-900 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">শিফট সময় ও তারিখ (Timing)</th>
                <th className="py-3 px-3">ক্যাশিয়ার</th>
                <th className="py-3 px-3">স্ট্যাটাস</th>
                <th className="py-3 px-3 text-right">প্রারম্ভিক (Float)</th>
                <th className="py-3 px-3 text-right">ক্যাশ বিক্রি</th>
                <th className="py-3 px-3 text-right">মোট বিক্রি</th>
                <th className="py-3 px-3 text-right">ড্রয়ারে ক্যাশ</th>
                <th className="py-3 px-3 text-right">উত্তোলন (Withdrawn)</th>
                <th className="py-3 px-3 text-right">ড্রয়ারে জমা (Leftover)</th>
                <th className="py-3 px-4 text-center">একশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-jungle-teal-400 font-sans">
                    কোনো শিফট রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift) => {
                  const isOpen = shift.status === 'open';
                  const diff = shift.cash_difference_paisa ?? 0;

                  return (
                    <tr key={shift.shift_id} className="hover:bg-jungle-teal-50/70 transition-colors">
                      {/* 1. Shift Time */}
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-jungle-teal-950">
                          {new Date(shift.opened_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-[11px] text-jungle-teal-600 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>
                            {new Date(shift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span>→</span>
                          <span>
                            {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'চলছে'}
                          </span>
                          <span className="px-1.5 py-0.2 bg-jungle-teal-100 text-jungle-teal-800 rounded font-bold">
                            {formatDuration(shift.opened_at, shift.closed_at)}
                          </span>
                        </div>
                      </td>

                      {/* 2. Cashier */}
                      <td className="py-3 px-3 font-sans">
                        <span className="font-bold text-jungle-teal-900 block truncate max-w-[120px]">
                          {shift.user_name || 'Cashier'}
                        </span>
                        <span className="text-[10px] text-jungle-teal-500 font-mono block">
                          {shift.sales_count} sales
                        </span>
                      </td>

                      {/* 3. Status */}
                      <td className="py-3 px-3">
                        {isOpen ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10.5px] font-bold font-sans">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                            চলমান
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10.5px] font-bold font-sans">
                            সম্পন্ন
                          </span>
                        )}
                      </td>

                      {/* 4. Opening Float */}
                      <td className="py-3 px-3 text-right font-bold text-jungle-teal-900">
                        ৳ {((shift.opening_cash_paisa || 0) / 100).toFixed(2)}
                      </td>

                      {/* 5. Cash Sales */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        ৳ {((shift.total_cash_sales_paisa || 0) / 100).toFixed(2)}
                      </td>

                      {/* 6. Total Sales */}
                      <td className="py-3 px-3 text-right font-bold text-jungle-teal-950">
                        ৳ {((shift.total_sales_paisa || 0) / 100).toFixed(2)}
                      </td>

                      {/* 7. Actual Counted Drawer Cash */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-extrabold text-jungle-teal-950 block">
                          ৳ {(((shift.actual_cash_paisa ?? shift.expected_cash_paisa) || 0) / 100).toFixed(2)}
                        </span>
                        {!isOpen && diff !== 0 && (
                          <span className={`text-[10px] font-bold block ${diff > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                            {diff > 0 ? `+ ৳ ${(diff / 100).toFixed(0)}` : `- ৳ ${(Math.abs(diff) / 100).toFixed(0)}`}
                          </span>
                        )}
                      </td>

                      {/* 8. Withdrawn by Owner */}
                      <td className="py-3 px-3 text-right font-bold text-rose-700">
                        ৳ {((shift.closing_cash_withdrawn_paisa || 0) / 100).toFixed(2)}
                      </td>

                      {/* 9. Float Left in Drawer */}
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-800">
                        ৳ {((shift.closing_float_left_paisa || 0) / 100).toFixed(2)}
                      </td>

                      {/* 10. Actions */}
                      <td className="py-3 px-4 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedShift(shift)}
                            className="p-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg transition-colors"
                            title="বিস্তারিত দেখুন (View Details)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintSlip(shift)}
                            className="p-1.5 bg-azure-mist-100 hover:bg-azure-mist-200 text-azure-mist-800 rounded-lg transition-colors"
                            title="Z-Report প্রিন্ট করুন (Print Slip)"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Shift Details Modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white border border-jungle-teal-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 text-jungle-teal-950">
            <div className="flex items-center justify-between pb-2 border-b border-jungle-teal-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-jungle-teal-100 flex items-center justify-center text-jungle-teal-800">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">শিফট বিস্তারিত বিবরণী</h3>
                  <p className="text-[11px] text-jungle-teal-600 font-mono">ID: {selectedShift.shift_id.slice(0, 16)}...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShift(null)}
                className="p-1.5 hover:bg-jungle-teal-100 rounded-xl text-jungle-teal-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shift Breakdown Grid */}
            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 font-sans">
                <div className="p-2.5 bg-jungle-teal-50 rounded-xl border border-jungle-teal-200">
                  <span className="text-[10px] text-jungle-teal-600 block">ক্যাশিয়ার</span>
                  <span className="font-bold text-sm text-jungle-teal-950">{selectedShift.user_name || 'Staff'}</span>
                </div>
                <div className="p-2.5 bg-jungle-teal-50 rounded-xl border border-jungle-teal-200">
                  <span className="text-[10px] text-jungle-teal-600 block">সময়কাল (Duration)</span>
                  <span className="font-bold text-sm text-jungle-teal-950">{formatDuration(selectedShift.opened_at, selectedShift.closed_at)}</span>
                </div>
              </div>

              <div className="bg-jungle-teal-50/60 p-3 rounded-2xl border border-jungle-teal-200 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-jungle-teal-700 font-sans">প্রারম্ভিক ক্যাশ (Opening Float):</span>
                  <span className="font-bold">৳ {((selectedShift.opening_cash_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span className="font-sans">ক্যাশ বিক্রি (Cash Sales):</span>
                  <span className="font-bold">+ ৳ {((selectedShift.total_cash_sales_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-azure-mist-800">
                  <span className="font-sans">ডিজিটাল বিক্রি (bKash/Nagad/Card):</span>
                  <span>৳ {(((selectedShift.total_bkash_sales_paisa + selectedShift.total_nagad_sales_paisa + selectedShift.total_card_sales_paisa) || 0) / 100).toFixed(2)}</span>
                </div>
                {selectedShift.total_cash_in_paisa > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span className="font-sans">ক্যাশ জমা (Petty Cash In):</span>
                    <span>+ ৳ {(selectedShift.total_cash_in_paisa / 100).toFixed(2)}</span>
                  </div>
                )}
                {selectedShift.total_cash_out_paisa > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span className="font-sans">ক্যাশ খরচ (Petty Cash Out):</span>
                    <span>- ৳ {(selectedShift.total_cash_out_paisa / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-jungle-teal-200 pt-1 font-bold text-jungle-teal-950">
                  <span className="font-sans">ড্রয়ারে মোট টাকা (Actual / Counted):</span>
                  <span>৳ {(((selectedShift.actual_cash_paisa ?? selectedShift.expected_cash_paisa) || 0) / 100).toFixed(2)}</span>
                </div>
                {selectedShift.cash_difference_paisa !== null && selectedShift.cash_difference_paisa !== undefined && selectedShift.cash_difference_paisa !== 0 && (
                  <div className={`flex justify-between font-bold ${selectedShift.cash_difference_paisa > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    <span className="font-sans">পার্থক্য (Over/Short):</span>
                    <span>{selectedShift.cash_difference_paisa > 0 ? `+ ৳ ${(selectedShift.cash_difference_paisa / 100).toFixed(2)}` : `- ৳ ${(Math.abs(selectedShift.cash_difference_paisa) / 100).toFixed(2)}`}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-jungle-teal-200 pt-1 text-rose-800 font-bold">
                  <span className="font-sans">মালিক টাকা তুলেছেন (Cash Withdrawn):</span>
                  <span>৳ {((selectedShift.closing_cash_withdrawn_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-900 font-extrabold">
                  <span className="font-sans">ড্রয়ারে রেখে যাওয়া হয়েছে (Left for Next Day):</span>
                  <span>৳ {((selectedShift.closing_float_left_paisa || 0) / 100).toFixed(2)}</span>
                </div>
              </div>

              {selectedShift.note && (
                <div className="p-2.5 bg-jungle-teal-50 rounded-xl border border-jungle-teal-200 font-sans text-ui-xs">
                  <span className="text-[10px] text-jungle-teal-600 block font-bold">নোট:</span>
                  <p className="text-jungle-teal-900">{selectedShift.note}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => handlePrintSlip(selectedShift)}
                className="flex-1 py-2.5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-bold rounded-xl text-ui-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Z-Report</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedShift(null)}
                className="px-4 py-2.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 font-bold rounded-xl text-ui-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Printable Thermal Z-Report Slip Container */}
      <div className="hidden">
        <div ref={printAreaRef}>
          {selectedShift && (
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#000000', padding: '4px' }}>
              <div className="text-center" style={{ textAlign: 'center', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>{shopName}</h2>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>*** SHIFT Z-REPORT ***</div>
                <div style={{ fontSize: '9.5px', color: '#475569', marginTop: '2px' }}>
                  {new Date(selectedShift.opened_at).toLocaleDateString('en-GB')}
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '4px 0', fontSize: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cashier:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedShift.user_name || 'Staff'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Opened:</span>
                  <span>{new Date(selectedShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Closed:</span>
                  <span>{selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Still Open'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Duration:</span>
                  <span>{formatDuration(selectedShift.opened_at, selectedShift.closed_at)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sales Count:</span>
                  <span style={{ fontWeight: 'bold' }}>{selectedShift.sales_count}</span>
                </div>
              </div>

              {/* Breakdown */}
              <div style={{ margin: '6px 0', fontSize: '10.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Opening Float:</span>
                  <span style={{ fontWeight: 'bold' }}>৳ {((selectedShift.opening_cash_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash Sales:</span>
                  <span style={{ fontWeight: 'bold' }}>+ ৳ {((selectedShift.total_cash_sales_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>bKash Sales:</span>
                  <span>৳ {((selectedShift.total_bkash_sales_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Nagad Sales:</span>
                  <span>৳ {((selectedShift.total_nagad_sales_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Card Sales:</span>
                  <span>৳ {((selectedShift.total_card_sales_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                {selectedShift.total_cash_in_paisa > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cash In (+):</span>
                    <span>+ ৳ {(selectedShift.total_cash_in_paisa / 100).toFixed(2)}</span>
                  </div>
                )}
                {selectedShift.total_cash_out_paisa > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cash Out (-):</span>
                    <span>- ৳ {(selectedShift.total_cash_out_paisa / 100).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Cash Reconciliation */}
              <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Expected Cash:</span>
                  <span>৳ {((selectedShift.expected_cash_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Actual Counted:</span>
                  <span>৳ {(((selectedShift.actual_cash_paisa ?? selectedShift.expected_cash_paisa) || 0) / 100).toFixed(2)}</span>
                </div>
                {selectedShift.cash_difference_paisa !== null && selectedShift.cash_difference_paisa !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>Difference:</span>
                    <span>{selectedShift.cash_difference_paisa === 0 ? '৳ 0.00 (Balanced)' : selectedShift.cash_difference_paisa > 0 ? `+ ৳ ${(selectedShift.cash_difference_paisa / 100).toFixed(2)} (Over)` : `- ৳ ${(Math.abs(selectedShift.cash_difference_paisa) / 100).toFixed(2)} (Short)`}</span>
                  </div>
                )}
              </div>

              {/* Handover & Next Day Float */}
              <div style={{ borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Cash Withdrawn:</span>
                  <span>৳ {((selectedShift.closing_cash_withdrawn_paisa || 0) / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Left in Drawer:</span>
                  <span>৳ {((selectedShift.closing_float_left_paisa || 0) / 100).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', color: '#475569' }}>
                Printed: {new Date().toLocaleString()}
                <br />
                *** END OF REPORT ***
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
