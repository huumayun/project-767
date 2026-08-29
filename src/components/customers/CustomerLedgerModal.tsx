import React, { useState, useEffect } from 'react';
import { Customer, CustomerHistoryItem } from '../../types/ipc';
import { FileText, X, Printer, RefreshCw, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { InvoiceModal } from '../pos/InvoiceModal';

interface CustomerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const [history, setHistory] = useState<CustomerHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string | null>(null);

  const fetchLedger = async () => {
    if (!window.api || !customer) return;
    setLoading(true);
    try {
      const list = await window.api.customers.getHistory(customer.id);
      setHistory(list);
    } catch (err) {
      console.error('Failed to load customer statement:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer) {
      fetchLedger();
    }
  }, [isOpen, customer]);

  if (!isOpen) return null;

  const handlePrintStatement = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Customer Account Statement & Ledger</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">
                {customer.name} {customer.phone ? `(${customer.phone})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintStatement}
              className="px-3.5 py-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-azure-mist-700" />
              <span>Print Statement</span>
            </button>

            <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Statement Summary Card */}
        <div className="grid grid-cols-3 gap-3 font-mono bg-jungle-teal-50 border border-jungle-teal-200 p-3.5 rounded-xl text-xs">
          <div>
            <span className="text-jungle-teal-500 font-sans block text-[10px]">Total Invoiced (Debit)</span>
            <span className="font-bold text-jungle-teal-900">৳ {((customer.total_sales_paisa || 0) / 100).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-jungle-teal-500 font-sans block text-[10px]">Total Paid (Credit)</span>
            <span className="font-bold text-muted-teal-800">৳ {((customer.total_paid_paisa || 0) / 100).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-jungle-teal-500 font-sans block text-[10px]">Current Outstanding Due</span>
            <span className="font-extrabold text-amber-700">৳ {((customer.due_paisa || 0) / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="border border-jungle-teal-200 rounded-xl overflow-hidden bg-jungle-teal-50 max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 font-mono text-[10px] uppercase border-b border-jungle-teal-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Debit / Sale (৳)</th>
                <th className="p-3 text-right">Credit / Paid (৳)</th>
                <th className="p-3 text-right">Running Due (৳)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11px]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-jungle-teal-500 font-sans">
                    {loading ? 'Loading account statement...' : 'No transaction records found.'}
                  </td>
                </tr>
              ) : (
                history.map((tx) => (
                  <tr key={tx.id} className="hover:bg-jungle-teal-50 transition-colors">
                    <td className="p-3 text-jungle-teal-600">
                      {new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 text-azure-mist-800 font-bold">
                      {tx.ref_no?.startsWith('INV') ? (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceNo(tx.ref_no)}
                          className="hover:underline hover:text-azure-mist-600 text-left font-mono font-bold cursor-pointer transition-colors"
                          title="Click to view & print invoice"
                        >
                          {tx.ref_no}
                        </button>
                      ) : (
                        <span>{tx.ref_no}</span>
                      )}
                    </td>
                    <td className="p-3 font-sans text-jungle-teal-800">{tx.description}</td>
                    <td className="p-3 text-right text-jungle-teal-900 font-bold">
                      {tx.debit_paisa > 0 ? `৳ ${(tx.debit_paisa / 100).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-3 text-right text-muted-teal-800 font-bold">
                      {tx.credit_paisa > 0 ? `৳ ${(tx.credit_paisa / 100).toFixed(2)}` : '-'}
                    </td>
                    <td className="p-3 text-right text-amber-700 font-extrabold">
                      ৳ {((tx.running_balance_paisa || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2 border-t border-jungle-teal-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold"
          >
            Close Statement
          </button>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoiceNo && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoiceNo)}
          onClose={() => setSelectedInvoiceNo(null)}
          invoiceNo={selectedInvoiceNo}
        />
      )}
    </div>
  );
};
