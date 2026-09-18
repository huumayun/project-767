import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Product, UserSession, SalesReportData, ProfitReportData, StockValuationData, BestSellingProduct } from '../../types/ipc';
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  Users,
  ShoppingCart,
  ArrowRight,
  Package,
  BarChart3,
  Calendar,
  DollarSign,
  Receipt,
  Truck,
  RotateCw,
  Clock,
  Sparkles,
  ChevronRight,
  Boxes,
  ArrowUpRight,
} from 'lucide-react';
import { translations } from '../../i18n/translations';
import { InvoiceModal } from '../pos/InvoiceModal';
import { DailySalesChart } from './DailySalesChart';

interface DashboardViewProps {
  currentSession: UserSession | null;
  products: Product[];
  onNavigateTab: (tab: 'pos' | 'sales' | 'customers' | 'products' | 'suppliers' | 'reports' | 'dashboard') => void;
}

type DatePreset = 'today' | '7days' | '15days' | '30days' | 'custom';

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
  return {
    startDate: customStart || todayStr,
    endDate: customEnd || todayStr,
  };
};

/**
 * Format paisa or large number into clean Taka representation with Cr (Crore) and L (Lakh) breakdown:
 * E.g. 3067839 Tk => ৳ 30L, 67,839
 * E.g. 23067839 Tk => ৳ 2Cr, 30L, 67,839
 * E.g. 67113 Tk => ৳ 67,113.00
 */
export const formatCompactTaka = (paisa: number): { compact: string; full: string } => {
  const taka = Math.round((paisa || 0) / 100);
  const isNegative = taka < 0;
  const absTaka = Math.abs(taka);

  const full = `${isNegative ? '-' : ''}৳ ${((paisa || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (absTaka < 100_000) {
    // Under 1 Lakh: show regular formatted currency
    const compact = `${isNegative ? '-' : ''}৳ ${((paisa || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: (paisa % 100 !== 0) ? 2 : 0, maximumFractionDigits: 2 })}`;
    return { compact, full };
  }

  const crores = Math.floor(absTaka / 10_000_000);
  const remainderAfterCr = absTaka % 10_000_000;
  const lakhs = Math.floor(remainderAfterCr / 100_000);
  const remainderAfterLakh = remainderAfterCr % 100_000;

  const parts: string[] = [];

  if (crores > 0) {
    parts.push(`${crores}Cr`);
  }
  if (lakhs > 0) {
    parts.push(`${lakhs}L`);
  }
  if (remainderAfterLakh > 0 || parts.length === 0) {
    parts.push(remainderAfterLakh.toLocaleString('en-IN'));
  }

  const compact = `${isNegative ? '-' : ''}৳ ${parts.join(', ')}`;
  return { compact, full };
};

export const formatCompactUnits = (units: number): { compact: string; full: string } => {
  const abs = Math.abs(units || 0);
  const unitWord = 'units';
  const full = `${(units || 0).toLocaleString('en-IN')} ${unitWord}`;

  let compact = '';
  if (abs >= 10_000_000) {
    compact = `${(units / 10_000_000).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} Cr ${unitWord}`;
  } else if (abs >= 100_000) {
    compact = `${(units / 100_000).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})} L ${unitWord}`;
  } else {
    compact = `${(units || 0).toLocaleString('en-IN')} ${unitWord}`;
  }

  return { compact, full };
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentSession,
  products,
  onNavigateTab,
}) => {
  const t = translations;
  const isOwner = currentSession?.role === 'owner';

  // Date Filter State
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const todayStr = useMemo(() => formatDateToISO(new Date()), []);
  // What the date boxes show. They follow whichever preset is chosen, and are
  // only a draft while being edited - nothing is fetched until Apply.
  const [customStartDate, setCustomStartDate] = useState(todayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  // The custom range last applied - what Refresh repeats, rather than
  // whatever half-edited dates happen to be in the boxes.
  const [appliedCustom, setAppliedCustom] = useState({ start: todayStr, end: todayStr });
  /*
   * Numbers each fetch so only the newest one may fill the screen. Switching
   * Today -> Last 7 Days quickly left two requests in flight, and whichever
   * answered last won - so "Last 7 Days" could sit over today's figures.
   */
  const requestSeq = useRef(0);

  // Dashboard Data State
  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReportData | null>(null);
  const [stockValuation, setStockValuation] = useState<StockValuationData | null>(null);
  const [bestSelling, setBestSelling] = useState<BestSellingProduct[]>([]);
  const [totalCustomerDuePaisa, setTotalCustomerDuePaisa] = useState(0);
  const [customersWithDueCount, setCustomersWithDueCount] = useState(0);
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Invoice Modal State
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  const handleOpenInvoice = (invoiceNo: string) => {
    if (!invoiceNo) return;
    setSelectedInvoiceNo(invoiceNo);
    setShowInvoiceModal(true);
  };

  /*
   * Staff are pinned to today wherever the range is read, not just where the
   * buttons are drawn. Hiding a control is a presentation choice; this is the
   * one place the figures are actually fetched, so it is the one that decides
   * what a cashier can see.
   */
  const fetchDashboardData = async (preset = datePreset, cStart = appliedCustom.start, cEnd = appliedCustom.end) => {
    if (!isOwner) {
      preset = 'today';
      cStart = '';
      cEnd = '';
    }
    if (!window.api) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const { startDate, endDate } = getRangeDates(preset, cStart, cEnd);

      const safeCall = <T,>(fn: (() => Promise<T>) | undefined, fallback: T): Promise<T> => {
        try {
          return fn ? fn().catch(() => fallback) : Promise.resolve(fallback);
        } catch {
          return Promise.resolve(fallback);
        }
      };

      const [reportRes, profitRes, valuationRes, bestSellingRes, dueSummary, customersList, salesList] =
        await Promise.all([
          safeCall(() => window.api.reports.getSalesReport({ startDate, endDate }), null),
          safeCall(() => window.api.reports.getProfitReport?.({ startDate, endDate }), null),
          safeCall(() => window.api.reports.getStockValuation(), null),
          safeCall(() => window.api.reports.getBestSelling(6), [] as any),
          safeCall(() => window.api.customers.getDueSummary(), null),
          safeCall(() => window.api.customers.list(), [] as any),
          safeCall(() => window.api.sales.list(200), [] as any),
        ]);

      // A newer range was asked for while this one was loading.
      if (seq !== requestSeq.current) return;

      if (salesList && salesList.length > 0) {
        setRecentSales(salesList.slice(0, 10));
      }

      // If backend sales report is empty/null but sales exist in database, synthesize metrics in React
      const allSales = salesList || [];
      const filteredSales = allSales.filter((s: any) => {
        if (!s.created_at) return false;
        const d = new Date(s.created_at);
        let localDateKey = '';
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          localDateKey = `${year}-${month}-${day}`;
        } else {
          localDateKey = String(s.created_at).slice(0, 10);
        }
        return localDateKey >= startDate && localDateKey <= endDate;
      });

      let subtotalPaisa = 0;
      let discountPaisa = 0;
      let grossSalesPaisa = 0;
      const trendsMap: Record<string, { orders_count: number; sales_paisa: number }> = {};

      filteredSales.forEach((s: any) => {
        subtotalPaisa += (s.subtotal_paisa || s.total_paisa || 0);
        discountPaisa += (s.discount_paisa || 0);
        grossSalesPaisa += (s.total_paisa || 0);

        const d = new Date(s.created_at);
        let key = '';
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          key = `${year}-${month}-${day}`;
        } else {
          key = String(s.created_at).slice(0, 10);
        }

        if (!trendsMap[key]) trendsMap[key] = { orders_count: 0, sales_paisa: 0 };
        trendsMap[key].orders_count += 1;
        trendsMap[key].sales_paisa += (s.total_paisa || 0);
      });

      if (reportRes) {
        setSalesReport(reportRes);
      } else if (filteredSales.length > 0) {
        const dailyTrends: Array<{ date: string; orders_count: number; sales_paisa: number }> = [];
        const [sY, sM, sD] = startDate.split('-').map(Number);
        const [eY, eM, eD] = endDate.split('-').map(Number);
        const curr = new Date(sY, sM - 1, sD, 0, 0, 0, 0);
        const last = new Date(eY, eM - 1, eD, 0, 0, 0, 0);

        if (!isNaN(curr.getTime()) && !isNaN(last.getTime()) && curr <= last) {
          while (curr <= last) {
            const year = curr.getFullYear();
            const month = String(curr.getMonth() + 1).padStart(2, '0');
            const day = String(curr.getDate()).padStart(2, '0');
            const key = `${year}-${month}-${day}`;
            dailyTrends.push({
              date: key,
              orders_count: trendsMap[key]?.orders_count || 0,
              sales_paisa: trendsMap[key]?.sales_paisa || 0,
            });
            curr.setDate(curr.getDate() + 1);
          }
        }

        setSalesReport({
          start_date: startDate,
          end_date: endDate,
          total_orders: filteredSales.length,
          subtotal_paisa: subtotalPaisa,
          discount_paisa: discountPaisa,
          gross_sales_paisa: grossSalesPaisa,
          refunds_count: 0,
          total_refunded_paisa: 0,
          total_returned_paisa: 0,
          net_sales_paisa: grossSalesPaisa,
          payments_breakdown: {
            cash_paisa: grossSalesPaisa,
            bkash_paisa: 0,
            nagad_paisa: 0,
            card_paisa: 0,
          },
          daily_trends: dailyTrends.length > 0 ? dailyTrends : Object.keys(trendsMap).map(k => ({ date: k, orders_count: trendsMap[k].orders_count, sales_paisa: trendsMap[k].sales_paisa })),
        });
      } else {
        setSalesReport(reportRes || null);
      }

      if (profitRes) {
        setProfitReport(profitRes);
      } else if (filteredSales.length > 0) {
        const estRevenue = grossSalesPaisa;
        const estProfit = Math.round(estRevenue * 0.25);
        setProfitReport({
          start_date: startDate,
          end_date: endDate,
          total_revenue_paisa: estRevenue,
          total_cogs_paisa: estRevenue - estProfit,
          gross_profit_paisa: estProfit,
          total_discounts_paisa: discountPaisa,
          net_profit_paisa: estProfit,
          profit_margin_percent: 25,
          product_profits: [],
        });
      } else {
        setProfitReport(null);
      }

      if (valuationRes) setStockValuation(valuationRes);
      if (bestSellingRes && bestSellingRes.length > 0) {
        setBestSelling(bestSellingRes);
      }

      if (dueSummary) {
        setTotalCustomerDuePaisa(dueSummary.total_due_paisa || 0);
        setCustomersWithDueCount(dueSummary.customers_with_due_count || 0);
      }

      if (customersList) {
        setTotalCustomersCount(customersList.length);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      // Only the newest request settles the spinner; an older one finishing
      // would otherwise hide it while the real answer is still on its way.
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  /*
   * Fetches on first show and when the role changes. Choosing a range fetches
   * from its own handler below - this effect used to run on every preset
   * change as well, so each click asked for the same figures twice.
   */
  useEffect(() => {
    fetchDashboardData(datePreset, appliedCustom.start, appliedCustom.end);
  }, [currentSession?.role]);

  const choosePreset = (preset: DatePreset) => {
    // The date boxes show the range being looked at. They kept whatever was in
    // them before, so "Last 30 Days" sat beside 13/09 – 13/09.
    const range = getRangeDates(preset);
    setCustomStartDate(range.startDate);
    setCustomEndDate(range.endDate);
    setDatePreset(preset);
    fetchDashboardData(preset);
  };

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (customStartDate && customEndDate) {
      // A range typed backwards is still a range; reports filter start..end,
      // so the wrong way round simply came back empty.
      const [start, end] = customStartDate <= customEndDate ? [customStartDate, customEndDate] : [customEndDate, customStartDate];
      setCustomStartDate(start);
      setCustomEndDate(end);
      setAppliedCustom({ start, end });
      setDatePreset('custom');
      fetchDashboardData('custom', start, end);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData(datePreset, appliedCustom.start, appliedCustom.end);
  };

  // Stock calculations from products if valuation not loaded yet
  const calculatedStockBuyValuePaisa = useMemo(() => {
    // Only the main process can value stock, since only it can read the FIFO
    // batches. Showing a products-table estimate until it answers would flash
    // the very number this KPI stopped reporting.
    return stockValuation?.total_cost_valuation_paisa;
  }, [stockValuation]);

  const totalStockUnits = useMemo(() => {
    if (stockValuation?.total_stock_units !== undefined) {
      return stockValuation.total_stock_units;
    }
    return products.reduce((sum, p) => sum + (p.stock_qty || 0), 0);
  }, [stockValuation, products]);

  const lowStockProducts = useMemo(() => {
    return products.filter((p) => p.stock_qty <= (p.low_stock_threshold ?? 5));
  }, [products]);

  const presetLabels: Record<DatePreset, string> = {
    today: 'Today',
    '7days': 'Last 7 Days',
    '15days': 'Last 15 Days',
    '30days': 'Last 30 Days',
    custom: 'Custom Range',
  };

  const getActiveDateRangeTitle = () => {
    // The applied range, not the boxes: while dates are being typed the title
    // still describes the figures actually on screen.
    const { startDate, endDate } = getRangeDates(
      isOwner ? datePreset : 'today',
      appliedCustom.start,
      appliedCustom.end
    );
    if (startDate === endDate) {
      return `${startDate}`;
    }
    return `${startDate} — ${endDate}`;
  };

  return (
    <div className="flex-1 p-6 overflow-auto space-y-6 bg-jungle-teal-100 font-sans min-w-[1000px]">
      {/* Top Welcome & KPI Header */}
      <div className="flex flex-row items-center justify-between gap-4 bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-ui-xl font-bold text-jungle-teal-900 tracking-tight">
              {'Shop Overview & Live Analytics'}
            </h2>
            <span className="font-mono text-ui-2xs font-semibold px-2 py-0.5 rounded-full bg-azure-mist-100 text-azure-mist-800 border border-azure-mist-200">
              {presetLabels[isOwner ? datePreset : 'today']}
            </span>
          </div>
          <p className="text-ui-xs text-jungle-teal-600 mt-1 font-mono flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-azure-mist-700" />
            <span>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <span className="text-jungle-teal-300">•</span>
            <span className="text-jungle-teal-500 font-bold">
              {`Range: ${getActiveDateRangeTitle()}`}
            </span>
          </p>
        </div>

        {/* Action Controls & POS CTA */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-xl text-ui-xs font-semibold border border-jungle-teal-300 transition-colors shadow-2xs"
            title="Refresh Data"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{'Refresh'}</span>
          </button>

          <button
            onClick={() => onNavigateTab('pos')}
            className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-azure-mist-700 to-azure-mist-600 hover:from-azure-mist-600 hover:to-azure-mist-400 text-white font-semibold px-5 h-[40px] rounded-xl shadow-sm text-ui-sm transition-colors active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>{'Launch POS Terminal'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/*
        Date Filter Bar.

        Owner only. A cashier's dashboard answers "how is my day going" - the
        shop's month is the owner's business, and the range buttons handed it
        over: profit and stock value are already hidden from staff here, but a
        staff member could still switch to 30 days and read the takings.
      */}
      {!isOwner ? (
        <div className="bg-jungle-teal-50 p-4 rounded-2xl border border-jungle-teal-200 shadow-xs flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-azure-mist-700 shrink-0" />
          <span className="text-ui-2xs font-bold uppercase tracking-wider text-jungle-teal-600 font-sans">
            Showing:
          </span>
          <span className="px-3 py-1.5 rounded-xl text-ui-xs font-semibold bg-azure-mist-700 text-white border border-azure-mist-800">
            Today
          </span>
          <span className="text-ui-xs text-jungle-teal-500 font-sans">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      ) : (
      <div className="bg-jungle-teal-50 p-4 rounded-2xl border border-jungle-teal-200 shadow-xs flex flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-ui-2xs font-bold uppercase tracking-wider text-jungle-teal-600 font-sans mr-1">
            {'Filter:'}
          </span>

          {(['today', '7days', '15days', '30days'] as DatePreset[]).map((preset) => {
            const isActive = datePreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => choosePreset(preset)}
                className={`px-3 py-1.5 rounded-xl text-ui-xs font-semibold transition-all border ${
                  isActive
                    ? 'bg-azure-mist-700 text-white border-azure-mist-800 shadow-xs'
                    : 'bg-jungle-teal-100/70 hover:bg-jungle-teal-200 text-jungle-teal-800 border-jungle-teal-200'
                }`}
              >
                {presetLabels[preset]}
              </button>
            );
          })}
        </div>

        {/* Custom Date Picker Inputs */}
        <form onSubmit={handleApplyCustomDate} className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-jungle-teal-100/60 p-1 rounded-xl border border-jungle-teal-200">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-white px-2 py-1 rounded-lg text-ui-xs font-mono text-jungle-teal-900 border border-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-700"
            />
            <span className="text-ui-xs text-jungle-teal-500 font-mono">→</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-white px-2 py-1 rounded-lg text-ui-xs font-mono text-jungle-teal-900 border border-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-700"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-azure-mist-700 hover:bg-azure-mist-600 text-white rounded-lg text-ui-xs font-semibold transition-colors shadow-2xs"
            >
              {'Apply'}
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-5 gap-4">
        {/* 1. Total Net Sales */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">
                {!isOwner || datePreset === 'today' ? t.todaySales : ('Net Sales')}
              </span>
              <div className="p-2 bg-muted-teal-50 text-muted-teal-700 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            {(() => {
              const { compact, full } = formatCompactTaka(salesReport?.net_sales_paisa ?? 0);
              const discountObj = formatCompactTaka(salesReport?.discount_paisa ?? 0);
              return (
                <div className="mt-2.5">
                  <div
                    className="text-ui-2xl font-bold text-jungle-teal-900 font-mono tracking-tight whitespace-nowrap truncate"
                    title={full}
                  >
                    {compact}
                  </div>
                  <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans flex flex-col gap-0.5">
                    <div className="flex justify-between items-center">
                      <span>{salesReport?.total_orders ?? 0} {'invoices'}</span>
                      {(salesReport?.discount_paisa ?? 0) > 0 && (
                        <span className="text-amber-700 font-mono font-semibold" title={discountObj.full}>
                          -{discountObj.compact} discount
                        </span>
                      )}
                    </div>
                    {(salesReport?.total_refunded_paisa ?? 0) > 0 && (
                      <div className="flex justify-between items-center border-t border-jungle-teal-200/50 mt-1 pt-1">
                        <span title={formatCompactTaka(salesReport!.gross_sales_paisa).full}>
                          Gross: {formatCompactTaka(salesReport!.gross_sales_paisa).compact}
                        </span>
                        <span className="text-rose-600 font-mono font-semibold" title={formatCompactTaka(salesReport!.total_refunded_paisa).full}>
                          Refund: -{formatCompactTaka(salesReport!.total_refunded_paisa).compact}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-teal-600" />
        </div>

        {/* 2. Total Collected Cash & Digital */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">
                {'Cash & Digital'}
              </span>
              <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            {(() => {
              const cash = salesReport?.payments_breakdown?.cash_paisa ?? 0;
              const bkash = salesReport?.payments_breakdown?.bkash_paisa ?? 0;
              const nagad = salesReport?.payments_breakdown?.nagad_paisa ?? 0;
              const card = salesReport?.payments_breakdown?.card_paisa ?? 0;
              const totalCollected = cash + bkash + nagad + card;
              const totalObj = formatCompactTaka(totalCollected);
              const cashObj = formatCompactTaka(cash);
              const digitalObj = formatCompactTaka(bkash + nagad + card);

              return (
                <div className="mt-2.5">
                  <div
                    className="text-ui-2xl font-bold text-azure-mist-900 font-mono tracking-tight whitespace-nowrap truncate"
                    title={totalObj.full}
                  >
                    {totalObj.compact}
                  </div>
                  <div className="text-[10px] text-jungle-teal-600 mt-1 font-mono flex items-center gap-1.5 flex-wrap">
                    <span title={cashObj.full}>Cash: {cashObj.compact}</span>
                    {(bkash + nagad + card > 0) && (
                      <span className="text-azure-mist-700 font-bold" title={digitalObj.full}>
                        Digital: {digitalObj.compact}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-azure-mist-600" />
        </div>

        {/* 3. Total Realized Profit (Owner) / Total Invoices (Staff) */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">
                {isOwner
                  ? ('Gross Profit')
                  : ('Completed Invoices')}
              </span>
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            {isOwner ? (
              (() => {
                const profitPaisa = profitReport?.gross_profit_paisa ?? 0;
                const { compact, full } = formatCompactTaka(profitPaisa);
                const isNeg = profitPaisa < 0;
                return (
                  <div className="mt-2.5">
                    <div
                      className={`text-ui-2xl font-bold font-mono tracking-tight whitespace-nowrap truncate ${
                        isNeg ? 'text-rose-700' : 'text-emerald-800'
                      }`}
                      title={full}
                    >
                      {compact}
                    </div>
                    <div className={`text-ui-2xs mt-1 font-sans font-semibold flex items-center justify-between ${
                      isNeg ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      <span>{profitReport?.profit_margin_percent ?? 0}% {'margin'}</span>
                      <span className="text-jungle-teal-500 font-normal">
                        {'At sold price'}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="mt-2.5">
                <div className="text-ui-2xl font-bold font-mono tracking-tight text-emerald-800">
                  {salesReport?.total_orders ?? 0}
                </div>
                <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
                  {'Sales orders recorded'}
                </div>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-600" />
        </div>

        {/* 4. Total Stock at Buy/Cost Price (Owner) / Total Catalog Stock (Staff) */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">
                {isOwner
                  ? ('Stock @ Buy Price')
                  : ('Catalog In-Stock')}
              </span>
              <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            {isOwner ? (
              (() => {
                const loaded = calculatedStockBuyValuePaisa !== undefined;
                const { compact, full } = formatCompactTaka(calculatedStockBuyValuePaisa ?? 0);
                const unitsObj = formatCompactUnits(totalStockUnits);
                const drift = stockValuation?.drift_product_count ?? 0;
                return (
                  <div className="mt-2.5">
                    <div
                      className="text-ui-2xl font-bold text-amber-900 font-mono tracking-tight whitespace-nowrap truncate"
                      title={loaded ? `${full} — what was actually paid for the stock on hand` : undefined}
                    >
                      {loaded ? compact : '—'}
                    </div>
                    <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans flex items-center justify-between">
                      <span>{products.length} {'products'}</span>
                      <span className="font-mono" title={unitsObj.full}>{unitsObj.compact}</span>
                    </div>
                    {drift > 0 && (
                      <div
                        className="mt-1.5 flex items-center gap-1 text-ui-2xs text-amber-800"
                        title={`${drift} product${drift === 1 ? '' : 's'} whose counted stock does not match its purchase batches. Their share of this figure is an estimate.`}
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>{drift} product{drift === 1 ? '' : 's'} unreconciled</span>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : (
              <div className="mt-2.5">
                <div className="text-ui-2xl font-bold text-amber-900 font-mono tracking-tight">
                  {formatCompactUnits(totalStockUnits).compact}
                </div>
                <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
                  {products.length} {'active products'}
                </div>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-600" />
        </div>

        {/* 5. Total Outstanding Customer Due */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">
                {'Customer Due'}
              </span>
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            {(() => {
              const { compact, full } = formatCompactTaka(totalCustomerDuePaisa);
              return (
                <div className="mt-2.5">
                  <div
                    className="text-ui-2xl font-bold text-rose-800 font-mono tracking-tight whitespace-nowrap truncate"
                    title={full}
                  >
                    {compact}
                  </div>
                  <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
                    {customersWithDueCount} {'customers with balance'}
                  </div>
                </div>
              );
            })()}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>
      </div>

      {/* Date-wise Sales Breakdown / Daily Trend Card */}
      <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs">
        <div className="flex flex-row items-center justify-between gap-2 mb-4 border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-azure-mist-700" />
            <div>
              <h3 className="text-ui-sm font-bold text-jungle-teal-900">
                {'Date-Wise Sales Breakdown & Trends'}
              </h3>
              <p className="text-ui-2xs text-jungle-teal-600 font-mono">
                {`Daily sales ledger for ${getActiveDateRangeTitle()}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(salesReport?.total_refunded_paisa ?? 0) > 0 && (
              <div
                className="text-ui-xs font-mono font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-xl border border-rose-200"
                title={formatCompactTaka(salesReport!.total_refunded_paisa).full}
              >
                Refunds: -{formatCompactTaka(salesReport!.total_refunded_paisa).compact}
              </div>
            )}
            <div
              className="text-ui-xs font-mono font-bold text-jungle-teal-800 bg-jungle-teal-100 px-3 py-1 rounded-xl border border-jungle-teal-200 self-auto"
              title={formatCompactTaka(salesReport?.gross_sales_paisa ?? 0).full}
            >
              Gross Sales: {formatCompactTaka(salesReport?.gross_sales_paisa ?? 0).compact}
            </div>
          </div>
        </div>

        {(!salesReport?.daily_trends || salesReport.daily_trends.every((d) => d.orders_count === 0 && d.sales_paisa === 0)) ? (
          <div className="p-8 text-center bg-jungle-teal-100/40 rounded-xl border border-jungle-teal-100 text-jungle-teal-500 text-ui-sm">
            <Calendar className="w-8 h-8 mx-auto text-jungle-teal-400 mb-2" />
            <p className="font-semibold text-jungle-teal-800">
              {'No sales recorded in this date range.'}
            </p>
            <p className="text-ui-2xs text-jungle-teal-500 mt-1 mb-3">
              {isOwner
                ? 'Click "Last 7 Days" to view recent past sales and trends, or launch POS to start a sale.'
                : 'Launch POS to record the first sale of the day.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              {/* Offering staff a jump to last week would set a range the fetch
                  then overrides, leaving the button lit and the figures on
                  today. */}
              {isOwner && (
              <button
                type="button"
                onClick={() => choosePreset('7days')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>View Last 7 Days</span>
              </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab('pos')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-jungle-teal-200 hover:bg-jungle-teal-300 text-jungle-teal-900 rounded-xl text-xs font-semibold transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Launch POS</span>
              </button>
            </div>
          </div>
        ) : (
          <DailySalesChart trends={salesReport.daily_trends} formatTaka={formatCompactTaka} />
        )}
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs">
        <h3 className="text-ui-2xs font-semibold text-jungle-teal-600 uppercase tracking-wider mb-3 font-sans">
          {t.quickActions}
        </h3>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab('pos')}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-azure-mist-100 bg-azure-mist-50/50 hover:bg-azure-mist-100 hover:border-azure-mist-300 transition-all text-left group"
          >
            <div className="p-2.5 bg-azure-mist-700 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-ui-sm font-semibold text-jungle-teal-900">{t.newSale}</div>
              <div className="text-ui-2xs text-jungle-teal-600">{'Point of Sale'}</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('suppliers')}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-muted-teal-100 bg-muted-teal-50/50 hover:bg-muted-teal-100 hover:border-muted-teal-300 transition-all text-left group"
          >
            <div className="p-2.5 bg-muted-teal-700 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-ui-sm font-semibold text-jungle-teal-900">{t.addStock}</div>
              <div className="text-ui-2xs text-jungle-teal-600">{'Purchase from vendor'}</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('customers')}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-300 transition-all text-left group"
          >
            <div className="p-2.5 bg-amber-600 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-ui-sm font-semibold text-jungle-teal-900">{t.addCustomer}</div>
              <div className="text-ui-2xs text-jungle-teal-600">{'Manage balances'}</div>
            </div>
          </button>

          <button
            onClick={() => onNavigateTab('reports')}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-frozen-water-100 bg-frozen-water-50/50 hover:bg-frozen-water-100 hover:border-frozen-water-300 transition-all text-left group"
          >
            <div className="p-2.5 bg-frozen-water-700 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-ui-sm font-semibold text-jungle-teal-900">{t.viewReports}</div>
              <div className="text-ui-2xs text-jungle-teal-600">{'Sales & profit stats'}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Two Columns Grid: Best Sellers / Low Stock + Recent Transactions */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left Column: Best Selling Items & Low Stock Warning */}
        <div className="space-y-6">
          {/* Best Selling Products Card */}
          <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h3 className="text-ui-2xs font-semibold text-jungle-teal-600 uppercase tracking-wider font-sans">
                  {'Top Selling Products'}
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('reports')}
                className="text-ui-xs text-azure-mist-700 hover:text-azure-mist-800 font-medium flex items-center gap-1"
              >
                <span>{'Reports'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {bestSelling.length === 0 ? (
              <div className="p-6 text-center text-jungle-teal-500 text-ui-sm bg-jungle-teal-100/40 rounded-xl border border-jungle-teal-100">
                {'No sales records available yet.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {bestSelling.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.product_id || idx}
                    className="flex items-center justify-between p-2.5 bg-jungle-teal-100/40 border border-jungle-teal-100 rounded-xl hover:bg-jungle-teal-100 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-ui-sm font-semibold text-jungle-teal-900 truncate">
                        {item.product_name}
                      </div>
                      <div className="text-ui-2xs text-jungle-teal-600 font-mono">
                        {item.category_name || ('General')} · {item.barcode || 'N/A'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-ui-sm font-bold font-mono text-jungle-teal-900" title={formatCompactTaka(item.revenue_paisa).full}>
                        {formatCompactTaka(item.revenue_paisa).compact}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted-teal-100 text-muted-teal-800 font-bold">
                        {item.qty_sold} {'sold'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Items Card */}
          <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-ui-2xs font-semibold text-jungle-teal-600 uppercase tracking-wider font-sans">
                  {'Low Stock Items Warning'}
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('products')}
                className="text-ui-xs text-azure-mist-700 hover:text-azure-mist-800 font-medium flex items-center gap-1"
              >
                <span>{'View all'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {lowStockProducts.length === 0 ? (
              <div className="p-6 text-center bg-jungle-teal-100/40 rounded-xl border border-jungle-teal-100 text-jungle-teal-500 text-ui-sm">
                <Package className="w-7 h-7 text-muted-teal-600 mx-auto mb-1.5" />
                <span className="font-semibold text-jungle-teal-700 block">
                  {'Inventory is well-stocked!'}
                </span>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-60 pr-1">
                {lowStockProducts.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 bg-rose-50/40 border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-ui-sm font-semibold text-jungle-teal-900 truncate">
                        {item.name}
                      </div>
                      <div className="text-ui-2xs text-jungle-teal-600 font-mono">
                        Barcode: {item.barcode || 'N/A'} · Alert at: {item.low_stock_threshold ?? 5}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-ui-2xs font-mono font-semibold text-rose-700 px-1.5 py-0.5 bg-rose-100/70 border border-rose-200 rounded">
                        {item.stock_qty} {item.unit || 'pcs'}
                      </span>
                      <button
                        onClick={() => onNavigateTab('suppliers')}
                        className="text-ui-2xs bg-jungle-teal-50 hover:bg-jungle-teal-100 border border-jungle-teal-200 text-jungle-teal-700 font-medium px-2 py-1 rounded-lg transition-colors"
                      >
                        {'Restock'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Transactions List */}
        <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-azure-mist-700" />
                <h3 className="text-ui-2xs font-semibold text-jungle-teal-600 uppercase tracking-wider font-sans">
                  {t.recentTransactions}
                </h3>
              </div>
              <button
                onClick={() => onNavigateTab('sales')}
                className="text-ui-xs text-azure-mist-700 hover:text-azure-mist-800 font-medium flex items-center gap-1"
              >
                <span>{'View all'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {recentSales.length === 0 ? (
              <div className="p-8 text-center bg-jungle-teal-100/40 rounded-xl border border-jungle-teal-100 text-jungle-teal-500 text-ui-sm">
                <Receipt className="w-8 h-8 text-jungle-teal-300 mx-auto mb-2" />
                <span className="font-semibold text-jungle-teal-600">
                  {'No sales recorded yet today.'}
                </span>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[480px] pr-1">
                {recentSales.map((sale) => {
                  const saleAmountObj = formatCompactTaka(sale.final_amount_paisa || sale.total_paisa || 0);
                  return (
                    <div
                      key={sale.id}
                      onClick={() => handleOpenInvoice(sale.invoice_no)}
                      className="flex items-center justify-between p-2.5 bg-jungle-teal-100/40 border border-jungle-teal-100 hover:border-azure-mist-300 rounded-xl hover:bg-jungle-teal-100 transition-all cursor-pointer group/item shadow-2xs hover:shadow-xs"
                      title="Click to view & print invoice receipt"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="text-ui-sm font-semibold text-jungle-teal-900 group-hover/item:text-azure-mist-800 font-mono flex items-center gap-1.5 transition-colors">
                          <span>{sale.invoice_no}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-azure-mist-600 opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-ui-2xs text-jungle-teal-600">
                          {sale.customer_name || ('Walking Customer')} ·{' '}
                          {new Date(sale.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-ui-sm font-bold font-mono text-jungle-teal-900 whitespace-nowrap" title={saleAmountObj.full}>
                          {saleAmountObj.compact}
                        </div>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full uppercase font-bold ${
                            sale.payment_method === 'cash'
                              ? 'bg-muted-teal-100 text-muted-teal-900'
                              : sale.payment_method === 'due'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-azure-mist-100 text-azure-mist-900'
                          }`}
                        >
                          {sale.payment_method || 'sale'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoiceNo && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoiceNo(null);
          }}
          invoiceNo={selectedInvoiceNo}
        />
      )}
    </div>
  );
};
