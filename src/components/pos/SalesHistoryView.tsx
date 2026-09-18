import React, { useState, useEffect } from 'react';
import { toLocalDateString } from '../../utils/localDate';
import { SaleRecord, UserSession } from '../../types/ipc';
import {
  ShoppingBag,
  Search,
  Printer,
  RotateCcw,
  Eye,
  CheckCircle2,
  Calendar,
  DollarSign,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { InvoiceModal } from './InvoiceModal';
import { ReturnRefundModal } from './ReturnRefundModal';
import { ReturnInvoiceModal } from './ReturnInvoiceModal';
import { useToast } from '../../context/ToastContext';

type DatePreset = 'today' | '7days' | 'this_month' | 'last_month' | 'custom';

/** The quick filter, in the order it is offered. */
const DATE_PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 Days' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range…' },
];

/**
 * The local calendar days a preset covers, inclusive at both ends.
 *
 * Built from local date parts throughout - toLocalDateString, not toISOString -
 * because Bangladesh runs six hours ahead of UTC, so a UTC-derived "today"
 * names yesterday for the first six hours of every trading day.
 */
const rangeFor = (preset: DatePreset, customStart: string, customEnd: string) => {
  const now = new Date();
  const today = toLocalDateString(now);

  if (preset === '7days') {
    const past = new Date();
    past.setDate(now.getDate() - 6); // inclusive of today, so 7 days in all
    return { start: toLocalDateString(past), end: today };
  }
  if (preset === 'this_month') {
    return { start: toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1)), end: today };
  }
  if (preset === 'last_month') {
    // The one preset that does not end today: day 0 of this month is the last
    // day of the previous one, and both constructors roll the year over in
    // January on their own.
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: toLocalDateString(start), end: toLocalDateString(end) };
  }
  if (preset === 'custom') {
    // An unset end must not silently exclude everything.
    return { start: customStart || '0000-01-01', end: customEnd || '9999-12-31' };
  }
  return { start: today, end: today };
};

interface SalesHistoryViewProps {
  currentSession: UserSession | null;
  onShiftChanged?: () => void;
  onRefreshProducts?: () => void;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ currentSession, onShiftChanged, onRefreshProducts }) => {
  const toast = useToast();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [search, setSearch] = useState('');
  // Today by default - the till's own day is what a cashier checks first.
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [creditOnly, setCreditOnly] = useState(false);

  const { start: rangeStart, end: rangeEnd } = rangeFor(datePreset, customStart, customEnd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [returnTargetSale, setReturnTargetSale] = useState<SaleRecord | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedReturnInvoiceNo, setSelectedReturnInvoiceNo] = useState('');
  const [showReturnInvoiceModal, setShowReturnInvoiceModal] = useState(false);

  const fetchSales = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const data = await window.api.sales.list(500); // Increased limit to find old sales
      setSales(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleOpenInvoice = (sale: SaleRecord) => {
    setSelectedInvoiceNo(sale.invoice_no);
    setShowInvoiceModal(true);
  };

  const handleOpenReturn = async (sale: SaleRecord) => {
    if (!window.api) return;
    try {
      const fullSale = await window.api.sales.getByInvoice(sale.invoice_no);
      if (fullSale) {
        setReturnTargetSale(fullSale);
        setShowReturnModal(true);
      }
    } catch (err: any) {
      toast.error(`Failed to load sale details: ${err.message}`);
    }
  };

  const handleOpenReturnInvoice = (returnInvoiceNo: string) => {
    setSelectedReturnInvoiceNo(returnInvoiceNo);
    setShowReturnInvoiceModal(true);
  };

  const creditSalesCount = sales.filter((s) => (s.due_at_sale_paisa || 0) > 0).length;

  const filteredSales = sales.filter((s) => {
    let match = true;
    if (creditOnly && (s.due_at_sale_paisa || 0) <= 0) return false;

    // String comparison is safe here: YYYY-MM-DD sorts the same way it reads.
    const saleDate = toLocalDateString(new Date(s.created_at));
    if (saleDate < rangeStart || saleDate > rangeEnd) return false;
    
    if (match && search.trim()) {
      const q = search.trim().toLowerCase();
      match = 
        s.invoice_no.toLowerCase().includes(q) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
        (s.cashier_name && s.cashier_name.toLowerCase().includes(q)) || false;
    }
    return match;
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 text-jungle-teal-900 pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-jungle-teal-900">Transactions & Invoice Archive</h2>
            <p className="text-xs text-jungle-teal-500">Search invoices, process customer returns, and reprint receipts</p>
          </div>
        </div>

        <button
          onClick={fetchSales}
          className="p-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl border border-jungle-teal-300 transition-colors"
          title="Reload Sales"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-3 rounded-xl flex items-center gap-3 text-xs shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-jungle-teal-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Invoice No (e.g. INV-REG01-...), Customer Name, or Cashier..."
            className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-lg pl-9 pr-3 py-2 text-jungle-teal-900 text-xs font-sans focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Quick range, in place of the single-day picker that was here: a
              shop asks "today", "this month", "last month" far more often than
              it asks about one particular date. */}
          <Calendar className="w-3.5 h-3.5 text-jungle-teal-500 shrink-0" />
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value as DatePreset)}
            className="bg-jungle-teal-50 border border-jungle-teal-300 rounded-lg px-3 py-2 text-jungle-teal-900 text-xs font-bold focus:outline-hidden focus:border-azure-mist-600 cursor-pointer"
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>

          {datePreset === 'custom' ? (
            <div className="flex items-center gap-1.5 bg-jungle-teal-50 border border-jungle-teal-300 rounded-lg px-2 py-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent text-jungle-teal-900 text-xs font-semibold focus:outline-hidden cursor-pointer"
              />
              <span className="text-jungle-teal-400">→</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent text-jungle-teal-900 text-xs font-semibold focus:outline-hidden cursor-pointer"
              />
            </div>
          ) : (
            /* What the preset resolves to, so the list is never read against a
               range the reader has to work out. */
            <span className="font-mono text-[11px] text-jungle-teal-500 whitespace-nowrap">
              {rangeStart === rangeEnd ? rangeStart : `${rangeStart} → ${rangeEnd}`}
            </span>
          )}
          {/* Which bills went out on credit - the reason to open this screen
              after a day's trading. */}
          <button
            type="button"
            onClick={() => setCreditOnly((v) => !v)}
            title="Show only bills that were not paid in full at the counter"
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors whitespace-nowrap ${
              creditOnly
                ? 'bg-amber-700 text-white border-amber-800'
                : 'bg-jungle-teal-50 text-jungle-teal-700 border-jungle-teal-300 hover:bg-jungle-teal-100'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Credit bills ({creditSalesCount})</span>
          </button>
        </div>
      </div>

      {/*
        Says plainly what the column is, because the obvious reading of a "Due"
        column on an invoice list is "still owed", and that is not what this is.
      */}
      <p className="text-[11px] text-jungle-teal-500 font-sans -mt-4 px-1">
        Paid / Due shows what was settled <span className="font-semibold text-jungle-teal-700">when the bill was cut</span>.
        Money collected against a baki afterwards is recorded on the customer, not the invoice, so these figures do not
        change. For what a customer owes today, see <span className="font-semibold text-jungle-teal-700">Reports › Due &amp; Payable</span>.
      </p>

      {/* Sales Table */}
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-mono text-[10px] tracking-wider border-b border-jungle-teal-200">
              <tr>
                <th className="p-3.5">Invoice No</th>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Cashier</th>
                <th className="p-3.5 text-right">Total (৳)</th>
                <th className="p-3.5 text-right" title="What was collected when the bill was cut. A baki settled later is recorded against the customer, not the invoice, so this does not change.">
                  Paid / Due at billing
                </th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11.5px]">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-jungle-teal-500 font-sans">
                    {loading ? 'Loading sales history...' : 'No sales records found.'}
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-jungle-teal-50 transition-colors">
                    <td className="p-3.5 font-bold text-azure-mist-800">
                      <button
                        type="button"
                        onClick={() => handleOpenInvoice(sale)}
                        className="hover:underline hover:text-azure-mist-600 text-left font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="Click to view & print invoice"
                      >
                        <span>{sale.invoice_no}</span>
                      </button>
                    </td>
                    <td className="p-3.5 text-jungle-teal-600">
                      {new Date(sale.created_at).toLocaleDateString()} {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3.5 font-sans text-jungle-teal-800">
                      {sale.customer_name || <span className="text-jungle-teal-600 italic">Walk-in Customer</span>}
                    </td>
                    <td className="p-3.5 font-sans text-jungle-teal-700">{sale.cashier_name || 'Staff'}</td>
                    <td className="p-3.5 text-right">
                      <div className="font-bold text-jungle-teal-900">
                        ৳ {(sale.total_paisa / 100).toFixed(2)}
                      </div>
                      {(sale.refunded_paisa ?? 0) > 0 && (
                        <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                          Refunded: -৳ {((sale.refunded_paisa || 0) / 100).toFixed(2)}
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      {(sale.due_at_sale_paisa || 0) > 0 ? (
                        <>
                          <span className="block text-muted-teal-800">
                            ৳ {((sale.paid_at_sale_paisa || 0) / 100).toFixed(2)} paid
                          </span>
                          <span className="block font-extrabold text-amber-800">
                            ৳ {((sale.due_at_sale_paisa || 0) / 100).toFixed(2)} due
                          </span>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-teal-800 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Paid in full
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sale.status === 'completed'
                            ? 'bg-muted-teal-100 text-muted-teal-900 border border-muted-teal-300'
                            : sale.status === 'refunded'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 font-sans flex-wrap">
                        <button
                          onClick={() => handleOpenInvoice(sale)}
                          className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors text-[11px] font-semibold flex items-center gap-1"
                          title="View / Reprint Invoice"
                        >
                          <Printer className="w-3.5 h-3.5 text-azure-mist-700" />
                          <span>Reprint</span>
                        </button>

                        {(sale.status === 'completed' || sale.status === 'partial_refund') && (
                          <button
                            onClick={() => handleOpenReturn(sale)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-300 transition-colors text-[11px] font-semibold flex items-center gap-1"
                            title="Process Return / Refund"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Return</span>
                          </button>
                        )}

                        {(sale.status === 'refunded' || sale.status === 'partial_refund') && (sale as any).return_invoice_no && (
                          <button
                            onClick={() => handleOpenReturnInvoice((sale as any).return_invoice_no)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-azure-mist-700 rounded-lg border border-blue-200 transition-colors text-[11px] font-semibold flex items-center gap-1"
                            title="View Return Invoice"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Return Invoice</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Reprint Modal */}
      {selectedInvoiceNo && (
        <InvoiceModal
          isOpen={showInvoiceModal}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoiceNo('');
          }}
          invoiceNo={selectedInvoiceNo}
        />
      )}

      {/* Return / Refund Modal */}
      {returnTargetSale && (
        <ReturnRefundModal
          isOpen={showReturnModal}
          onClose={() => {
            setShowReturnModal(false);
            setReturnTargetSale(null);
          }}
          sale={returnTargetSale}
          onSuccess={() => {
            fetchSales();
            setShowReturnModal(false);
            if (onShiftChanged) onShiftChanged();
            if (onRefreshProducts) onRefreshProducts();
          }}
          onViewReturnInvoice={(rtnNo) => {
            setShowReturnModal(false);
            setReturnTargetSale(null);
            handleOpenReturnInvoice(rtnNo);
          }}
        />
      )}

      {/* Return Invoice (Credit Note) Modal */}
      {selectedReturnInvoiceNo && (
        <ReturnInvoiceModal
          isOpen={showReturnInvoiceModal}
          onClose={() => {
            setShowReturnInvoiceModal(false);
            setSelectedReturnInvoiceNo('');
          }}
          returnInvoiceNo={selectedReturnInvoiceNo}
          onOpenOriginalInvoice={(invNo) => {
            setShowReturnInvoiceModal(false);
            setSelectedInvoiceNo(invNo);
            setShowInvoiceModal(true);
          }}
        />
      )}
    </div>
  );
};
