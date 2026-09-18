import React, { useState, useEffect } from 'react';
import { Product } from '../../types/ipc';
import { X, SlidersHorizontal, Save, AlertCircle } from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
}) => {
  const [delta, setDelta] = useState<string>('0');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDelta('0');
    setReason('');
    setError(null);
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const currentQty = product.stock_qty || 0;
  const parsedDelta = parseInt(delta, 10) || 0;
  const newTotal = currentQty + parsedDelta;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedDelta === 0) {
      setError('Please enter a non-zero adjustment delta (+ or -).');
      return;
    }
    if (!reason.trim()) {
      setError('An audited reason is required for stock adjustment.');
      return;
    }
    if (newTotal < 0) {
      setError('Stock quantity cannot be reduced below 0.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await window.api.products.stockAdjustment({
        product_id: product.id,
        qty_delta: parsedDelta,
        reason: reason.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Stock adjustment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/80 backdrop-blur-xs p-4">
      <div className="bg-jungle-teal-900 border border-jungle-teal-800 rounded-xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-100">
        <div className="flex items-center justify-between border-b border-jungle-teal-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Audited Stock Adjustment</h2>
              <p className="text-xs text-jungle-teal-400 font-mono">Barcode: {product.barcode}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-jungle-teal-400 hover:text-white rounded-lg hover:bg-jungle-teal-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 bg-jungle-teal-950 p-3 rounded-lg border border-jungle-teal-800 text-xs">
          <div className="font-semibold text-jungle-teal-200">{product.name}</div>
          <div className="text-jungle-teal-400 mt-0.5">Current Stock: <strong className="text-white font-mono">{currentQty} {product.unit}</strong></div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-jungle-teal-400 font-medium mb-1">
              Quantity Delta (+ to increase, - to decrease) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              required
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="e.g. +5 or -2"
              className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-100 font-mono text-sm focus:outline-hidden focus:border-amber-500"
            />
            <div className="text-[11px] text-jungle-teal-500 mt-1">
              Resulting Stock Qty: <strong className={newTotal < 0 ? 'text-rose-400' : 'text-amber-400'}>{newTotal}</strong>
            </div>
          </div>

          <div>
            <label className="block text-jungle-teal-400 font-medium mb-1">
              Audit Reason <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Damaged during handling / Recount variance"
              className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-jungle-teal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-jungle-teal-800 bg-jungle-teal-900 hover:bg-jungle-teal-800 text-jungle-teal-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-amber-600/20"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
