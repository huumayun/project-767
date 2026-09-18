import React, { useState, useEffect, useRef } from 'react';
import {
  Clock,
  Printer,
  ArrowLeft,
  Receipt,
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
import { openPrintPreview } from '../../utils/printPreview';

interface ShiftsHistoryViewProps {
  currentSession: UserSession | null;
  onOpenShiftModal?: () => void;
  /** A shift to open the report for as soon as the list loads. */
  autoOpenShiftId?: string | null;
  onAutoOpenHandled?: () => void;
  /** Opens the closing count for the running shift. */
  onCloseShift?: () => void;
}

export const ShiftsHistoryView: React.FC<ShiftsHistoryViewProps> = ({
  currentSession,
  onOpenShiftModal,
  autoOpenShiftId,
  onAutoOpenHandled,
  onCloseShift,
}) => {
  const [cashTxType, setCashTxType] = useState<'cash_in' | 'cash_out' | null>(null);
  const [cashTxAmount, setCashTxAmount] = useState('');
  const [cashTxReason, setCashTxReason] = useState('');
  const [cashTxBusy, setCashTxBusy] = useState(false);
  const [shifts, setShifts] = useState<ShiftSummaryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedShift, setSelectedShift] = useState<ShiftSummaryData | null>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);


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

  // The sidebar badge names a shift; open its report as soon as the list
  // holding it has arrived.
  useEffect(() => {
    if (!autoOpenShiftId || shifts.length === 0) return;
    const match = shifts.find((s) => s.shift_id === autoOpenShiftId);
    if (match) {
      setSelectedShift(match);
      onAutoOpenHandled?.();
    }
  }, [autoOpenShiftId, shifts]);

  /** Petty cash in or out, for the shift currently on screen. */
  const submitCashTx = async () => {
    if (!window.api?.shifts?.addCashTx || !selectedShift || !cashTxType) return;
    const amount = parseFloat(cashTxAmount);
    if (!amount || amount <= 0) return;
    if (!cashTxReason.trim()) return;

    setCashTxBusy(true);
    try {
      await window.api.shifts.addCashTx({
        shift_id: selectedShift.shift_id,
        type: cashTxType,
        amount_paisa: Math.round(amount * 100),
        reason: cashTxReason.trim(),
      });
      setCashTxType(null);
      setCashTxAmount('');
      setCashTxReason('');
      // Re-read so the drawer figures and the movement list both catch up.
      const fresh = await window.api.shifts.getHistory(100);
      setShifts(fresh || []);
      const updated = (fresh || []).find((s) => s.shift_id === selectedShift.shift_id);
      if (updated) setSelectedShift(updated);
    } catch (err: any) {
      setError(err?.message || 'Could not record that cash movement.');
    } finally {
      setCashTxBusy(false);
    }
  };

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

  /*
   * The Z-report used to be built for an 80mm roll and printed the instant the
   * window opened, closing itself half a second later - so it could not be read
   * before it came out of the printer, and a shift cash-up is exactly the thing
   * an owner wants to check first.
   *
   * It is an A4 document now, written from the shift itself rather than scraped
   * out of a hidden thermal slip, and it waits with a Print button. The toolbar
   * disappears on paper.
   */
  const handlePrintSlip = (shift: ShiftSummaryData) => {
    const tk = (paisa?: number | null) => ((paisa || 0) / 100).toFixed(2);
    const esc = (v: any) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const netSales = shift.net_sales_paisa ?? shift.total_sales_paisa ?? 0;
    const profit = shift.gross_profit_paisa || 0;
    const margin = netSales > 0 ? ((profit / netSales) * 100).toFixed(1) : '0.0';
    const digital =
      (shift.total_bkash_sales_paisa || 0) +
      (shift.total_nagad_sales_paisa || 0) +
      (shift.total_card_sales_paisa || 0) +
      (shift.total_other_sales_paisa || 0);
    const dueCollected =
      (shift.total_cash_due_collected_paisa || 0) + (shift.total_other_due_collected_paisa || 0);
    const diff = shift.cash_difference_paisa;
    const txs = shift.sale_transactions || [];
    const petty = shift.cash_transactions || [];

    const row = (label: string, value: string, opts: { strong?: boolean; rule?: boolean; tone?: string } = {}) =>
      `<tr class="${opts.rule ? 'rule' : ''}">
         <td class="${opts.strong ? 'strong' : ''}">${esc(label)}</td>
         <td class="num ${opts.strong ? 'strong' : ''} ${opts.tone || ''}">${value}</td>
       </tr>`;

    const buildHtml = (withTransactions: boolean) => `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Shift Z-Report - ${esc(shift.user_name || 'Shift')}</title>
          <meta charset="utf-8" />
          <style>
            /* The margin has to live here. Chromium's print pipeline lets the
               document's @page rule win over the margins passed to print(), so
               setting it in code and zero here produced an edge-to-edge sheet:
               the last rows fell into the printer's unprintable border and a
               100-bill report came out 3 pages instead of 4. */
            @page { size: A4 portrait; margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #0f172a; background: #f1f5f9; margin: 0; font-size: 11pt; line-height: 1.4;
            }
            .sheet { background: #fff; max-width: 210mm; min-height: 297mm; margin: 16px auto; padding: 14mm; }
            h1 { font-size: 17pt; margin: 0; }
            h2 { font-size: 11pt; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #0f172a; }
            .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
                    border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
            .muted { color: #475569; font-size: 9.5pt; }
            .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 10px; font-size: 9.5pt; }
            .meta span { display: block; color: #64748b; }
            .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; }
            .kpi span { display: block; font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
            .kpi b { font-size: 13pt; }
            .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
            table { width: 100%; border-collapse: collapse; }
            td, th { padding: 3px 0; vertical-align: baseline; }
            .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
            .strong { font-weight: 700; }
            .rule td { border-top: 1px solid #cbd5e1; padding-top: 6px; }
            .neg { color: #b91c1c; }
            .pos { color: #15803d; }
            .warn { color: #b45309; }
            .txs th { border-bottom: 1px solid #0f172a; font-size: 8.5pt; text-transform: uppercase;
                      color: #475569; text-align: left; letter-spacing: .04em; }
            .txs th.num { text-align: right; }
            .txs td { border-bottom: 1px solid #e2e8f0; font-size: 9.5pt; }
            .txs tr { page-break-inside: avoid; break-inside: avoid; }
            /* A heading stranded at the foot of a page, or half a signature
               block, is what a three-page shift looks like without these. */
            h2 { break-after: avoid; page-break-after: avoid; }
            .sign { break-inside: avoid; page-break-inside: avoid; }
            .sign { margin-top: 26mm; display: flex; justify-content: space-between; gap: 40px; }
            .sign div { flex: 1; border-top: 1px solid #0f172a; padding-top: 5px; font-size: 9pt; text-align: center; color: #475569; }
            @media print {
              body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .sheet { margin: 0; padding: 0; max-width: none; min-height: 0; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="head">
              <div>
                <h1>${esc(shopName)}</h1>
                <div class="muted">Shift Z-Report</div>
              </div>
              <div class="muted" style="text-align:right">
                <div><strong>${esc(shift.user_name || 'Staff')}</strong></div>
                <div>${esc(shift.device_id || '')}</div>
                <div>${shift.status === 'open' ? 'Running' : 'Closed'}</div>
              </div>
            </div>

            <div class="meta">
              <div><span>Opened</span>${new Date(shift.opened_at).toLocaleString()}</div>
              <div><span>Closed</span>${shift.closed_at ? new Date(shift.closed_at).toLocaleString() : '—'}</div>
              <div><span>Duration</span>${esc(formatDuration(shift.opened_at, shift.closed_at))}</div>
              <div><span>Bills</span>${shift.sales_count || 0}</div>
            </div>

            <div class="kpis">
              <div class="kpi"><span>Net Sales</span><b>৳ ${tk(netSales)}</b></div>
              <div class="kpi"><span>Gross Profit</span><b>৳ ${tk(profit)}</b><span>${margin}% margin</span></div>
              <div class="kpi"><span>Sold on Credit</span><b>৳ ${tk(shift.total_due_sales_paisa)}</b><span>${shift.due_sales_count || 0} bills</span></div>
              <div class="kpi"><span>Cash Over / Short</span><b class="${!diff ? '' : diff > 0 ? 'pos' : 'neg'}">${
                diff === null || diff === undefined ? '—' : diff === 0 ? '৳ 0.00' : diff > 0 ? '+ ৳ ' + tk(diff) : '- ৳ ' + tk(Math.abs(diff))
              }</b></div>
            </div>

            <div class="cols">
              <div>
                <h2>Cash Drawer</h2>
                <table>
                  ${row('Opening float', '৳ ' + tk(shift.opening_cash_paisa))}
                  ${row('Cash sales', '+ ৳ ' + tk(shift.total_cash_sales_paisa), { tone: 'pos' })}
                  ${(shift.total_cash_due_collected_paisa || 0) > 0 ? row('Old balances collected', '+ ৳ ' + tk(shift.total_cash_due_collected_paisa), { tone: 'pos' }) : ''}
                  ${(shift.total_cash_in_paisa || 0) > 0 ? row('Petty cash in', '+ ৳ ' + tk(shift.total_cash_in_paisa), { tone: 'pos' }) : ''}
                  ${(shift.total_cash_refund_paisa || 0) > 0 ? row('Customer refunds', '- ৳ ' + tk(shift.total_cash_refund_paisa), { tone: 'neg' }) : ''}
                  ${((shift.total_cash_paid_out_paisa || 0) - (shift.total_cash_refund_paisa || 0)) > 0 ? row('Paid to suppliers', '- ৳ ' + tk((shift.total_cash_paid_out_paisa || 0) - (shift.total_cash_refund_paisa || 0)), { tone: 'neg' }) : ''}
                  ${(shift.total_cash_out_paisa || 0) > 0 ? row('Petty cash out', '- ৳ ' + tk(shift.total_cash_out_paisa), { tone: 'neg' }) : ''}
                  ${row('Expected in drawer', '৳ ' + tk(shift.expected_cash_paisa), { strong: true, rule: true })}
                  ${row('Counted', shift.actual_cash_paisa === null || shift.actual_cash_paisa === undefined ? '—' : '৳ ' + tk(shift.actual_cash_paisa), { strong: true })}
                  ${row('Withdrawn by owner', '৳ ' + tk(shift.closing_cash_withdrawn_paisa), { rule: true, tone: 'neg' })}
                  ${row('Left for next day', '৳ ' + tk(shift.closing_float_left_paisa), { strong: true, tone: 'pos' })}
                </table>
              </div>
              <div>
                <h2>Trading</h2>
                <table>
                  ${row('Gross sales', '৳ ' + tk(shift.total_sales_paisa))}
                  ${(shift.total_returned_paisa || 0) > 0 ? row('Returns', '- ৳ ' + tk(shift.total_returned_paisa), { tone: 'neg' }) : ''}
                  ${row('Net sales', '৳ ' + tk(netSales), { strong: true })}
                  ${row('Cost of goods sold', '- ৳ ' + tk(shift.total_cogs_paisa))}
                  ${row('Gross profit', '৳ ' + tk(profit), { strong: true, rule: true, tone: 'pos' })}
                  ${row('Margin', margin + '%')}
                  ${row('Taken in cash', '৳ ' + tk(shift.total_cash_sales_paisa), { rule: true })}
                  ${(shift.total_bkash_sales_paisa || 0) > 0 ? row('bKash Sales', '৳ ' + tk(shift.total_bkash_sales_paisa)) : ''}
                  ${(shift.total_nagad_sales_paisa || 0) > 0 ? row('Nagad Sales', '৳ ' + tk(shift.total_nagad_sales_paisa)) : ''}
                  ${(shift.total_card_sales_paisa || 0) > 0 ? row('Card Sales', '৳ ' + tk(shift.total_card_sales_paisa)) : ''}
                  ${(shift.total_other_sales_paisa || 0) > 0 ? row('Other Sales', '৳ ' + tk(shift.total_other_sales_paisa)) : ''}
                  ${row('Sold on credit', '৳ ' + tk(shift.total_due_sales_paisa), { tone: 'warn' })}
                  ${dueCollected > 0 ? row('Old balances collected', '৳ ' + tk(dueCollected)) : ''}
                </table>
              </div>
            </div>

            ${!withTransactions ? `<h2>Transactions</h2><p class="muted">${txs.length} bill${txs.length === 1 ? '' : 's'} — list not included in this print.</p>` : `
            <h2>Transactions (${txs.length})</h2>
            ${txs.length === 0 ? '<p class="muted">No sales were rung up in this shift.</p>' : `
              <table class="txs">
                <thead>
                  <tr>
                    <th>Time</th><th>Invoice</th><th>Customer</th>
                    <th class="num">Total</th><th class="num">Paid</th><th class="num">Returned</th><th class="num">Due</th>
                  </tr>
                </thead>
                <tbody>
                  ${txs.map((t) => `
                    <tr>
                      <td>${new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>${esc(t.invoice_no)}</td>
                      <td>${esc(t.customer_name)}</td>
                      <td class="num">৳ ${tk(t.total_paisa)}</td>
                      <td class="num">৳ ${tk(t.paid_paisa)}</td>
                      <td class="num">${t.returned_paisa > 0 ? '৳ ' + tk(t.returned_paisa) : '—'}</td>
                      <td class="num ${t.due_paisa > 0 ? 'neg strong' : ''}">${t.due_paisa > 0 ? '৳ ' + tk(t.due_paisa) : '—'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`}`}

            ${petty.length === 0 ? '' : `
              <h2>Petty Cash (${petty.length})</h2>
              <table class="txs">
                <tbody>
                  ${petty.map((c: any) => `
                    <tr>
                      <td>${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>${esc(c.reason || 'No reason given')}</td>
                      <td class="num ${c.type === 'cash_in' ? 'pos' : 'neg'}">${c.type === 'cash_in' ? '+' : '-'} ৳ ${tk(c.amount_paisa)}</td>
                    </tr>`).join('')}
                </tbody>
              </table>`}

            ${shift.note ? `<h2>Note</h2><p>${esc(shift.note)}</p>` : ''}

            <div class="sign">
              <div>Cashier</div>
              <div>Owner / Manager</div>
            </div>
          </div>
        </body>
      </html>
    `;

    openPrintPreview(buildHtml(true), {
      label: `Shift Z-Report — ${shift.user_name || 'Staff'} · prints on A4`,
      marginMm: 14,
      fileName: `shift-z-report-${new Date(shift.opened_at).toISOString().slice(0, 10)}`,
      toggle: {
        label: `List all ${txs.length} transaction${txs.length === 1 ? '' : 's'}`,
        on: true,
        render: buildHtml,
      },
    });
  };

  const shopName = shopSettings?.shop_name || 'Fatema Electronics';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 font-sans max-w-7xl mx-auto w-full">
      {!selectedShift && (<>
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-jungle-teal-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-jungle-teal-100 flex items-center justify-center text-jungle-teal-800">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-jungle-teal-950 flex items-center gap-2">
              <span>Shifts &amp; Cash Drawer</span>
              <span className="px-2.5 py-0.5 bg-jungle-teal-100 text-jungle-teal-800 rounded-full text-xs font-mono font-bold">
                {shifts.length}
              </span>
            </h1>
            <p className="text-ui-xs text-jungle-teal-600">
              Opening balance, cash collected, withdrawals and drawer reconciliation for every shift
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
              <span>Shift Drawer</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="p-3.5 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-jungle-teal-600 block">Total Sales</span>
          <span className="text-base font-extrabold text-jungle-teal-950">
            ৳ {(totalSalesPaisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-emerald-200 bg-emerald-50/40 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-emerald-800 block">Cash Sales</span>
          <span className="text-base font-extrabold text-emerald-900">
            ৳ {(totalCashSalesPaisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-rose-200 bg-rose-50/30 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-rose-800 block">Cash Withdrawn</span>
          <span className="text-base font-extrabold text-rose-900">
            ৳ {(totalWithdrawnPaisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="p-3.5 bg-white border border-jungle-teal-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-sans text-jungle-teal-600 block">Difference</span>
          <span className={`text-base font-extrabold ${totalDiffPaisa === 0 ? 'text-emerald-700' : totalDiffPaisa > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
            {totalDiffPaisa >= 0 ? `+ ৳ ${(totalDiffPaisa / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}` : `- ৳ ${(Math.abs(totalDiffPaisa) / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`}
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
              placeholder="Search by cashier name or note..."
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
            All ({shifts.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('open')}
            className={`px-3 py-1.5 rounded-xl text-ui-xs font-bold transition-colors ${
              statusFilter === 'open' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Open ({shifts.filter((s) => s.status === 'open').length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('closed')}
            className={`px-3 py-1.5 rounded-xl text-ui-xs font-bold transition-colors ${
              statusFilter === 'closed' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Closed ({shifts.filter((s) => s.status === 'closed').length})
          </button>
        </div>
      </div>

      {/* 4. Shifts Table */}
      <div className="bg-white rounded-3xl border border-jungle-teal-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 min-h-0">
          <table className="w-full text-left text-ui-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-jungle-teal-50 border-b border-jungle-teal-200 text-jungle-teal-900 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Timing</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Opening Float</th>
                <th className="py-3 px-3 text-right">Cash Sales</th>
                <th className="py-3 px-3 text-right">Total Sales</th>
                <th className="py-3 px-3 text-right">Cash in Drawer</th>
                <th className="py-3 px-3 text-right">Withdrawn</th>
                <th className="py-3 px-3 text-right">Left in Drawer</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-jungle-teal-400 font-sans">
                    No shift records found.
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
                            {shift.closed_at ? new Date(shift.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Running'}
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
                            Open
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[10.5px] font-bold font-sans">
                            Closed
                          </span>
                        )}
                      </td>

                      {/* 4. Opening Float */}
                      <td className="py-3 px-3 text-right font-bold text-jungle-teal-900">
                        ৳ {((shift.opening_cash_paisa || 0) / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>

                      {/* 5. Cash Sales */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-700">
                        ৳ {((shift.total_cash_sales_paisa || 0) / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>

                      {/* 6. Total Sales */}
                      <td className="py-3 px-3 text-right font-bold text-jungle-teal-950">
                        ৳ {((shift.total_sales_paisa || 0) / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>

                      {/* 7. Actual Counted Drawer Cash */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-extrabold text-jungle-teal-950 block">
                          ৳ {(((shift.actual_cash_paisa ?? shift.expected_cash_paisa) || 0) / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                        </span>
                        {!isOpen && diff !== 0 && (
                          <span className={`text-[10px] font-bold block ${diff > 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                            {diff > 0 ? `+ ৳ ${(diff / 100).toFixed(0)}` : `- ৳ ${(Math.abs(diff) / 100).toFixed(0)}`}
                          </span>
                        )}
                      </td>

                      {/* 8. Withdrawn by Owner */}
                      <td className="py-3 px-3 text-right font-bold text-rose-700">
                        ৳ {((shift.closing_cash_withdrawn_paisa || 0) / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>

                      {/* 9. Float Left in Drawer */}
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-800">
                        ৳ {((shift.closing_float_left_paisa || 0) / 100).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}
                      </td>

                      {/* 10. Actions */}
                      <td className="py-3 px-4 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedShift(shift)}
                            className="p-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePrintSlip(shift)}
                            className="p-1.5 bg-azure-mist-100 hover:bg-azure-mist-200 text-azure-mist-800 rounded-lg transition-colors"
                            title="Print Z-Report"
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

      </>)}
      {/* Shift report. Was a popup: a cash-up that an owner reads line by line,
          squeezed into a 512px box over a table they cannot see. It takes the
          page now, and the list comes back with the button above it. */}
      {selectedShift && (() => {
        const tk = (paisa?: number | null) => ((paisa || 0) / 100).toFixed(2);
        const netSales = selectedShift.net_sales_paisa ?? selectedShift.total_sales_paisa ?? 0;
        const profit = selectedShift.gross_profit_paisa || 0;
        const margin = netSales > 0 ? ((profit / netSales) * 100).toFixed(1) : '0.0';
        const digital =
          (selectedShift.total_bkash_sales_paisa || 0) +
          (selectedShift.total_nagad_sales_paisa || 0) +
          (selectedShift.total_card_sales_paisa || 0) +
          (selectedShift.total_other_sales_paisa || 0);
        const dueCollected =
          (selectedShift.total_cash_due_collected_paisa || 0) +
          (selectedShift.total_other_due_collected_paisa || 0);
        const diff = selectedShift.cash_difference_paisa;
        const txs = selectedShift.sale_transactions || [];
        const pettyCash = selectedShift.cash_transactions || [];

        const Row = ({ label, value, tone = '', bold = false, top = false }: any) => (
          <div className={`flex justify-between items-baseline py-1 ${top ? 'border-t border-jungle-teal-200 mt-1 pt-1.5' : ''}`}>
            <span className={`font-sans text-ui-xs ${tone || 'text-jungle-teal-700'}`}>{label}</span>
            <span className={`font-mono text-ui-sm ${bold ? 'font-bold' : ''} ${tone || 'text-jungle-teal-900'}`}>{value}</span>
          </div>
        );

        return (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* back / actions */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedShift(null)}
                className="flex items-center gap-1.5 text-ui-xs font-semibold text-jungle-teal-700 hover:text-jungle-teal-900 bg-white border border-jungle-teal-200 hover:border-jungle-teal-300 rounded-xl px-3 py-2 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All shifts</span>
              </button>
              <div className="flex items-center gap-2">
                {selectedShift.status === 'open' && (
                  <>
                    <button
                      type="button"
                      onClick={() => { setCashTxType('cash_in'); setCashTxAmount(''); setCashTxReason(''); }}
                      className="text-ui-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl px-3 py-2 transition-colors"
                    >
                      + Cash In
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCashTxType('cash_out'); setCashTxAmount(''); setCashTxReason(''); }}
                      className="text-ui-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl px-3 py-2 transition-colors"
                    >
                      &minus; Cash Out
                    </button>
                    {onCloseShift && (
                      <button
                        type="button"
                        onClick={onCloseShift}
                        className="text-ui-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 py-2 shadow-sm transition-colors"
                      >
                        End / Close Shift
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handlePrintSlip(selectedShift)}
                  className="flex items-center gap-1.5 text-ui-xs font-semibold bg-azure-mist-700 hover:bg-azure-mist-800 text-white rounded-xl px-4 py-2 shadow-sm transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Z-Report</span>
                </button>
              </div>
            </div>

            {/* Petty cash, recorded without leaving the report. */}
            {cashTxType && (
              <div
                className={`rounded-2xl border p-4 ${
                  cashTxType === 'cash_in' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                }`}
              >
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">
                      {cashTxType === 'cash_in' ? 'Cash into the drawer (৳)' : 'Cash out of the drawer (৳)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      autoFocus
                      value={cashTxAmount}
                      onChange={(e) => setCashTxAmount(e.target.value)}
                      className="w-full h-[40px] bg-white border border-jungle-teal-200 rounded-xl px-3 text-ui-sm font-mono font-semibold text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600"
                    />
                  </div>
                  <div className="flex-[2] min-w-[200px]">
                    <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={cashTxReason}
                      onChange={(e) => setCashTxReason(e.target.value)}
                      placeholder={cashTxType === 'cash_in' ? 'Change float top-up' : 'Delivery van fuel'}
                      className="w-full h-[40px] bg-white border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={submitCashTx}
                    disabled={cashTxBusy || !cashTxAmount || !cashTxReason.trim()}
                    className="h-[40px] px-5 rounded-xl bg-azure-mist-700 hover:bg-azure-mist-800 text-white text-ui-xs font-semibold transition-colors disabled:opacity-40"
                  >
                    {cashTxBusy ? 'Saving…' : 'Record'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTxType(null)}
                    className="h-[40px] px-4 rounded-xl bg-white border border-jungle-teal-200 text-jungle-teal-700 text-ui-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* who, when, how long */}
            <div className="bg-white border border-jungle-teal-200 rounded-3xl p-5 shadow-xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-extrabold text-jungle-teal-950">Shift Report</h1>
                  <p className="text-ui-xs text-jungle-teal-600 mt-0.5">
                    {selectedShift.user_name || 'Staff'}
                    {selectedShift.device_id ? ` · ${selectedShift.device_id}` : ''}
                  </p>
                </div>
                <span
                  className={`text-ui-2xs font-bold px-2.5 py-1 rounded-full border ${
                    selectedShift.status === 'open'
                      ? 'bg-muted-teal-100 text-muted-teal-800 border-muted-teal-200'
                      : 'bg-jungle-teal-100 text-jungle-teal-700 border-jungle-teal-200'
                  }`}
                >
                  {selectedShift.status === 'open' ? 'Running' : 'Closed'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-jungle-teal-100 font-mono text-ui-sm">
                <div>
                  <span className="block text-ui-2xs text-jungle-teal-600 font-sans">Opened</span>
                  <span className="text-jungle-teal-900">{new Date(selectedShift.opened_at).toLocaleString()}</span>
                </div>
                <div>
                  <span className="block text-ui-2xs text-jungle-teal-600 font-sans">Closed</span>
                  <span className="text-jungle-teal-900">
                    {selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleString() : '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-ui-2xs text-jungle-teal-600 font-sans">Duration</span>
                  <span className="text-jungle-teal-900">{formatDuration(selectedShift.opened_at, selectedShift.closed_at)}</span>
                </div>
                <div>
                  <span className="block text-ui-2xs text-jungle-teal-600 font-sans">Bills</span>
                  <span className="text-jungle-teal-900">{selectedShift.sales_count || 0}</span>
                </div>
              </div>
            </div>

            {/* the four numbers an owner looks for first */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-jungle-teal-200 rounded-2xl p-4 shadow-xs">
                <span className="block text-ui-2xs text-jungle-teal-600 uppercase tracking-wider">Net Sales</span>
                <span className="font-mono text-xl font-bold text-jungle-teal-950">৳ {tk(netSales)}</span>
              </div>
              <div className="bg-white border border-muted-teal-200 rounded-2xl p-4 shadow-xs">
                <span className="block text-ui-2xs text-muted-teal-700 uppercase tracking-wider">Gross Profit</span>
                <span className="font-mono text-xl font-bold text-muted-teal-800">৳ {tk(profit)}</span>
                <span className="block text-ui-2xs text-jungle-teal-500 font-mono">{margin}% margin</span>
              </div>
              <div className="bg-white border border-amber-200 rounded-2xl p-4 shadow-xs">
                <span className="block text-ui-2xs text-amber-800 uppercase tracking-wider">Sold on Credit</span>
                <span className="font-mono text-xl font-bold text-amber-800">৳ {tk(selectedShift.total_due_sales_paisa)}</span>
                <span className="block text-ui-2xs text-jungle-teal-500 font-mono">
                  {selectedShift.due_sales_count || 0} bill{(selectedShift.due_sales_count || 0) === 1 ? '' : 's'}
                </span>
              </div>
              <div
                className={`bg-white border rounded-2xl p-4 shadow-xs ${
                  diff === null || diff === undefined || diff === 0 ? 'border-jungle-teal-200' : 'border-rose-200'
                }`}
              >
                <span className="block text-ui-2xs text-jungle-teal-600 uppercase tracking-wider">Cash Over / Short</span>
                <span
                  className={`font-mono text-xl font-bold ${
                    !diff ? 'text-jungle-teal-950' : diff > 0 ? 'text-blue-700' : 'text-rose-700'
                  }`}
                >
                  {diff === null || diff === undefined
                    ? '—'
                    : diff === 0
                    ? '৳ 0.00'
                    : diff > 0
                    ? `+ ৳ ${tk(diff)}`
                    : `- ৳ ${tk(Math.abs(diff))}`}
                </span>
              </div>
            </div>

            {/* drawer on the left, shop on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-jungle-teal-200 rounded-2xl p-4 shadow-xs">
                <h3 className="font-semibold text-ui-base text-jungle-teal-900 pb-2 mb-1 border-b border-jungle-teal-200">
                  Cash Drawer
                </h3>
                <Row label="Opening float" value={`৳ ${tk(selectedShift.opening_cash_paisa)}`} />
                <Row label="Cash sales" value={`+ ৳ ${tk(selectedShift.total_cash_sales_paisa)}`} tone="text-muted-teal-800" />
                {(selectedShift.total_cash_due_collected_paisa || 0) > 0 && (
                  <Row label="Old balances collected" value={`+ ৳ ${tk(selectedShift.total_cash_due_collected_paisa)}`} tone="text-muted-teal-800" />
                )}
                {(selectedShift.total_cash_in_paisa || 0) > 0 && (
                  <Row label="Petty cash in" value={`+ ৳ ${tk(selectedShift.total_cash_in_paisa)}`} tone="text-emerald-700" />
                )}
                {/* Split apart: "refunds, vendors" as one figure could not be
                    reconciled against anything - a short drawer gave no clue
                    whether goods had come back or a supplier had been paid. */}
                {(selectedShift.total_cash_refund_paisa || 0) > 0 && (
                  <Row label="Customer refunds" value={`- ৳ ${tk(selectedShift.total_cash_refund_paisa)}`} tone="text-rose-700" />
                )}
                {((selectedShift.total_cash_paid_out_paisa || 0) - (selectedShift.total_cash_refund_paisa || 0)) > 0 && (
                  <Row
                    label="Paid to suppliers"
                    value={`- ৳ ${tk((selectedShift.total_cash_paid_out_paisa || 0) - (selectedShift.total_cash_refund_paisa || 0))}`}
                    tone="text-rose-700"
                  />
                )}
                {(selectedShift.total_cash_out_paisa || 0) > 0 && (
                  <Row label="Petty cash out" value={`- ৳ ${tk(selectedShift.total_cash_out_paisa)}`} tone="text-rose-700" />
                )}
                <Row label="Expected in drawer" value={`৳ ${tk(selectedShift.expected_cash_paisa)}`} bold top />
                <Row
                  label="Counted"
                  value={selectedShift.actual_cash_paisa === null || selectedShift.actual_cash_paisa === undefined ? '—' : `৳ ${tk(selectedShift.actual_cash_paisa)}`}
                  bold
                />
                <Row label="Withdrawn by owner" value={`৳ ${tk(selectedShift.closing_cash_withdrawn_paisa)}`} tone="text-rose-800" top />
                <Row label="Left for next day" value={`৳ ${tk(selectedShift.closing_float_left_paisa)}`} tone="text-emerald-800" bold />
              </div>

              <div className="bg-white border border-jungle-teal-200 rounded-2xl p-4 shadow-xs">
                <h3 className="font-semibold text-ui-base text-jungle-teal-900 pb-2 mb-1 border-b border-jungle-teal-200">
                  Trading
                </h3>
                <Row label="Gross sales" value={`৳ ${tk(selectedShift.total_sales_paisa)}`} />
                {(selectedShift.total_returned_paisa || 0) > 0 && (
                  <Row label="Returns" value={`- ৳ ${tk(selectedShift.total_returned_paisa)}`} tone="text-rose-700" />
                )}
                <Row label="Net sales" value={`৳ ${tk(netSales)}`} bold />
                <Row label="Cost of goods sold" value={`- ৳ ${tk(selectedShift.total_cogs_paisa)}`} />
                <Row label="Gross profit" value={`৳ ${tk(profit)}`} tone="text-muted-teal-800" bold top />
                <Row label="Margin" value={`${margin}%`} tone="text-muted-teal-800" />
                <Row label="Taken in cash" value={`৳ ${tk(selectedShift.total_cash_sales_paisa)}`} top />
                {(selectedShift.total_bkash_sales_paisa || 0) > 0 && <Row label="bKash Sales" value={`৳ ${tk(selectedShift.total_bkash_sales_paisa)}`} />}
                {(selectedShift.total_nagad_sales_paisa || 0) > 0 && <Row label="Nagad Sales" value={`৳ ${tk(selectedShift.total_nagad_sales_paisa)}`} />}
                {(selectedShift.total_card_sales_paisa || 0) > 0 && <Row label="Card Sales" value={`৳ ${tk(selectedShift.total_card_sales_paisa)}`} />}
                {(selectedShift.total_other_sales_paisa || 0) > 0 && <Row label="Other Sales" value={`৳ ${tk(selectedShift.total_other_sales_paisa)}`} />}
                <Row label="Sold on credit" value={`৳ ${tk(selectedShift.total_due_sales_paisa)}`} tone="text-amber-800" />
                {dueCollected > 0 && <Row label="Old balances collected" value={`৳ ${tk(dueCollected)}`} />}
              </div>
            </div>

            {/* every bill */}
            <div className="bg-white border border-jungle-teal-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-jungle-teal-200 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-azure-mist-700" />
                <h3 className="font-semibold text-ui-base text-jungle-teal-900">Transactions ({txs.length})</h3>
              </div>
              {txs.length === 0 ? (
                <p className="px-4 py-8 text-center text-ui-xs text-jungle-teal-500">No sales were rung up in this shift.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-ui-xs">
                    <thead className="bg-jungle-teal-50 text-jungle-teal-700 font-mono text-ui-2xs uppercase">
                      <tr>
                        <th className="text-left font-medium px-4 py-2">Time</th>
                        <th className="text-left font-medium px-3 py-2">Invoice</th>
                        <th className="text-left font-medium px-3 py-2">Customer</th>
                        <th className="text-right font-medium px-3 py-2">Total</th>
                        <th className="text-right font-medium px-3 py-2">Paid</th>
                        <th className="text-right font-medium px-3 py-2">Returned</th>
                        <th className="text-right font-medium px-4 py-2">Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-jungle-teal-100 font-mono">
                      {txs.map((row) => (
                        <tr key={row.id} className="hover:bg-jungle-teal-50/50 transition-colors">
                          <td className="px-4 py-2 whitespace-nowrap text-jungle-teal-700">
                            {new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-azure-mist-800 font-semibold">{row.invoice_no}</td>
                          <td className="px-3 py-2 font-sans text-jungle-teal-900 max-w-[200px] truncate">{row.customer_name}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-jungle-teal-900">৳ {tk(row.total_paisa)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-muted-teal-800">৳ {tk(row.paid_paisa)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-jungle-teal-500">
                            {row.returned_paisa > 0 ? `৳ ${tk(row.returned_paisa)}` : '—'}
                          </td>
                          <td className={`px-4 py-2 text-right whitespace-nowrap ${row.due_paisa > 0 ? 'text-rose-700 font-bold' : 'text-jungle-teal-400'}`}>
                            {row.due_paisa > 0 ? `৳ ${tk(row.due_paisa)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* money moved by hand */}
            {pettyCash.length > 0 && (
              <div className="bg-white border border-jungle-teal-200 rounded-2xl shadow-xs overflow-hidden">
                <div className="px-4 py-3 border-b border-jungle-teal-200">
                  <h3 className="font-semibold text-ui-base text-jungle-teal-900">Petty Cash ({pettyCash.length})</h3>
                </div>
                <div className="divide-y divide-jungle-teal-100">
                  {pettyCash.map((tx: any) => (
                    <div key={tx.id} className="px-4 py-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block text-ui-xs text-jungle-teal-900 truncate">{tx.reason || 'No reason given'}</span>
                        <span className="block text-ui-2xs text-jungle-teal-500 font-mono">
                          {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={`font-mono text-ui-sm font-bold shrink-0 ${tx.type === 'cash_in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {tx.type === 'cash_in' ? '+' : '-'} ৳ {tk(tx.amount_paisa)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedShift.note && (
              <div className="bg-white border border-jungle-teal-200 rounded-2xl p-4 shadow-xs">
                <span className="block text-ui-2xs text-jungle-teal-600 font-bold uppercase tracking-wider mb-1">Note</span>
                <p className="text-ui-xs text-jungle-teal-900">{selectedShift.note}</p>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};
