import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserSession,
  SalesReportData,
  ProfitReportData,
  BestSellingProduct,
  StockValuationData,
  DueReportData,
} from '../../types/ipc';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Calendar,
  Printer,
  RefreshCw,
  AlertCircle,
  Lock,
  PieChart,
  Download,
  CreditCard,
  CalendarDays,
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { formatCompactTaka, formatCompactUnits } from '../dashboard/DashboardView';
import { InvoiceModal } from '../pos/InvoiceModal';

interface ReportsViewProps {
  currentSession: UserSession | null;
}

type DatePreset = 'today' | '7days' | '15days' | '30days' | 'this_month' | 'custom';

const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getRangeDates = (preset: DatePreset, customStart?: string, customEnd?: string) => {
  const now = new Date();
  const todayStr = formatDateToISO(now);

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }
  if (preset === '7days') {
    const past = new Date();
    past.setDate(now.getDate() - 6);
    return { startDate: formatDateToISO(past), endDate: todayStr };
  }
  if (preset === '15days') {
    const past = new Date();
    past.setDate(now.getDate() - 14);
    return { startDate: formatDateToISO(past), endDate: todayStr };
  }
  if (preset === '30days') {
    const past = new Date();
    past.setDate(now.getDate() - 29);
    return { startDate: formatDateToISO(past), endDate: todayStr };
  }
  if (preset === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: formatDateToISO(startOfMonth), endDate: todayStr };
  }
  return {
    startDate: customStart || todayStr,
    endDate: customEnd || todayStr,
  };
};

/** Exact taka for table cells. The summary tiles use formatCompactTaka. */
const formatTaka = (paisa: number) => `৳ ${(paisa / 100).toFixed(2)}`;

export const ReportsView: React.FC<ReportsViewProps> = ({ currentSession }) => {
  const isOwner = currentSession?.role === 'owner';
  const [activeSubTab, setActiveSubTab] = useState<
    'sales' | 'profit' | 'payments' | 'best_selling' | 'valuation' | 'due'
  >('sales');

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const todayStr = useMemo(() => formatDateToISO(new Date()), []);
  const monthStartStr = useMemo(() => formatDateToISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), []);

  // What the date boxes show: the range in force, or a draft being typed.
  const [customStartDate, setCustomStartDate] = useState<string>(monthStartStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  /*
   * The range the report is actually for, kept apart from the boxes.
   *
   * It used to be derived from the boxes directly. So a preset left them
   * showing a range that was no longer in force ("Last 15 Days" beside
   * 01/09 – 13/09); and once on a custom range, every change in a box re-ran
   * the report before Apply was pressed. Presets and Apply are now the only
   * things that change it.
   */
  const [appliedRange, setAppliedRange] = useState(() => getRangeDates('this_month'));
  const { startDate, endDate } = appliedRange;

  // Numbers each fetch so a slow answer for a range already left behind
  // cannot overwrite the one on screen.
  const requestSeq = useRef(0);

  // Data States
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReportData | null>(null);
  const [bestSelling, setBestSelling] = useState<BestSellingProduct[]>([]);
  const [stockValuation, setStockValuation] = useState<StockValuationData | null>(null);
  const [dueReport, setDueReport] = useState<DueReportData | null>(null);

  // Due is a balance, so the date range above does not apply to it.
  const isDueTab = activeSubTab === 'due';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invoice Inspection Modal State
  /*
   * The day the pointer is over, read out in the chart header.
   *
   * There was a floating tooltip above each bar, and it could not be read: the
   * bar strip scrolls sideways, and `overflow-x: auto` makes the browser clip
   * the other axis too, so a tooltip sitting 13px above the strip was cut off
   * along its top - and being wider than a 36px column, clipped at the sides as
   * well. Reading it out in the header puts it outside the scrolling box
   * entirely, where nothing can crop it and it holds still long enough to read.
   */
  const [hoveredTrend, setHoveredTrend] = useState<
    { date: string; sales_paisa: number; orders_count: number } | null
  >(null);

  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const handleOpenInvoice = (invoiceNo: string) => {
    if (!invoiceNo) return;
    setSelectedInvoiceNo(invoiceNo);
    setShowInvoiceModal(true);
  };

  const fetchReportData = async () => {
    if (!window.api) return;
    const seq = ++requestSeq.current;
    const stale = () => seq !== requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      if (activeSubTab === 'sales') {
        const data = await window.api.reports.getSalesReport({ startDate, endDate });
        if (stale()) return;
        setSalesReport(data);
      } else if (activeSubTab === 'profit') {
        if (!isOwner) {
          setError('Profit & Loss reports require Owner privileges.');
          return;
        }
        const data = await window.api.reports.getProfitReport({ startDate, endDate });
        if (stale()) return;
        setProfitReport(data);
      } else if (activeSubTab === 'payments') {
        const data = await window.api.reports.getSalesReport({ startDate, endDate });
        if (stale()) return;
        setSalesReport(data);
      } else if (activeSubTab === 'best_selling') {
        const data = await window.api.reports.getBestSelling({ startDate, endDate, limit: 30 });
        if (stale()) return;
        setBestSelling(data);
      } else if (activeSubTab === 'valuation') {
        if (!isOwner) {
          setError('Stock Valuation requires Owner privileges.');
          return;
        }
        const data = await window.api.reports.getStockValuation();
        if (stale()) return;
        setStockValuation(data);
      } else if (activeSubTab === 'due') {
        // No date argument: the handler reports the balance as it stands.
        const data = await window.api.reports.getDueReport();
        if (stale()) return;
        setDueReport(data);
      }
    } catch (err: any) {
      if (!stale()) setError(err.message || 'Failed to fetch report data.');
    } finally {
      if (!stale()) setLoading(false);
    }
  };

  // The one place a report is fetched. Apply used to fetch here as well as
  // through this effect - the first time still with the old range, because
  // state had not updated yet - so a stale report could land last.
  useEffect(() => {
    fetchReportData();
  }, [activeSubTab, startDate, endDate]);

  const choosePreset = (preset: DatePreset) => {
    const range = getRangeDates(preset);
    setDatePreset(preset);
    setAppliedRange(range);
    // The boxes show the range now in force.
    setCustomStartDate(range.startDate);
    setCustomEndDate(range.endDate);
  };

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStartDate && customEndDate) {
      // Backwards dates are the same range; filtered start..end they came back empty.
      const [start, end] = customStartDate <= customEndDate ? [customStartDate, customEndDate] : [customEndDate, customStartDate];
      setCustomStartDate(start);
      setCustomEndDate(end);
      setDatePreset('custom');
      setAppliedRange({ startDate: start, endDate: end });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // CSV Export for Active Tab
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    // A due export is stamped with the day it was taken, not a range it has not.
    let filename = isDueTab
      ? `report_due_as_of_${todayStr}.csv`
      : `report_${activeSubTab}_${startDate}_to_${endDate}.csv`;

    if (activeSubTab === 'sales' && salesReport) {
      headers = ['Date', 'Orders Count', 'Total Sales (Taka)'];
      rows = salesReport.daily_trends.map((t) => [t.date, t.orders_count, (t.sales_paisa / 100).toFixed(2)]);
    } else if (activeSubTab === 'profit' && profitReport) {
      headers = ['Product Name', 'Barcode', 'Quantity Sold', 'Revenue (Taka)', 'Cost COGS (Taka)', 'Gross Profit (Taka)', 'Margin %'];
      rows = profitReport.product_profits.map((p) => [
        `"${p.product_name.replace(/"/g, '""')}"`,
        p.barcode || '',
        p.qty_sold,
        (p.revenue_paisa / 100).toFixed(2),
        (p.cost_paisa / 100).toFixed(2),
        (p.profit_paisa / 100).toFixed(2),
        `${p.margin_percent}%`,
      ]);
    } else if (activeSubTab === 'best_selling') {
      headers = ['Rank', 'Product Name', 'Barcode', 'Category', 'Quantity Sold', 'Revenue (Taka)'];
      rows = bestSelling.map((p, idx) => [
        idx + 1,
        `"${p.product_name.replace(/"/g, '""')}"`,
        p.barcode || '',
        `"${(p.category_name || '').replace(/"/g, '""')}"`,
        p.qty_sold,
        (p.revenue_paisa / 100).toFixed(2),
      ]);
    } else if (activeSubTab === 'payments' && salesReport) {
      headers = ['Payment Channel', 'Total Collected (Taka)'];
      rows = [
        ['Cash In Drawer', (salesReport.payments_breakdown.cash_paisa / 100).toFixed(2)],
        ['bKash', (salesReport.payments_breakdown.bkash_paisa / 100).toFixed(2)],
        ['Nagad', (salesReport.payments_breakdown.nagad_paisa / 100).toFixed(2)],
        ['Card / Bank POS', (salesReport.payments_breakdown.card_paisa / 100).toFixed(2)],
        ['Other', ((salesReport.payments_breakdown.other_paisa || 0) / 100).toFixed(2)],
      ];
    } else if (activeSubTab === 'due' && dueReport) {
      const q = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
      headers = ['Type', 'Name', 'Phone', 'Billed (Taka)', 'Paid (Taka)', 'Outstanding (Taka)', 'Last Sale'];
      rows = [
        ...dueReport.receivables.map((c) => [
          'Customer owes shop',
          q(c.name),
          q(c.phone || ''),
          (c.total_sales_paisa / 100).toFixed(2),
          (c.total_paid_paisa / 100).toFixed(2),
          (c.due_paisa / 100).toFixed(2),
          (c.last_sale_at || '').slice(0, 10),
        ]),
        ...dueReport.payables.map((sup) => [
          'Shop owes supplier',
          q(sup.name),
          q(sup.phone || ''),
          '',
          '',
          (sup.payable_paisa / 100).toFixed(2),
          '',
        ]),
      ];
    } else if (activeSubTab === 'valuation' && stockValuation) {
      headers = ['Metric', 'Value'];
      rows = [
        ['Total Unique Items', stockValuation.total_products_count],
        ['Total Stock Units', stockValuation.total_stock_units],
        ['Total Cost Valuation (Taka)', (stockValuation.total_cost_valuation_paisa / 100).toFixed(2)],
        ['Total Retail Valuation (Taka)', (stockValuation.total_retail_valuation_paisa / 100).toFixed(2)],
        ['Potential Gross Profit (Taka)', (stockValuation.potential_gross_profit_paisa / 100).toFixed(2)],
      ];
    }

    if (rows.length === 0) return;

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    /*
     * A byte-order mark, so Excel reads this as UTF-8.
     *
     * The blob already declares charset=utf-8 and Excel ignores it: without
     * a BOM it falls back to the system codepage, and every Bengali customer
     * or product name opens as mojibake - as does the taka sign. Written as
     * an escape, not the character itself, which is invisible in an editor
     * and trivially deleted by accident.
     */
    const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // The blob stays in memory until its URL is released.
    URL.revokeObjectURL(url);
  };

  // Helper for rendering Responsive Daily Sales Bar Chart
  const renderSalesChart = (trends: { date: string; sales_paisa: number; orders_count: number }[]) => {
    if (!trends || trends.length === 0) {
      return (
        <div className="bg-white border border-jungle-teal-200 p-8 rounded-3xl text-center text-jungle-teal-500 font-sans shadow-xs">
          No sales recorded within this date range.
        </div>
      );
    }
    const maxSales = Math.max(...trends.map((t) => t.sales_paisa / 100), 100);

    return (
      <div className="bg-white border border-jungle-teal-200 p-5 rounded-3xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-jungle-teal-900 font-mono flex items-center gap-1.5">
              <span>Daily Sales Trend</span>
            </h3>
            <p className="text-[11px] text-jungle-teal-500 font-sans">
              Visual trajectory of revenue and order volume by date
            </p>
          </div>
          {/*
            One slot, two jobs: the peak at rest, the hovered day while the
            pointer is on a bar. `min-h` holds its height across the swap so
            the chart below does not jump as the pointer crosses the bars.
          */}
          <div className="min-h-[30px] flex items-center">
            {hoveredTrend ? (
              <span className="text-xs font-mono font-extrabold text-jungle-teal-900 bg-jungle-teal-100 border border-jungle-teal-300 px-3 py-1 rounded-xl whitespace-nowrap">
                {hoveredTrend.date}
                <span className="mx-1.5 text-jungle-teal-400">·</span>
                ৳ {(hoveredTrend.sales_paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                <span className="mx-1.5 text-jungle-teal-400">·</span>
                <span className="text-muted-teal-800">
                  {hoveredTrend.orders_count} order{hoveredTrend.orders_count === 1 ? '' : 's'}
                </span>
              </span>
            ) : (
              <span className="text-xs font-mono font-extrabold text-azure-mist-900 bg-azure-mist-50 border border-azure-mist-200 px-3 py-1 rounded-xl whitespace-nowrap">
                Peak: ৳ {maxSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            )}
          </div>
        </div>

        <div className="relative pt-6 pb-2">
          {/* h-52/h-44 rather than h-44/h-36: the tallest bar plus its value
              tag needs 138px, and a 117px column pushed the tag 1px past the
              top of the strip, where the scroll container clipped it. */}
          <div className="flex items-end gap-2 h-52 border-b border-jungle-teal-200 pb-2 px-2 overflow-x-auto">
            {trends.map((t) => {
              const amountTaka = t.sales_paisa / 100;
              const barHeightPx = Math.round((amountTaka / maxSales) * 120);
              const actualHeight = Math.max(barHeightPx, amountTaka > 0 ? 10 : 3);
              const label = t.date.slice(5); // MM-DD

              return (
                <div
                  key={t.date}
                  onMouseEnter={() => setHoveredTrend(t)}
                  onMouseLeave={() => setHoveredTrend((h) => (h?.date === t.date ? null : h))}
                  /*
                    A native title as well as the header readout: it is drawn by
                    the browser outside the page, so no amount of overflow on
                    any ancestor can crop it.
                  */
                  title={`${t.date} — ৳ ${amountTaka.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })} · ${t.orders_count} order${t.orders_count === 1 ? '' : 's'}`}
                  className="flex-1 min-w-[36px] flex flex-col justify-end items-center group relative h-44 cursor-default"
                >
                  {/* Value tag on top of bar if active */}
                  {amountTaka > 0 && (
                    <span className="text-[9.5px] font-mono font-extrabold text-jungle-teal-800 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      ৳{Math.round(amountTaka)}
                    </span>
                  )}

                  {/* Visual Bar */}
                  <div
                    style={{
                      height: `${actualHeight}px`,
                      background:
                        amountTaka > 0
                          ? 'linear-gradient(180deg, #0d9488 0%, #115e59 100%)'
                          : '#e2e8f0',
                    }}
                    className="w-full max-w-[26px] rounded-t-lg transition-all duration-300 shadow-xs group-hover:brightness-110 group-hover:ring-2 group-hover:ring-azure-mist-600 group-hover:ring-offset-1"
                  />

                  {/* Date label */}
                  <span className="text-[10px] font-mono text-jungle-teal-600 group-hover:text-jungle-teal-900 group-hover:font-bold mt-2 rotate-[-30deg] origin-top-left sm:rotate-0 sm:origin-center truncate">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4 text-jungle-teal-900 font-sans pb-4 max-w-7xl mx-auto w-full">
      {/* 1. Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-jungle-teal-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-azure-mist-100 flex items-center justify-center text-azure-mist-800">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-jungle-teal-950 flex items-center gap-2">
              <span>Financial & Business Reports</span>
            </h1>
            <p className="text-ui-xs text-jungle-teal-600">
              Accurate sales, profit & loss, payment channels, best selling products & stock valuation
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchReportData}
            disabled={loading}
            className="p-2 bg-jungle-teal-50 hover:bg-jungle-teal-100 border border-jungle-teal-200 text-jungle-teal-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh Report Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-jungle-teal-50 hover:bg-jungle-teal-100 border border-jungle-teal-200 text-jungle-teal-800 font-bold rounded-xl text-ui-xs flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            title="Download CSV Spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>CSV Export</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-2 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-bold rounded-xl text-ui-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/*
        2. Date Filter Bar.

        Hidden on the Due tab and replaced by the moment the balance was read.
        Leaving a date range on screen there would invite the reading that the
        outstanding figure belongs to those dates; it does not - it is what is
        owed right now, whatever range happens to be selected.
      */}
      {isDueTab ? (
        <div className="bg-white p-3.5 rounded-3xl border border-jungle-teal-200 shadow-xs flex flex-wrap items-center gap-2 text-xs">
          <CalendarDays className="w-3.5 h-3.5 text-jungle-teal-500 shrink-0" />
          <span className="font-bold text-jungle-teal-900">Outstanding balances as of</span>
          <span className="font-mono font-bold text-jungle-teal-900 bg-jungle-teal-100 border border-jungle-teal-200 px-2.5 py-1 rounded-xl">
            {dueReport ? new Date(dueReport.as_of).toLocaleString() : '—'}
          </span>
          <span className="text-jungle-teal-500 font-sans">
            A due is a running balance, so this tab ignores the date range.
          </span>
        </div>
      ) : (
      <div className="bg-white p-3.5 rounded-3xl border border-jungle-teal-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 font-bold">
          <button
            type="button"
            onClick={() => choosePreset('today')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              datePreset === 'today'
                ? 'bg-muted-teal-800 text-white shadow-xs'
                : 'bg-jungle-teal-50 text-jungle-teal-700 hover:bg-jungle-teal-100'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => choosePreset('7days')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              datePreset === '7days'
                ? 'bg-muted-teal-800 text-white shadow-xs'
                : 'bg-jungle-teal-50 text-jungle-teal-700 hover:bg-jungle-teal-100'
            }`}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => choosePreset('15days')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              datePreset === '15days'
                ? 'bg-muted-teal-800 text-white shadow-xs'
                : 'bg-jungle-teal-50 text-jungle-teal-700 hover:bg-jungle-teal-100'
            }`}
          >
            Last 15 Days
          </button>
          <button
            type="button"
            onClick={() => choosePreset('30days')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              datePreset === '30days'
                ? 'bg-muted-teal-800 text-white shadow-xs'
                : 'bg-jungle-teal-50 text-jungle-teal-700 hover:bg-jungle-teal-100'
            }`}
          >
            Last 30 Days
          </button>
          <button
            type="button"
            onClick={() => choosePreset('this_month')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              datePreset === 'this_month'
                ? 'bg-muted-teal-800 text-white shadow-xs'
                : 'bg-jungle-teal-50 text-jungle-teal-700 hover:bg-jungle-teal-100'
            }`}
          >
            This Month
          </button>
        </div>

        {/* Custom Date Form */}
        <form onSubmit={handleApplyCustomDates} className="flex items-center gap-2 font-mono">
          <div className="flex items-center gap-1.5 bg-jungle-teal-50 px-2.5 py-1 rounded-xl border border-jungle-teal-200">
            <Calendar className="w-3.5 h-3.5 text-azure-mist-700" />
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-transparent text-jungle-teal-900 focus:outline-hidden text-xs font-semibold"
            />
            <span className="text-jungle-teal-400">→</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-transparent text-jungle-teal-900 focus:outline-hidden text-xs font-semibold"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-900 font-sans font-bold rounded-xl transition-colors cursor-pointer"
          >
            Apply Filter
          </button>
        </form>
      </div>
      )}

      {/* 3. Sub-Tabs Navigation (Fixed Pill Button Group) */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 bg-white border border-jungle-teal-200 p-1.5 rounded-2xl shadow-xs">
        <button
          onClick={() => setActiveSubTab('sales')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-ui-xs font-bold transition-all text-center cursor-pointer ${
            activeSubTab === 'sales'
              ? 'bg-azure-mist-700 text-white shadow-xs'
              : 'text-jungle-teal-700 hover:text-jungle-teal-950 hover:bg-jungle-teal-50'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Sales Summary</span>
        </button>

        <button
          onClick={() => setActiveSubTab('profit')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-ui-xs font-bold transition-all text-center cursor-pointer ${
            activeSubTab === 'profit'
              ? 'bg-muted-teal-700 text-white shadow-xs'
              : 'text-jungle-teal-700 hover:text-jungle-teal-950 hover:bg-jungle-teal-50'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Profit & Loss (P&L)</span>
          {!isOwner && <Lock className="w-3 h-3 text-jungle-teal-400 shrink-0 ml-0.5" />}
        </button>

        <button
          onClick={() => setActiveSubTab('payments')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-ui-xs font-bold transition-all text-center cursor-pointer ${
            activeSubTab === 'payments'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'text-jungle-teal-700 hover:text-jungle-teal-950 hover:bg-jungle-teal-50'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Payment Channels</span>
        </button>

        <button
          onClick={() => setActiveSubTab('best_selling')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-ui-xs font-bold transition-all text-center cursor-pointer ${
            activeSubTab === 'best_selling'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'text-jungle-teal-700 hover:text-jungle-teal-950 hover:bg-jungle-teal-50'
          }`}
        >
          <Package className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Best Sellers</span>
        </button>

        <button
          onClick={() => setActiveSubTab('valuation')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-ui-xs font-bold transition-all text-center col-span-2 sm:col-span-1 cursor-pointer ${
            activeSubTab === 'valuation'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-jungle-teal-700 hover:text-jungle-teal-950 hover:bg-jungle-teal-50'
          }`}
        >
          <PieChart className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Stock Valuation</span>
          {!isOwner && <Lock className="w-3 h-3 text-jungle-teal-400 shrink-0 ml-0.5" />}
        </button>

        <button
          onClick={() => setActiveSubTab('due')}
          className={`py-2 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-ui-xs font-bold transition-all text-center col-span-2 sm:col-span-1 cursor-pointer ${
            activeSubTab === 'due'
              ? 'bg-amber-800 text-white shadow-xs'
              : 'text-jungle-teal-700 hover:text-jungle-teal-950 hover:bg-jungle-teal-50'
          }`}
        >
          <HandCoins className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Due & Payable</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-ui-xs flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. TAB 1: SALES & REVENUE */}
      {activeSubTab === 'sales' && salesReport && (
        <div className="space-y-4">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {/* Gross Sales */}
            <div className="bg-white border border-jungle-teal-200 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-600 font-sans block mb-1">Invoiced Gross Sales</span>
              <span
                className="text-xl font-extrabold text-azure-mist-900 block truncate"
                title={formatCompactTaka(salesReport.gross_sales_paisa).full}
              >
                {formatCompactTaka(salesReport.gross_sales_paisa).compact}
              </span>
              <span className="text-[10.5px] text-jungle-teal-500 font-sans block mt-1">
                {salesReport.total_orders} total sales orders
              </span>
            </div>

            {/* Discounts */}
            <div className="bg-white border border-amber-200 bg-amber-50/30 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-amber-800 font-sans block mb-1">Discounts Given</span>
              <span
                className="text-xl font-extrabold text-amber-700 block truncate"
                title={formatCompactTaka(salesReport.discount_paisa).full}
              >
                {formatCompactTaka(salesReport.discount_paisa).compact}
              </span>
              <span className="text-[10.5px] text-amber-600 font-sans block mt-1">
                Catalog & invoice discounts
              </span>
            </div>

            {/* Returns / Refunds */}
            <div className="bg-white border border-rose-200 bg-rose-50/30 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-rose-800 font-sans block mb-1">Goods Returned</span>
              {/*
                The goods that came back, not the cash that went out. Only the
                cash was shown here, so a return settled against a customer's
                baki - no cash leaves the drawer - read as zero on a day when
                stock had genuinely come back off the shelf. Both figures now
                appear, because they answer different questions.
              */}
              <span
                className="text-xl font-extrabold text-rose-700 block truncate"
                title={formatCompactTaka(salesReport.total_returned_paisa).full}
              >
                {formatCompactTaka(salesReport.total_returned_paisa).compact}
              </span>
              <span className="text-[10.5px] text-rose-600 font-sans block mt-1">
                {salesReport.refunds_count} return{salesReport.refunds_count === 1 ? '' : 's'}
                {' · '}
                {formatCompactTaka(salesReport.total_refunded_paisa).compact} cash refunded
              </span>
            </div>

            {/* Net Sales */}
            <div className="bg-white border border-emerald-200 bg-emerald-50/40 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-emerald-800 font-sans block mb-1">Net Realized Revenue</span>
              <span
                className="text-xl font-extrabold text-emerald-900 block truncate"
                title={formatCompactTaka(salesReport.net_sales_paisa).full}
              >
                {formatCompactTaka(salesReport.net_sales_paisa).compact}
              </span>
              <span className="text-[10.5px] text-emerald-700 font-sans block mt-1">
                Gross Sales - Refunds
              </span>
            </div>
          </div>

          {/* Visual Trend Chart */}
          {renderSalesChart(salesReport.daily_trends)}

          {/* Daily Trends Table */}
          <div className="bg-white border border-jungle-teal-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-jungle-teal-200 bg-jungle-teal-50 flex justify-between items-center text-xs">
              <span className="font-bold text-jungle-teal-900 font-sans">Daily Sales Breakdown</span>
              <span className="font-mono text-jungle-teal-600 font-bold">{salesReport.daily_trends.length} days recorded</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-jungle-teal-50/50 text-jungle-teal-700 uppercase font-mono text-[10.5px] border-b border-jungle-teal-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Orders Count</th>
                  <th className="py-3 px-4 text-right">Daily Sales (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jungle-teal-100 font-mono text-xs">
                {salesReport.daily_trends.map((day) => (
                  <tr key={day.date} className="hover:bg-jungle-teal-50/60 transition-colors">
                    <td className="py-3 px-4 text-jungle-teal-950 font-bold">{day.date}</td>
                    <td className="py-3 px-4 text-center font-bold text-azure-mist-800">{day.orders_count}</td>
                    <td className="py-3 px-4 text-right font-extrabold text-jungle-teal-950">
                      ৳ {((day.sales_paisa || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB 2: PROFIT & LOSS (P&L) */}
      {activeSubTab === 'profit' && profitReport && (
        <div className="space-y-4">
          {/* P&L Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div className="bg-white border border-jungle-teal-200 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-600 font-sans block mb-1">Total Sales Revenue</span>
              <span
                className="text-xl font-extrabold text-jungle-teal-950 block truncate"
                title={formatCompactTaka(profitReport.total_revenue_paisa).full}
              >
                {formatCompactTaka(profitReport.total_revenue_paisa).compact}
              </span>
            </div>

            <div className="bg-white border border-rose-200 bg-rose-50/20 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-rose-800 font-sans block mb-1">Cost of Goods Sold (COGS)</span>
              <span
                className="text-xl font-extrabold text-rose-900 block truncate"
                title={formatCompactTaka(profitReport.total_cogs_paisa).full}
              >
                {formatCompactTaka(profitReport.total_cogs_paisa).compact}
              </span>
            </div>

            <div className="bg-white border border-emerald-200 bg-emerald-50/40 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-emerald-800 font-sans block mb-1">Gross Profit</span>
              <span
                className="text-xl font-extrabold text-emerald-900 block truncate"
                title={formatCompactTaka(profitReport.gross_profit_paisa).full}
              >
                {formatCompactTaka(profitReport.gross_profit_paisa).compact}
              </span>
            </div>

            <div className="bg-white border border-muted-teal-200 bg-muted-teal-50/40 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-muted-teal-800 font-sans block mb-1">Profit Margin %</span>
              <span className="text-2xl font-extrabold text-muted-teal-900 block">
                {profitReport.profit_margin_percent}%
              </span>
            </div>
          </div>

          {/* Product-by-Product Profit Table */}
          <div className="bg-white border border-jungle-teal-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-jungle-teal-200 bg-jungle-teal-50 flex justify-between items-center text-xs">
              <span className="font-bold text-jungle-teal-900 font-sans">Product Profit & Margin Leaderboard</span>
              <span className="font-mono text-jungle-teal-600 font-bold">{profitReport.product_profits.length} products sold</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-jungle-teal-50/50 text-jungle-teal-700 uppercase font-mono text-[10.5px] border-b border-jungle-teal-200">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3 text-center">Qty Sold</th>
                  <th className="py-3 px-3 text-right">Revenue (৳)</th>
                  <th className="py-3 px-3 text-right">Cost (৳)</th>
                  <th className="py-3 px-3 text-right">Gross Profit (৳)</th>
                  <th className="py-3 px-4 text-center">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jungle-teal-100 font-mono text-xs">
                {profitReport.product_profits.map((p) => {
                  const isHighMargin = p.margin_percent >= 30;
                  const isLowMargin = p.margin_percent < 10;

                  return (
                    <tr key={p.product_id} className="hover:bg-jungle-teal-50/60 transition-colors">
                      <td className="py-3 px-4 font-sans">
                        <span className="font-bold text-jungle-teal-950 block">{p.product_name}</span>
                        {p.barcode && <span className="text-[10px] text-jungle-teal-500 font-mono">{p.barcode}</span>}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-jungle-teal-900">{p.qty_sold}</td>
                      <td className="py-3 px-3 text-right font-bold text-jungle-teal-900">
                        ৳ {((p.revenue_paisa || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700 font-semibold">
                        ৳ {((p.cost_paisa || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-800">
                        ৳ {((p.profit_paisa || 0) / 100).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isHighMargin
                              ? 'bg-emerald-100 text-emerald-800'
                              : isLowMargin
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-azure-mist-100 text-azure-mist-800'
                          }`}
                        >
                          {p.margin_percent}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: PAYMENT CHANNELS & CASH INFLOW */}
      {activeSubTab === 'payments' && salesReport && (
        <div className="space-y-4">
          <div className="bg-white border border-jungle-teal-200 p-5 rounded-3xl shadow-xs space-y-4">
            <h3 className="text-sm font-extrabold text-jungle-teal-950 font-sans">
              Collections by Payment Channel
            </h3>

            {(() => {
              const b = salesReport.payments_breakdown;
              /*
               * "Other" is part of what was collected. It was left out of this
               * total and had no card of its own, and for as long as the till
               * had one merged Other button that was where every non-cash
               * payment went - so all of it was missing here, and the shares of
               * the channels that were shown added up to a hundred percent of
               * the wrong figure.
               */
              const otherPaisa = b.other_paisa || 0;
              const totalCollected = b.cash_paisa + b.bkash_paisa + b.nagad_paisa + b.card_paisa + otherPaisa;
              const cashPct = totalCollected > 0 ? Math.round((b.cash_paisa / totalCollected) * 100) : 0;
              const bkashPct = totalCollected > 0 ? Math.round((b.bkash_paisa / totalCollected) * 100) : 0;
              const nagadPct = totalCollected > 0 ? Math.round((b.nagad_paisa / totalCollected) * 100) : 0;
              const cardPct = totalCollected > 0 ? Math.round((b.card_paisa / totalCollected) * 100) : 0;
              const otherPct = totalCollected > 0 ? Math.round((otherPaisa / totalCollected) * 100) : 0;

              return (
                <div className="space-y-4">
                  {/* Visual Channel Share Bar */}
                  {totalCollected > 0 && (
                    <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
                      <div style={{ width: `${cashPct}%` }} className="bg-emerald-600" title={`Cash: ${cashPct}%`} />
                      <div style={{ width: `${bkashPct}%` }} className="bg-pink-600" title={`bKash: ${bkashPct}%`} />
                      <div style={{ width: `${nagadPct}%` }} className="bg-orange-600" title={`Nagad: ${nagadPct}%`} />
                      <div style={{ width: `${cardPct}%` }} className="bg-azure-mist-600" title={`Card: ${cardPct}%`} />
                      <div style={{ width: `${otherPct}%` }} className="bg-slate-500" title={`Other: ${otherPct}%`} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 font-mono">
                    {/* Cash */}
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl shadow-xs">
                      <span className="text-xs font-bold text-emerald-950 font-sans block mb-1">
                        Cash In Drawer
                      </span>
                      <span className="text-xl font-extrabold text-emerald-900 block">
                        ৳ {((b.cash_paisa || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-bold block mt-1">{cashPct}% share</span>
                    </div>

                    {/* bKash */}
                    <div className="bg-pink-50 border border-pink-200 p-4 rounded-2xl shadow-xs">
                      <span className="text-xs font-bold text-pink-950 font-sans block mb-1">
                        bKash Wallet
                      </span>
                      <span className="text-xl font-extrabold text-pink-900 block">
                        ৳ {((b.bkash_paisa || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] text-pink-700 font-bold block mt-1">{bkashPct}% share</span>
                    </div>

                    {/* Nagad */}
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl shadow-xs">
                      <span className="text-xs font-bold text-orange-950 font-sans block mb-1">
                        Nagad Wallet
                      </span>
                      <span className="text-xl font-extrabold text-orange-900 block">
                        ৳ {((b.nagad_paisa || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] text-orange-700 font-bold block mt-1">{nagadPct}% share</span>
                    </div>

                    {/* Card */}
                    <div className="bg-azure-mist-50 border border-azure-mist-200 p-4 rounded-2xl shadow-xs">
                      <span className="text-xs font-bold text-azure-mist-950 font-sans block mb-1">
                        POS Card / Bank
                      </span>
                      <span className="text-xl font-extrabold text-azure-mist-900 block">
                        ৳ {((b.card_paisa || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] text-azure-mist-700 font-bold block mt-1">{cardPct}% share</span>
                    </div>

                    {/* Other: Rocket, Upay, bank transfer, and every non-cash
                        payment taken while the till had a single Other button */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl shadow-xs">
                      <span className="text-xs font-bold text-slate-900 font-sans block mb-1">
                        Other
                      </span>
                      <span className="text-xl font-extrabold text-slate-800 block">
                        ৳ {(otherPaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[11px] text-slate-600 font-bold block mt-1">{otherPct}% share</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 7. TAB 4: BEST SELLING PRODUCTS */}
      {activeSubTab === 'best_selling' && (
        <div className="space-y-4">
          <div className="bg-white border border-jungle-teal-200 rounded-3xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-jungle-teal-200 bg-jungle-teal-50 flex justify-between items-center text-xs">
              <span className="font-bold text-jungle-teal-900 font-sans">
                Top Selling Products ({startDate} to {endDate})
              </span>
              <span className="font-mono text-jungle-teal-600 font-bold">{bestSelling.length} products ranked</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-jungle-teal-50/50 text-jungle-teal-700 uppercase font-mono text-[10.5px] border-b border-jungle-teal-200">
                <tr>
                  <th className="py-3 px-4 text-center">Rank</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-4 text-center">Units Sold (Qty)</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jungle-teal-100 font-mono text-xs">
                {bestSelling.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-jungle-teal-400 font-sans">
                      No products sold within this period.
                    </td>
                  </tr>
                ) : (
                  bestSelling.map((p, idx) => (
                    <tr key={p.product_id} className="hover:bg-jungle-teal-50/60 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center font-bold text-xs ${
                            idx === 0
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : idx === 1
                              ? 'bg-slate-200 text-slate-800'
                              : idx === 2
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-jungle-teal-50 text-jungle-teal-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-sans">
                        <span className="font-bold text-jungle-teal-950 block">{p.product_name}</span>
                        {p.barcode && <span className="text-[10px] text-jungle-teal-500 font-mono">{p.barcode}</span>}
                      </td>
                      <td className="py-3 px-3 font-sans text-jungle-teal-700 font-semibold">
                        {p.category_name || 'General'}
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-azure-mist-800">
                        {p.qty_sold} pcs
                      </td>
                      <td className="py-3 px-4 text-right font-extrabold text-jungle-teal-950">
                        ৳ {((p.revenue_paisa || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. TAB 5: STOCK VALUATION */}
      {activeSubTab === 'valuation' && stockValuation && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            {/* Total SKU Count */}
            <div className="bg-white border border-jungle-teal-200 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-600 font-sans block mb-1">Total SKUs (Items)</span>
              <span className="text-2xl font-extrabold text-jungle-teal-950 block">
                {stockValuation.total_products_count.toLocaleString('en-US')}
              </span>
            </div>

            {/* Total Units */}
            <div className="bg-white border border-jungle-teal-200 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-600 font-sans block mb-1">In-Stock Quantity</span>
              <span
                className="text-2xl font-extrabold text-azure-mist-900 block truncate"
                title={formatCompactUnits(stockValuation.total_stock_units).full}
              >
                {formatCompactUnits(stockValuation.total_stock_units).compact}
              </span>
            </div>

            {/* Total Cost Valuation */}
            <div className="bg-white border border-amber-200 bg-amber-50/20 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-amber-800 font-sans block mb-1">Total Cost Valuation</span>
              <span
                className="text-xl font-extrabold text-amber-900 block truncate"
                title={formatCompactTaka(stockValuation.total_cost_valuation_paisa).full}
              >
                {formatCompactTaka(stockValuation.total_cost_valuation_paisa).compact}
              </span>
            </div>

            {/* Total Retail Valuation */}
            <div className="bg-white border border-emerald-200 bg-emerald-50/40 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-emerald-800 font-sans block mb-1">Total Retail Valuation</span>
              <span
                className="text-xl font-extrabold text-emerald-900 block truncate"
                title={formatCompactTaka(stockValuation.total_retail_valuation_paisa).full}
              >
                {formatCompactTaka(stockValuation.total_retail_valuation_paisa).compact}
              </span>
            </div>
          </div>

          {/* Potential Gross Profit Card */}
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-3xl flex flex-wrap items-center justify-between gap-4 font-mono shadow-xs">
            <div>
              <span className="text-xs font-bold text-emerald-950 font-sans block">
                Potential Gross Profit from Current Inventory:
              </span>
              <p className="text-[11px] text-emerald-700 font-sans mt-0.5">
                Estimated profit if all current in-stock inventory is sold at regular retail price
              </p>
            </div>
            <span
              className="text-2xl font-extrabold text-emerald-950"
              title={formatCompactTaka(stockValuation.potential_gross_profit_paisa).full}
            >
              {formatCompactTaka(stockValuation.potential_gross_profit_paisa).compact}
            </span>
          </div>
        </div>
      )}

      {activeSubTab === 'due' && dueReport && (
        <div className="space-y-4">
          {/* Three headline figures: owed to the shop, owed by it, and the net. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-emerald-200 bg-emerald-50/40 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-emerald-800 font-sans mb-1 flex items-center gap-1.5">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                Receivable &mdash; customers owe the shop
              </span>
              <span
                className="text-xl font-extrabold text-emerald-900 block truncate"
                title={formatCompactTaka(dueReport.total_receivable_paisa).full}
              >
                {formatCompactTaka(dueReport.total_receivable_paisa).compact}
              </span>
              <span className="text-ui-2xs font-mono text-jungle-teal-500">
                {dueReport.customers_with_due_count} of {dueReport.total_customers_count} customers
              </span>
            </div>

            <div className="bg-white border border-rose-200 bg-rose-50/40 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-rose-800 font-sans mb-1 flex items-center gap-1.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Payable &mdash; the shop owes suppliers
              </span>
              <span
                className="text-xl font-extrabold text-rose-900 block truncate"
                title={formatCompactTaka(dueReport.total_payable_paisa).full}
              >
                {formatCompactTaka(dueReport.total_payable_paisa).compact}
              </span>
              <span className="text-ui-2xs font-mono text-jungle-teal-500">
                {dueReport.suppliers_with_payable_count} of {dueReport.total_suppliers_count} suppliers
              </span>
            </div>

            {/* Net position. Negative is a real answer - the shop owes more than
                it is owed - so it is coloured rather than hidden. */}
            <div className="bg-white border border-jungle-teal-200 p-4 rounded-3xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-700 font-sans block mb-1">Net position</span>
              <span
                className={`text-xl font-extrabold block truncate ${
                  dueReport.net_position_paisa < 0 ? 'text-rose-900' : 'text-jungle-teal-900'
                }`}
                title={formatCompactTaka(dueReport.net_position_paisa).full}
              >
                {dueReport.net_position_paisa < 0 ? '- ' : ''}
                {formatCompactTaka(Math.abs(dueReport.net_position_paisa)).compact}
              </span>
              <span className="text-ui-2xs font-mono text-jungle-teal-500">
                {dueReport.net_position_paisa < 0 ? 'owed out on balance' : 'owed in on balance'}
              </span>
            </div>
          </div>

          {/* Receivables */}
          <div className="bg-white border border-jungle-teal-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-jungle-teal-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-jungle-teal-900 font-mono">
                Customer Due
              </h3>
              <span className="font-mono text-ui-xs text-jungle-teal-600 font-bold">
                {dueReport.receivables.length} with a balance
              </span>
            </div>
            {dueReport.receivables.length === 0 ? (
              <p className="px-4 py-8 text-center text-jungle-teal-500 font-sans text-ui-sm">
                No customer owes anything. Everything billed has been collected.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-ui-sm">
                  <thead className="bg-jungle-teal-50 text-jungle-teal-600 font-mono text-ui-2xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Customer</th>
                      <th className="px-3 py-2 text-right">Billed</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Outstanding</th>
                      <th className="px-4 py-2 text-right">Last sale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-jungle-teal-100">
                    {dueReport.receivables.map((c) => (
                      <tr key={c.id} className="hover:bg-jungle-teal-50/60 transition-colors">
                        <td className="px-4 py-2">
                          <span className="font-semibold text-jungle-teal-900 block">{c.name}</span>
                          {c.phone && (
                            <span className="font-mono text-ui-2xs text-jungle-teal-500">{c.phone}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-jungle-teal-600">
                          {formatTaka(c.total_sales_paisa)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-jungle-teal-600">
                          {formatTaka(c.total_paid_paisa)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-extrabold text-amber-800">
                          {formatTaka(c.due_paisa)}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-ui-2xs text-jungle-teal-500">
                          {c.last_sale_at ? c.last_sale_at.slice(0, 10) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payables */}
          <div className="bg-white border border-jungle-teal-200 rounded-3xl shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-jungle-teal-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-jungle-teal-900 font-mono">
                Supplier Payable
              </h3>
              <span className="font-mono text-ui-xs text-jungle-teal-600 font-bold">
                {dueReport.payables.length} with a balance
              </span>
            </div>
            {dueReport.payables.length === 0 ? (
              <p className="px-4 py-8 text-center text-jungle-teal-500 font-sans text-ui-sm">
                Nothing owed to any supplier.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-ui-sm">
                  <thead className="bg-jungle-teal-50 text-jungle-teal-600 font-mono text-ui-2xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Supplier</th>
                      <th className="px-3 py-2 text-left">Contact</th>
                      <th className="px-3 py-2 text-right">Terms</th>
                      <th className="px-4 py-2 text-right">Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-jungle-teal-100">
                    {dueReport.payables.map((sup) => (
                      <tr key={sup.id} className="hover:bg-jungle-teal-50/60 transition-colors">
                        <td className="px-4 py-2">
                          <span className="font-semibold text-jungle-teal-900 block">{sup.name}</span>
                          {sup.phone && (
                            <span className="font-mono text-ui-2xs text-jungle-teal-500">{sup.phone}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-jungle-teal-600">{sup.contact_person || '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-jungle-teal-600">
                          {sup.payment_terms_days ? `${sup.payment_terms_days} d` : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-extrabold text-rose-800">
                          {formatTaka(sup.payable_paisa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invoice Inspector Modal */}
      {showInvoiceModal && selectedInvoiceNo && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          invoiceNo={selectedInvoiceNo}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoiceNo(null);
          }}
        />
      )}
    </div>
  );
};
