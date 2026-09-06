import React, { useState } from 'react';
import { SaleRecord } from '../../types/ipc';
import { RotateCcw, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface ReturnRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleRecord;
  onSuccess: () => void;
}

export const ReturnRefundModal: React.FC<ReturnRefundModalProps> = ({
  isOpen,
  onClose,
  sale,
  onSuccess,
}) => {
  const toast = useToast();
  const [reason, setReason] = useState('Customer returned item');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'bkash' | 'nagad' | 'card'>('cash');
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const items = sale.items || [];

  const handleQtyChange = (itemId: string, maxQty: number, val: number) => {
    const safeVal = Math.max(0, Math.min(maxQty, val));
    setReturnQtys((prev) => ({ ...prev, [itemId]: safeVal }));
  };

  // Refund what the customer paid for the line, not its sticker price: an
  // invoice discount means those differ, and refunding the sticker price hands
  // back more than was ever collected. The server sends the discounted figures.
  const refundableQty = (it: any) => it.refundable_qty ?? it.qty;

  const returnPayloadItems = items
    .filter((it) => (returnQtys[it.id] || 0) > 0)
    .map((it) => {
      const q = returnQtys[it.id];
      const left = refundableQty(it);
      const refundableLeft = it.refundable_paisa ?? (it.unit_price_paisa * it.qty);
      // Returning the last of a line clears its remaining value exactly, so
      // rounding on the per-unit share can never strand a paisa.
      const amount = q >= left
        ? refundableLeft
        : Math.min(refundableLeft, Math.round((refundableLeft * q) / Math.max(1, left)));
      return {
        sale_item_id: it.id,
        product_id: it.product_id,
        qty: q,
        amount_paisa: amount,
      };
    });

  const totalRefundPaisa = returnPayloadItems.reduce((s, i) => s + i.amount_paisa, 0);

  const isFullyReturned = items.every((it) => refundableQty(it) === 0);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (returnPayloadItems.length === 0) {
      toast.warning('Please specify quantity to return for at least one item.');
      return;
    }
    if (!window.api) return;

    setLoading(true);
    setError(null);
    try {
      const res = await window.api.sales.processReturn({
        sale_id: sale.id,
        reason,
        refund_method: refundMethod,
        items: returnPayloadItems,
      });
      if (res.success) {
        toast.success('Return processed successfully! Stock restored and refund recorded.');
        onSuccess();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process return.');
      setError(err.message || 'Failed to process return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto font-sans animate-in fade-in">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4">
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-200 shadow-xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Process Sale Return & Refund</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">Invoice: {sale.invoice_no}</p>
            </div>
          </div>

          <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmitReturn} className="space-y-4">
          {isFullyReturned && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              This invoice has already been fully refunded and returned.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-jungle-teal-700 block">Select Items & Quantities to Return:</label>
            <div className="divide-y divide-jungle-teal-100 border border-jungle-teal-200 rounded-xl bg-jungle-teal-50 p-2 max-h-48 overflow-y-auto">
              {items.map((it) => {
                const alreadyReturned = it.returned_qty ?? 0;
                const maxReturnable = refundableQty(it);
                const unitRefundPaisa = it.net_unit_price_paisa ?? it.unit_price_paisa;

                return (
                  <div key={it.id} className={`py-2 flex items-center justify-between gap-3 text-xs ${maxReturnable === 0 ? 'opacity-50 grayscale' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-jungle-teal-900 truncate">
                        {it.product_name}
                        {maxReturnable === 0 && <span className="ml-2 text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded uppercase font-bold">Fully Returned</span>}
                      </div>
                      <div className="text-[11px] text-jungle-teal-500 font-mono mt-0.5">
                        Sold: {it.qty} {alreadyReturned > 0 && <span className="text-rose-600 font-bold ml-1">(Returned: {alreadyReturned})</span>} · Unit: ৳{(unitRefundPaisa / 100).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-jungle-teal-500">Return Qty:</span>
                      <input
                        type="number"
                        min="0"
                        max={maxReturnable}
                        disabled={maxReturnable === 0}
                        value={returnQtys[it.id] || 0}
                        onChange={(e) => handleQtyChange(it.id, maxReturnable, parseInt(e.target.value, 10) || 0)}
                        className="w-16 bg-jungle-teal-50 border border-jungle-teal-300 rounded-sm px-2 py-1 text-center font-bold text-xs focus:outline-hidden focus:border-azure-mist-600 font-mono disabled:bg-jungle-teal-100 disabled:text-jungle-teal-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-jungle-teal-700 block mb-1">Return Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-azure-mist-600"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-jungle-teal-700 block mb-1">Refund Payout Method</label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as any)}
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-azure-mist-600 font-semibold"
              >
                <option value="cash">Cash Out</option>
                <option value="bkash">bKash Refund</option>
                <option value="nagad">Nagad Refund</option>
                <option value="card">Card Reversal</option>
              </select>
            </div>
          </div>

          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-center justify-between text-xs font-mono">
            <span className="text-rose-800 font-sans font-bold">Total Refund Payout:</span>
            <span className="text-base font-extrabold text-rose-700">
              ৳ {(totalRefundPaisa / 100).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-bold text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || totalRefundPaisa === 0 || isFullyReturned}
              className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition-colors text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {loading ? 'Processing...' : 'Confirm Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
