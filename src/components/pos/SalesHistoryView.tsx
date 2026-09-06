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
import { useToast } from '../../context/ToastContext';

interface SalesHistoryViewProps {
  currentSession: UserSession | null;
}

export const SalesHistoryView: React.FC<SalesHistoryViewProps> = ({ currentSession }) => {
  const toast = useToast();
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState('');
  const [returnTargetSale, setReturnTargetSale] = useState<SaleRecord | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

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

  const filteredSales = sales.filter((s) => {
    let match = true;
    if (dateFilter) {
      const saleDate = toLocalDateString(new Date(s.created_at));
      if (saleDate !== dateFilter) {
        match = false;
      }
    }
    
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
            <h2 className="text-base font-bold text-jungle-teal-900">Sales Transactions & Invoice Archive</h2>
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
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-[140px] bg-jungle-teal-50 border border-jungle-teal-300 rounded-lg px-3 py-2 text-jungle-teal-900 text-xs font-sans focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 cursor-pointer"
          />
          {dateFilter && (
            <button 
              onClick={() => setDateFilter('')}
              className="p-1.5 text-jungle-teal-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
              title="Clear Date"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          )}
        </div>
      </div>

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
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11.5px]">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-jungle-teal-500 font-sans">
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
                      {sale.customer_name || <span className="text-jungle-teal-400 italic">Walk-in Customer</span>}
                    </td>
                    <td className="p-3.5 font-sans text-jungle-teal-700">{sale.cashier_name || 'Staff'}</td>
                    <td className="p-3.5 text-right font-bold text-jungle-teal-900">
                      ৳ {(sale.total_paisa / 100).toFixed(2)}
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
                      <div className="flex items-center justify-center gap-1.5 font-sans">
                        <button
                          onClick={() => handleOpenInvoice(sale)}
                          className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors text-[11px] font-semibold flex items-center gap-1"
                          title="View / Reprint Invoice"
                        >
                          <Printer className="w-3.5 h-3.5 text-azure-mist-700" />
                          <span>Reprint</span>
                        </button>

                        {sale.status === 'completed' && (
                          <button
                            onClick={() => handleOpenReturn(sale)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-300 transition-colors text-[11px] font-semibold flex items-center gap-1"
                            title="Process Return / Refund"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Return</span>
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
          }}
        />
      )}
    </div>
  );
};
