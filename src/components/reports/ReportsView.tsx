import React, { useState, useEffect, useMemo } from 'react';
import {
  UserSession,
  SalesReportData,
  ProfitReportData,
  BestSellingProduct,
  StockValuationData,
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

export const ReportsView: React.FC<ReportsViewProps> = ({ currentSession }) => {
  const isOwner = currentSession?.role === 'owner';
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'profit' | 'payments' | 'best_selling' | 'valuation'>('sales');

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const todayStr = useMemo(() => formatDateToISO(new Date()), []);
  const monthStartStr = useMemo(() => formatDateToISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), []);

  const [customStartDate, setCustomStartDate] = useState<string>(monthStartStr);
  const [customEndDate, setCustomEndDate] = useState<string>(todayStr);

  const { startDate, endDate } = useMemo(
    () => getRangeDates(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate]
  );

  // Data States
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReportData | null>(null);
  const [bestSelling, setBestSelling] = useState<BestSellingProduct[]>([]);
  const [stockValuation, setStockValuation] = useState<StockValuationData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invoice Inspection Modal State
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const handleOpenInvoice = (invoiceNo: string) => {
    if (!invoiceNo) return;
    setSelectedInvoiceNo(invoiceNo);
    setShowInvoiceModal(true);
  };

  const fetchReportData = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      if (activeSubTab === 'sales') {
        const data = await window.api.reports.getSalesReport({ startDate, endDate });
        setSalesReport(data);
      } else if (activeSubTab === 'profit') {
        if (!isOwner) {
          setError('Profit & Loss reports require Owner privileges.');
          setLoading(false);
          return;
        }
        const data = await window.api.reports.getProfitReport({ startDate, endDate });
        setProfitReport(data);
      } else if (activeSubTab === 'payments') {
        const data = await window.api.reports.getSalesReport({ startDate, endDate });
        setSalesReport(data);
      } else if (activeSubTab === 'best_selling') {
        const data = await window.api.reports.getBestSelling({ startDate, endDate, limit: 30 });
        setBestSelling(data);
      } else if (activeSubTab === 'valuation') {
        if (!isOwner) {
          setError('Stock Valuation requires Owner privileges.');
          setLoading(false);
          return;
        }
        const data = await window.api.reports.getStockValuation();
        setStockValuation(data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [activeSubTab, datePreset, startDate, endDate]);

  const handleApplyCustomDates = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStartDate && customEndDate) {
      setDatePreset('custom');
      fetchReportData();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // CSV Export for Active Tab
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `report_${activeSubTab}_${startDate}_to_${endDate}.csv`;

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
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <span className="text-xs font-mono font-extrabold text-azure-mist-900 bg-azure-mist-50 border border-azure-mist-200 px-3 py-1 rounded-xl">
            Peak: ৳ {maxSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="relative pt-6 pb-2">
          <div className="flex items-end gap-2 h-44 border-b border-jungle-teal-200 pb-2 px-2 overflow-x-auto">
            {trends.map((t) => {
              const amountTaka = t.sales_paisa / 100;
              const barHeightPx = Math.round((amountTaka / maxSales) * 120);
              const actualHeight = Math.max(barHeightPx, amountTaka > 0 ? 10 : 3);
              const label = t.date.slice(5); // MM-DD

              return (
                <div key={t.date} className="flex-1 min-w-[36px] flex flex-col justify-end items-center group relative h-36">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 hidden group-hover:flex flex-col items-center z-30 pointer-events-none">
                    <div className="bg-jungle-teal-950 text-white text-[10.5px] font-mono py-1 px-2.5 rounded-xl shadow-xl whitespace-nowrap">
                      <div>{t.date}</div>
                      <div className="font-bold text-muted-teal-300">
                        ৳ {amountTaka.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({t.orders_count} orders)
                      </div>
                    </div>
                    <div className="w-2 h-2 bg-jungle-teal-950 transform rotate-45 -mt-1" />
                  </div>

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
                    className="w-full max-w-[26px] rounded-t-lg transition-all duration-300 shadow-xs group-hover:brightness-110"
                  />

                  {/* Date label */}
                  <span className="text-[10px] font-mono text-jungle-teal-600 mt-2 rotate-[-30deg] origin-top-left sm:rotate-0 sm:origin-center truncate">
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

      {/* 2. Unified Date Filter Bar */}
      <div className="bg-white p-3.5 rounded-3xl border border-jungle-teal-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 font-bold">
          <button
            type="button"
            onClick={() => setDatePreset('today')}
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
            onClick={() => setDatePreset('7days')}
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
            onClick={() => setDatePreset('15days')}
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
            onClick={() => setDatePreset('30days')}
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
            onClick={() => setDatePreset('this_month')}
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

      {/* 3. Sub-Tabs Navigation (Fixed Pill Button Group) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-white border border-jungle-teal-200 p-1.5 rounded-2xl shadow-xs">
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
              <span className="text-[11px] text-rose-800 font-sans block mb-1">Returns / Refunds</span>
              <span
                className="text-xl font-extrabold text-rose-700 block truncate"
                title={formatCompactTaka(salesReport.total_refunded_paisa).full}
              >
                {formatCompactTaka(salesReport.total_refunded_paisa).compact}
              </span>
              <span className="text-[10.5px] text-rose-600 font-sans block mt-1">
                {salesReport.refunds_count} refund transactions
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
              const totalCollected = b.cash_paisa + b.bkash_paisa + b.nagad_paisa + b.card_paisa;
              const cashPct = totalCollected > 0 ? Math.round((b.cash_paisa / totalCollected) * 100) : 0;
              const bkashPct = totalCollected > 0 ? Math.round((b.bkash_paisa / totalCollected) * 100) : 0;
              const nagadPct = totalCollected > 0 ? Math.round((b.nagad_paisa / totalCollected) * 100) : 0;
              const cardPct = totalCollected > 0 ? Math.round((b.card_paisa / totalCollected) * 100) : 0;

              return (
                <div className="space-y-4">
                  {/* Visual Channel Share Bar */}
                  {totalCollected > 0 && (
                    <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
                      <div style={{ width: `${cashPct}%` }} className="bg-emerald-600" title={`Cash: ${cashPct}%`} />
                      <div style={{ width: `${bkashPct}%` }} className="bg-pink-600" title={`bKash: ${bkashPct}%`} />
                      <div style={{ width: `${nagadPct}%` }} className="bg-orange-600" title={`Nagad: ${nagadPct}%`} />
                      <div style={{ width: `${cardPct}%` }} className="bg-azure-mist-600" title={`Card: ${cardPct}%`} />
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
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
                title={formatCompactUnits(stockValuation.total_stock_units, 'en').full}
              >
                {formatCompactUnits(stockValuation.total_stock_units, 'en').compact}
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
