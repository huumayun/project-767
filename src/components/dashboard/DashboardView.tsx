import React, { useEffect, useState } from 'react';
import { Product, UserSession } from '../../types/ipc';
import {
  TrendingUp,
  Wallet,
  AlertTriangle,
  Users,
  ShoppingCart,
  ArrowRight,
  Package,
  PlusCircle,
  BarChart3,
  Calendar,
  DollarSign,
  Receipt,
  Truck,
} from 'lucide-react';
import { Language, translations } from '../../i18n/translations';

interface DashboardViewProps {
  currentSession: UserSession | null;
  products: Product[];
  onNavigateTab: (tab: 'pos' | 'sales' | 'customers' | 'products' | 'suppliers' | 'reports' | 'dashboard') => void;
  lang: Language;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentSession,
  products,
  onNavigateTab,
  lang,
}) => {
  const [dailySalesPaisa, setDailySalesPaisa] = useState(0);
  const [dailyCashPaisa, setDailyCashPaisa] = useState(0);
  const [dailyDuePaisa, setDailyDuePaisa] = useState(0);
  const [dailyInvoicesCount, setDailyInvoicesCount] = useState(0);
  const [totalCustomerDuePaisa, setTotalCustomerDuePaisa] = useState(0);
  const [customersWithDueCount, setCustomersWithDueCount] = useState(0);
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const t = translations[lang];

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!window.api) return;
      setLoading(true);
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const [report, dueSummary, customersList, salesList] = await Promise.all([
          window.api.reports.getSalesReport({ startDate: todayStr, endDate: todayStr }).catch(() => null),
          window.api.customers.getDueSummary().catch(() => null),
          window.api.customers.list().catch(() => []),
          window.api.sales.list(6).catch(() => []),
        ]);

        if (report) {
          setDailySalesPaisa(report.net_sales_paisa || report.gross_sales_paisa || 0);
          setDailyCashPaisa(report.payments_breakdown?.cash_paisa || 0);
          const nonCash = (report.payments_breakdown?.bkash_paisa || 0) + (report.payments_breakdown?.nagad_paisa || 0) + (report.payments_breakdown?.card_paisa || 0);
          setDailyDuePaisa(Math.max(0, (report.net_sales_paisa || 0) - (report.payments_breakdown?.cash_paisa || 0) - nonCash));
          setDailyInvoicesCount(report.total_orders || 0);
        }

        if (dueSummary) {
          setTotalCustomerDuePaisa(dueSummary.total_due_paisa || 0);
          setCustomersWithDueCount(dueSummary.customers_with_due_count || 0);
        }

        if (customersList) {
          setTotalCustomersCount(customersList.length);
        }

        if (salesList) {
          setRecentSales(salesList);
        }
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const lowStockProducts = products.filter((p) => p.stock_qty <= (p.low_stock_threshold ?? 5));

  return (
    <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6 bg-jungle-teal-100 font-sans">
      {/* Top Welcome & KPI Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs">
        <div>
          <h2 className="text-ui-xl font-semibold text-jungle-teal-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'bn' ? 'দোকানের ড্যাশবোর্ড ও সংক্ষিপ্ত হিসাব' : 'Shop Overview & Daily Summary'}</span>
          </h2>
          <p className="text-ui-xs text-jungle-teal-600 mt-0.5 font-mono flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-azure-mist-700" />
            <span>
              {new Date().toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        </div>

        {/* Quick Sale CTA */}
        <button
          onClick={() => onNavigateTab('pos')}
          className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-azure-mist-700 to-azure-mist-600 hover:from-azure-mist-600 hover:to-azure-mist-400 text-white font-semibold px-5 h-[40px] rounded-xl shadow-sm text-ui-sm transition-colors active:scale-95"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>{lang === 'bn' ? 'নতুন বিক্রি শুরু করুন (POS)' : 'Launch POS Terminal'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">{t.todaySales}</span>
            <div className="p-2 bg-muted-teal-50 text-muted-teal-700 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-ui-2xl font-semibold text-jungle-teal-900 font-mono">
              ৳ {(dailySalesPaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
              {dailyInvoicesCount} {lang === 'bn' ? 'টি মেমো কাটা হয়েছে' : 'invoices completed'}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-teal-600" />
        </div>

        {/* Cash Collected Today */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">{lang === 'bn' ? 'আজকের নগদ জমা' : 'Cash Collected'}</span>
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-ui-2xl font-semibold text-jungle-teal-900 font-mono">
              ৳ {(dailyCashPaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
              {lang === 'bn' ? 'ক্যাশ বক্সে সরাসরি জমা' : 'Direct cash in register'}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-azure-mist-600" />
        </div>

        {/* Total Outstanding Customer Due */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">{lang === 'bn' ? 'মোট বকেয়া পাওনা' : 'Outstanding Due'}</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-ui-2xl font-semibold text-amber-800 font-mono">
              ৳ {(totalCustomerDuePaisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
              {customersWithDueCount} {lang === 'bn' ? 'জন গ্রাহকের নিকট বাকী' : 'customers with balance'}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* Low Stock Warnings */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans">{t.lowStockAlerts}</span>
            <div
              className={`p-2 rounded-xl ${
                lowStockProducts.length > 0 ? 'bg-rose-50 text-rose-600 animate-pulse' : 'bg-jungle-teal-100 text-jungle-teal-500'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-ui-2xl font-semibold font-mono ${
                lowStockProducts.length > 0 ? 'text-rose-600' : 'text-jungle-teal-900'
              }`}
            >
              {lowStockProducts.length}
            </div>
            <div className="text-ui-2xs text-jungle-teal-600 mt-1 font-sans">
              {lowStockProducts.length > 0
                ? (lang === 'bn' ? 'পণ্য পুনরায় কিনতে হবে' : 'items below alert threshold')
                : (lang === 'bn' ? 'সব পণ্যে পর্যাপ্ত স্টক আছে' : 'All stock levels healthy')}
            </div>
          </div>
          <div
            className={`absolute bottom-0 left-0 right-0 h-1 ${
              lowStockProducts.length > 0 ? 'bg-rose-500' : 'bg-jungle-teal-300'
            }`}
          />
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs">
        <h3 className="text-ui-2xs font-semibold text-jungle-teal-600 uppercase tracking-wider mb-3 font-sans">
          {t.quickActions}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab('pos')}
            className="flex items-center gap-3 p-3.5 rounded-xl border border-azure-mist-100 bg-azure-mist-50/50 hover:bg-azure-mist-100 hover:border-azure-mist-300 transition-all text-left group"
          >
            <div className="p-2.5 bg-azure-mist-700 text-white rounded-xl shadow-xs group-hover:scale-105 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="text-ui-sm font-semibold text-jungle-teal-900">{t.newSale}</div>
              <div className="text-ui-2xs text-jungle-teal-600">{lang === 'bn' ? 'কাউন্টার বিক্রি' : 'Point of Sale'}</div>
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
              <div className="text-ui-2xs text-jungle-teal-600">{lang === 'bn' ? 'মহাজন থেকে কেনা' : 'Purchase from vendor'}</div>
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
              <div className="text-ui-2xs text-jungle-teal-600">{lang === 'bn' ? 'বাকীর হিসাব খাতা' : 'Manage balances'}</div>
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
              <div className="text-ui-2xs text-jungle-teal-600">{lang === 'bn' ? 'লাভ ও বিক্রি হিসাব' : 'Sales & profit stats'}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Low Stock Warning List + Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items Card */}
        <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="text-ui-2xs font-semibold text-jungle-teal-600 uppercase tracking-wider font-sans">
                {lang === 'bn' ? 'স্টক সংকট সতর্কতা' : 'Low Stock Items Warning'}
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('products')}
              className="text-ui-xs text-azure-mist-700 hover:text-azure-mist-800 font-medium flex items-center gap-1"
            >
              <span>{lang === 'bn' ? 'সব পণ্য দেখুন' : 'View all'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-jungle-teal-50 rounded-xl border border-jungle-teal-100 text-jungle-teal-500 text-ui-sm">
              <Package className="w-8 h-8 text-muted-teal-600 mb-2" />
              <span className="font-semibold text-jungle-teal-700">
                {lang === 'bn' ? 'কোনো পণ্য স্টক সংকটে নেই!' : 'Inventory is well-stocked!'}
              </span>
              <span className="text-ui-2xs text-jungle-teal-500 mt-0.5">
                {lang === 'bn' ? 'সব আইটেম নূন্যতম স্টকের উপরে রয়েছে।' : 'All items are above their alert threshold.'}
              </span>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-64 pr-1">
              {lowStockProducts.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-rose-50/40 border border-rose-100 rounded-xl hover:bg-rose-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-ui-sm font-semibold text-jungle-teal-900 truncate">
                      {lang === 'bn' && item.name_bn ? item.name_bn : item.name}
                    </div>
                    <div className="text-ui-2xs text-jungle-teal-600 font-mono">
                      Barcode: {item.barcode || 'N/A'} · Alert at: {item.low_stock_threshold ?? 5}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-ui-2xs font-mono font-semibold text-rose-700 px-1.5 py-px bg-rose-50 border border-rose-200 rounded">
                      {item.stock_qty} {item.unit || 'pcs'} left
                    </span>
                    <button
                      onClick={() => onNavigateTab('suppliers')}
                      className="text-ui-2xs bg-jungle-teal-50 hover:bg-jungle-teal-100 border border-jungle-teal-200 text-jungle-teal-700 font-medium px-2 py-1 rounded-lg transition-colors"
                    >
                      {lang === 'bn' ? 'মাল তুলুন' : 'Restock'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Sales List Card */}
        <div className="bg-jungle-teal-50 p-5 rounded-2xl border border-jungle-teal-200 shadow-xs flex flex-col">
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
              <span>{lang === 'bn' ? 'সব মেমো দেখুন' : 'View all'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {recentSales.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-jungle-teal-50 rounded-xl border border-jungle-teal-100 text-jungle-teal-500 text-ui-sm">
              <Receipt className="w-8 h-8 text-jungle-teal-300 mb-2" />
              <span className="font-semibold text-jungle-teal-600">
                {lang === 'bn' ? 'আজকের কোনো লেনদেন পাওয়া যায়নি।' : 'No sales recorded yet today.'}
              </span>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-64 pr-1">
              {recentSales.map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between p-2.5 bg-jungle-teal-50 border border-jungle-teal-100 rounded-xl hover:bg-jungle-teal-100/80 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-ui-sm font-semibold text-jungle-teal-900 font-mono">{sale.invoice_no}</div>
                    <div className="text-ui-2xs text-jungle-teal-600">
                      {sale.customer_name || (lang === 'bn' ? 'খুচরা গ্রাহক' : 'Walking Customer')} ·{' '}
                      {new Date(sale.created_at).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-ui-sm font-semibold font-mono text-jungle-teal-900">
                      ৳ {((sale.final_amount_paisa || 0) / 100).toFixed(2)}
                    </div>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-full uppercase font-bold ${
                        sale.payment_method === 'cash'
                          ? 'bg-muted-teal-100 text-muted-teal-900'
                          : sale.payment_method === 'due'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-azure-mist-100 text-azure-mist-900'
                      }`}
                    >
                      {sale.payment_method}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
