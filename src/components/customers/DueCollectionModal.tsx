import React, { useState } from 'react';
import { Customer } from '../../types/ipc';
import { DollarSign, X, CheckCircle2, AlertCircle, Printer } from 'lucide-react';

interface DueCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  onSuccess: () => void;
}

export const DueCollectionModal: React.FC<DueCollectionModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const [amountTaka, setAmountTaka] = useState('');
  const [method, setMethod] = useState<'cash' | 'bkash' | 'nagad' | 'card'>('cash');
  const [trxId, setTrxId] = useState('');
  const [note, setNote] = useState('Due collection payment');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any | null>(null);

  if (!isOpen) return null;

  const currentDuePaisa = customer.due_paisa || 0;
  const payPaisa = Math.round((parseFloat(amountTaka) || 0) * 100);
  const remainingDuePaisa = Math.max(0, currentDuePaisa - payPaisa);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payPaisa <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }
    if (payPaisa > currentDuePaisa) {
      setError(`Cannot collect more than the current due (Tk ${(currentDuePaisa / 100).toFixed(2)}).`);
      return;
    }
    if (!window.api) return;

    setLoading(true);
    setError(null);
    try {
      const res = await window.api.customers.collectDue({
        customer_id: customer.id,
        amount_taka: parseFloat(amountTaka),
        method,
        trx_id: trxId.trim() || null,
        note: note.trim() || null,
      });

      if (res.success) {
        setReceiptData(res);
      }
    } catch (err: any) {
      setError(err.message || 'Payment collection failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 space-y-4">
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200 shadow-xs">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Collect Due / Baki Payment</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">{customer.name}</p>
            </div>
          </div>

          <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!receiptData ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Due Information Pill */}
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl flex items-center justify-between font-mono">
              <div>
                <span className="text-[10px] text-amber-800 font-sans block">Current Due Balance</span>
                <span className="text-lg font-extrabold text-amber-700">
                  ৳ {(currentDuePaisa / 100).toFixed(2)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAmountTaka((currentDuePaisa / 100).toString())}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-sans font-bold text-xs shadow-xs transition-colors"
              >
                Pay Full Due
              </button>
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Collection Amount (৳) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={(currentDuePaisa / 100).toFixed(2)}
                  step="0.01"
                  value={amountTaka}
                onChange={(e) => setAmountTaka(e.target.value)}
                placeholder="Enter received amount"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono text-sm font-bold focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">Payment Channel</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-semibold"
                >
                  <option value="cash">Cash (Drawer)</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="card">Card / Bank</option>
                </select>
              </div>

              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">Transaction ID (TrxID)</label>
                <input
                  type="text"
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder="e.g. 9J3K8L2M"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Payment Reference Note</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
              />
            </div>

            {/* Remaining Due Preview */}
            <div className="flex justify-between items-center bg-jungle-teal-50 p-2.5 rounded-xl border border-jungle-teal-200 text-xs font-mono">
              <span className="text-jungle-teal-600 font-sans">Remaining Due After Payment:</span>
              <span className="font-bold text-jungle-teal-900">৳ {(remainingDuePaisa / 100).toFixed(2)}</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md transition-colors"
              >
                {loading ? 'Collecting...' : 'Confirm & Collect Payment'}
              </button>
            </div>
          </form>
        ) : (
          /* Printable Money Receipt */
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl space-y-2 text-jungle-teal-900">
              <div className="text-center border-b border-jungle-teal-200 pb-2">
                <CheckCircle2 className="w-8 h-8 text-muted-teal-700 mx-auto mb-1" />
                <h4 className="font-bold text-sm font-sans">Money Receipt</h4>
                <p className="text-[10px] text-jungle-teal-500 font-mono">Payment Ref: {receiptData.payment_id.slice(0, 8).toUpperCase()}</p>
              </div>

              <div className="space-y-1 text-[11px] pt-1">
                <div className="flex justify-between">
                  <span className="text-jungle-teal-600 font-sans">Customer Name:</span>
                  <span className="font-bold">{customer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-jungle-teal-600 font-sans">Payment Date:</span>
                  <span>{new Date(receiptData.date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-jungle-teal-600 font-sans">Payment Method:</span>
                  <span className="font-bold uppercase">{method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-jungle-teal-600 font-sans">Previous Due:</span>
                  <span>৳ {(receiptData.previous_due_paisa / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-teal-800 font-bold border-t border-jungle-teal-200 pt-1 text-xs">
                  <span className="font-sans">Amount Paid:</span>
                  <span>৳ {(receiptData.amount_paisa / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold border-t border-jungle-teal-200 pt-1">
                  <span className="font-sans">Remaining Due Balance:</span>
                  <span>৳ {(receiptData.remaining_due_paisa / 100).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200 font-sans">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold text-xs"
              >
                Close Window
              </button>

              <button
                type="button"
                onClick={handlePrintReceipt}
                className="px-5 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
