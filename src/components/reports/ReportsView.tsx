import React, { useState, useEffect } from 'react';
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
  ShieldAlert,
} from 'lucide-react';

interface ReportsViewProps {
  currentSession: UserSession | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentSession }) => {
  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'profit' | 'best_selling' | 'valuation'>('sales');

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState<string>(monthStartStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [salesReport, setSalesReport] = useState<SalesReportData | null>(null);
  const [profitReport, setProfitReport] = useState<ProfitReportData | null>(null);
  const [bestSelling, setBestSelling] = useState<BestSellingProduct[]>([]);
  const [stockValuation, setStockValuation] = useState<StockValuationData | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentSession?.role === 'owner';

  const fetchCurrentTabReport = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      if (activeSubTab === 'sales') {
        const data = await window.api.reports.getSalesReport({ startDate, endDate });
        setSalesReport(data);
      } else if (activeSubTab === 'profit') {
        if (!isOwner) {
          setError('Profit & Loss reports require Owner credentials.');
          setLoading(false);
          return;
        }
        const data = await window.api.reports.getProfitReport({ startDate, endDate });
        setProfitReport(data);
      } else if (activeSubTab === 'best_selling') {
        const data = await window.api.reports.getBestSelling(20);
        setBestSelling(data);
      } else if (activeSubTab === 'valuation') {
        if (!isOwner) {
          setError('Stock Valuation requires Owner credentials.');
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
    fetchCurrentTabReport();
  }, [activeSubTab, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  // Helper for rendering responsive SVG Sales Bar Chart
  const renderSalesChart = (trends: { date: string; sales_paisa: number; orders_count: number }[]) => {
    if (!trends || trends.length === 0) return null;
    const maxSales = Math.max(...trends.map((t) => t.sales_paisa / 100), 1000);
    const chartHeight = 160;

    return (
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-5 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-jungle-teal-900 font-mono">
              Daily Sales Trend Visual (৳)
            </h3>
            <p className="text-[11px] text-jungle-teal-500 font-sans">Visual revenue trajectory over selected dates</p>
          </div>
          <span className="text-[11px] font-mono font-bold text-azure-mist-800 bg-azure-mist-50 border border-azure-mist-200 px-2.5 py-1 rounded-lg">
            Peak: ৳ {maxSales.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="relative pt-6 pb-2">
          <div className="flex items-end gap-2 h-44 border-b border-jungle-teal-200 pb-2 px-2 overflow-x-auto">
            {trends.map((t) => {
              const amountTaka = t.sales_paisa / 100;
              const heightPercent = Math.max((amountTaka / maxSales) * 100, 4);
              const label = t.date.slice(5); // MM-DD

              return (
                <div key={t.date} className="flex-1 min-w-[36px] flex flex-col items-center group relative">
                  {/* Tooltip on hover */}
                  <div className="absolute -top-10 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                    <div className="bg-jungle-teal-900 text-white text-[10px] font-mono py-1 px-2 rounded-lg shadow-lg whitespace-nowrap">
                      <div>{t.date}</div>
                      <div className="font-bold text-muted-teal-400">৳ {amountTaka.toFixed(2)} ({t.orders_count} orders)</div>
                    </div>
                    <div className="w-2 h-2 bg-jungle-teal-900 transform rotate-45 -mt-1" />
                  </div>

                  {/* Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full max-w-[28px] bg-linear-to-t from-azure-mist-700 to-azure-mist-400 hover:from-azure-mist-600 hover:to-muted-teal-400 rounded-t-md transition-all duration-300 shadow-xs relative group-hover:scale-y-105 origin-bottom"
                  />

                  {/* Date label */}
                  <span className="text-[10px] font-mono text-jungle-teal-500 mt-2 rotate-[-30deg] origin-top-left sm:rotate-0 sm:origin-center truncate">
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
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 text-jungle-teal-900 font-sans pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-jungle-teal-900">Business Intelligence & Reports</h2>
            <p className="text-xs text-jungle-teal-500">Financial statements, sales trends, profit margins, and stock valuation</p>
          </div>
        </div>

        {/* Date Filter & Actions */}
        <div className="flex items-center gap-3 flex-wrap text-xs font-mono">
          <div className="flex items-center gap-2 bg-jungle-teal-50 px-3 py-1.5 rounded-xl border border-jungle-teal-300">
            <Calendar className="w-3.5 h-3.5 text-azure-mist-700" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-jungle-teal-900 focus:outline-hidden text-xs font-semibold"
            />
            <span className="text-jungle-teal-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-jungle-teal-900 focus:outline-hidden text-xs font-semibold"
            />
          </div>

          <button
            onClick={fetchCurrentTabReport}
            className="p-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl border border-jungle-teal-300 transition-colors"
            title="Refresh Report"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 border border-jungle-teal-300 rounded-xl font-bold flex items-center gap-1.5 transition-colors font-sans shadow-xs"
          >
            <Printer className="w-3.5 h-3.5 text-azure-mist-700" />
            Print Report
          </button>
        </div>
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex items-center gap-2 bg-jungle-teal-50 border border-jungle-teal-200 p-1.5 rounded-xl text-xs font-semibold shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('sales')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'sales'
              ? 'bg-azure-mist-700 text-white font-bold shadow-xs'
              : 'text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Sales Summary
        </button>

        <button
          onClick={() => setActiveSubTab('profit')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'profit'
              ? 'bg-muted-teal-700 text-white font-bold shadow-xs'
              : 'text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-50'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Profit & Margin (P&L)
          {!isOwner && <Lock className="w-3 h-3 text-jungle-teal-400 ml-1" />}
        </button>

        <button
          onClick={() => setActiveSubTab('best_selling')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'best_selling'
              ? 'bg-frozen-water-700 text-white font-bold shadow-xs'
              : 'text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Best Selling Parts
        </button>

        <button
          onClick={() => setActiveSubTab('valuation')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all whitespace-nowrap ${
            activeSubTab === 'valuation'
              ? 'bg-amber-600 text-white font-bold shadow-xs'
              : 'text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-50'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Stock Valuation
          {!isOwner && <Lock className="w-3 h-3 text-jungle-teal-400 ml-1" />}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. SALES SUMMARY SUB-TAB */}
      {activeSubTab === 'sales' && salesReport && (
        <div className="space-y-5">
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Gross Sales Revenue</span>
              <span className="text-2xl font-extrabold text-azure-mist-800">
                ৳ {(salesReport.gross_sales_paisa / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-jungle-teal-400 block mt-1">{salesReport.total_orders} Orders</span>
            </div>

            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Discounts Given</span>
              <span className="text-2xl font-extrabold text-amber-600">
                ৳ {(salesReport.discount_paisa / 100).toFixed(2)}
              </span>
            </div>

            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Returns / Refunds</span>
              <span className="text-2xl font-extrabold text-rose-600">
                ৳ {(salesReport.total_refunded_paisa / 100).toFixed(2)}
              </span>
              <span className="text-[10px] text-jungle-teal-400 block mt-1">{salesReport.refunds_count} Refunds</span>
            </div>

            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
              <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Net Sales Realized</span>
              <span className="text-2xl font-extrabold text-muted-teal-800">
                ৳ {(salesReport.net_sales_paisa / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Visual Trend Chart */}
          {renderSalesChart(salesReport.daily_trends)}

          {/* Payment Methods Breakdown */}
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-5 rounded-2xl shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-jungle-teal-900 mb-4 font-mono">
              Collections by Payment Method
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="bg-jungle-teal-50 p-3.5 rounded-xl border border-jungle-teal-200">
                <span className="text-jungle-teal-600 font-sans block mb-1">Cash In Drawer</span>
                <span className="text-lg font-bold text-jungle-teal-900">
                  ৳ {(salesReport.payments_breakdown.cash_paisa / 100).toFixed(2)}
                </span>
              </div>

              <div className="bg-pink-50 p-3.5 rounded-xl border border-pink-200">
                <span className="text-pink-800 font-sans block mb-1">bKash Merchant/Personal</span>
                <span className="text-lg font-bold text-pink-700">
                  ৳ {(salesReport.payments_breakdown.bkash_paisa / 100).toFixed(2)}
                </span>
              </div>

              <div className="bg-orange-50 p-3.5 rounded-xl border border-orange-200">
                <span className="text-orange-800 font-sans block mb-1">Nagad</span>
                <span className="text-lg font-bold text-orange-700">
                  ৳ {(salesReport.payments_breakdown.nagad_paisa / 100).toFixed(2)}
                </span>
              </div>

              <div className="bg-azure-mist-50 p-3.5 rounded-xl border border-azure-mist-200">
                <span className="text-azure-mist-900 font-sans block mb-1">Card / Bank POS</span>
                <span className="text-lg font-bold text-azure-mist-800">
                  ৳ {(salesReport.payments_breakdown.card_paisa / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Trends Table */}
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-3.5 border-b border-jungle-teal-200 bg-jungle-teal-50 flex justify-between items-center text-xs">
              <span className="font-bold text-jungle-teal-800">Daily Trend Breakdown</span>
              <span className="font-mono text-jungle-teal-500">{salesReport.daily_trends.length} days recorded</span>
            </div>
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-mono text-[10px] border-b border-jungle-teal-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3 text-center">Orders Count</th>
                  <th className="p-3 text-right">Daily Sales (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11.5px]">
                {salesReport.daily_trends.map((day) => (
                  <tr key={day.date} className="hover:bg-jungle-teal-50 transition-colors">
                    <td className="p-3 text-jungle-teal-900">{day.date}</td>
                    <td className="p-3 text-center font-bold text-azure-mist-800">{day.orders_count}</td>
                    <td className="p-3 text-right font-bold text-muted-teal-800">
                      ৳ {(day.sales_paisa / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. PROFIT & LOSS SUB-TAB (OWNER ONLY) */}
      {activeSubTab === 'profit' && (
        !isOwner ? (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-12 text-center text-jungle-teal-500 space-y-2 shadow-xs">
            <ShieldAlert className="w-12 h-12 mx-auto text-amber-500" />
            <h3 className="text-base font-bold text-jungle-teal-900">Owner Authorization Required</h3>
            <p className="text-xs text-jungle-teal-500 max-w-sm mx-auto">
              Profit, COGS, and margin analysis are strictly restricted to the Owner role for business security.
            </p>
          </div>
        ) : profitReport && (
          <div className="space-y-5">
            {/* Profit KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Total Revenue</span>
                <span className="text-2xl font-extrabold text-azure-mist-800">
                  ৳ {(profitReport.total_revenue_paisa / 100).toFixed(2)}
                </span>
              </div>

              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Cost of Goods Sold (COGS)</span>
                <span className="text-2xl font-extrabold text-jungle-teal-700">
                  ৳ {(profitReport.total_cogs_paisa / 100).toFixed(2)}
                </span>
              </div>

              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Gross Profit</span>
                <span className="text-2xl font-extrabold text-muted-teal-800">
                  ৳ {(profitReport.gross_profit_paisa / 100).toFixed(2)}
                </span>
              </div>

              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Overall Profit Margin</span>
                <span className="text-2xl font-extrabold text-frozen-water-800">
                  {profitReport.profit_margin_percent}%
                </span>
              </div>
            </div>

            {/* Product Margins Table */}
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-3.5 border-b border-jungle-teal-200 bg-jungle-teal-50 flex justify-between items-center text-xs">
                <span className="font-bold text-jungle-teal-800">Itemized Product Profit Margins</span>
                <span className="font-mono text-jungle-teal-500">{profitReport.product_profits.length} products sold</span>
              </div>
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-mono text-[10px] border-b border-jungle-teal-200">
                  <tr>
                    <th className="p-3">Product Name</th>
                    <th className="p-3 text-center">Qty Sold</th>
                    <th className="p-3 text-right">Revenue (৳)</th>
                    <th className="p-3 text-right">Cost (৳)</th>
                    <th className="p-3 text-right">Profit (৳)</th>
                    <th className="p-3 text-center">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11.5px]">
                  {profitReport.product_profits.map((p) => (
                    <tr key={p.product_id} className="hover:bg-jungle-teal-50 transition-colors">
                      <td className="p-3 font-sans">
                        <div className="font-bold text-jungle-teal-900">{p.product_name}</div>
                        <div className="text-[10px] text-jungle-teal-400 font-mono">{p.barcode}</div>
                      </td>
                      <td className="p-3 text-center font-bold text-azure-mist-800">{p.qty_sold}</td>
                      <td className="p-3 text-right">{(p.revenue_paisa / 100).toFixed(2)}</td>
                      <td className="p-3 text-right text-jungle-teal-500">{(p.cost_paisa / 100).toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-muted-teal-800">
                        ৳ {(p.profit_paisa / 100).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 bg-frozen-water-100 text-frozen-water-900 rounded-sm font-bold">
                          {p.margin_percent}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* 3. BEST SELLING PARTS SUB-TAB */}
      {activeSubTab === 'best_selling' && (
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-3.5 border-b border-jungle-teal-200 bg-jungle-teal-50 flex justify-between items-center text-xs">
            <span className="font-bold text-jungle-teal-800">Top 20 Best-Selling Parts by Volume</span>
            <span className="font-mono text-jungle-teal-500">{bestSelling.length} items listed</span>
          </div>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-mono text-[10px] border-b border-jungle-teal-200">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Product Name</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-center">Units Sold</th>
                <th className="p-3 text-right">Total Revenue (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11.5px]">
              {bestSelling.map((p, idx) => {
                const maxVol = Math.max(...bestSelling.map((b) => b.qty_sold), 1);
                const percent = Math.round((p.qty_sold / maxVol) * 100);

                return (
                  <tr key={p.product_id} className="hover:bg-jungle-teal-50 transition-colors">
                    <td className="p-3 font-bold text-jungle-teal-400">#{idx + 1}</td>
                    <td className="p-3 font-sans">
                      <div className="font-bold text-jungle-teal-900">{p.product_name}</div>
                      <div className="text-[10px] text-jungle-teal-400 font-mono">{p.barcode}</div>
                    </td>
                    <td className="p-3 font-sans text-jungle-teal-600">{p.category_name || '-'}</td>
                    <td className="p-3 text-center">
                      <div className="font-bold text-azure-mist-800 text-sm">{p.qty_sold}</div>
                      <div className="w-20 mx-auto bg-jungle-teal-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div style={{ width: `${percent}%` }} className="bg-azure-mist-600 h-full rounded-full" />
                      </div>
                    </td>
                    <td className="p-3 text-right font-bold text-muted-teal-800 text-sm">
                      ৳ {(p.revenue_paisa / 100).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. STOCK VALUATION SUB-TAB (OWNER ONLY) */}
      {activeSubTab === 'valuation' && (
        !isOwner ? (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-12 text-center text-jungle-teal-500 space-y-2 shadow-xs">
            <ShieldAlert className="w-12 h-12 mx-auto text-amber-500" />
            <h3 className="text-base font-bold text-jungle-teal-900">Owner Authorization Required</h3>
            <p className="text-xs text-jungle-teal-500 max-w-sm mx-auto">
              Cost valuation of entire inventory requires Owner privileges.
            </p>
          </div>
        ) : stockValuation && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 font-mono">
              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Total Stocked Units</span>
                <span className="text-2xl font-extrabold text-azure-mist-800">
                  {stockValuation.total_stock_units}
                </span>
                <span className="text-[10px] text-jungle-teal-400 block mt-1">{stockValuation.total_products_count} Unique SKUs</span>
              </div>

              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Total Cost Valuation</span>
                <span className="text-2xl font-extrabold text-jungle-teal-700">
                  ৳ {(stockValuation.total_cost_valuation_paisa / 100).toFixed(2)}
                </span>
                <span className="text-[10px] text-jungle-teal-400 block mt-1">Capital invested</span>
              </div>

              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Total Retail Valuation</span>
                <span className="text-2xl font-extrabold text-muted-teal-800">
                  ৳ {(stockValuation.total_retail_valuation_paisa / 100).toFixed(2)}
                </span>
                <span className="text-[10px] text-jungle-teal-400 block mt-1">Potential gross return</span>
              </div>

              <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
                <span className="text-[11px] text-jungle-teal-500 font-sans block mb-1">Unrealized Gross Margin</span>
                <span className="text-2xl font-extrabold text-frozen-water-800">
                  {stockValuation.potential_margin_percent}%
                </span>
                <span className="text-[10px] text-muted-teal-800 block mt-1">
                  ৳ {(stockValuation.potential_gross_profit_paisa / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
