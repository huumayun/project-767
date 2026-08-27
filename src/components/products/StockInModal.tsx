import React, { useState, useEffect } from 'react';
import { Product } from '../../types/ipc';
import { X, PackagePlus, ArrowRight, Save, AlertCircle } from 'lucide-react';

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
}

export const StockInModal: React.FC<StockInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
}) => {
  const [addQty, setAddQty] = useState<string>('1');
  const [reason, setReason] = useState('Stock delivery received');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAddQty('1');
    setReason('Stock delivery received');
    setError(null);
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const currentQty = product.stock_qty || 0;
  const parsedAdd = parseInt(addQty, 10) || 0;
  const newTotal = currentQty + Math.max(0, parsedAdd);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAdd <= 0) {
      setError('Please enter a positive quantity to add.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await window.api.products.stockIn({
        product_id: product.id,
        qty: parsedAdd,
        reason: reason.trim() || 'Stock delivery received',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update stock.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/80 backdrop-blur-xs p-4">
      <div className="bg-jungle-teal-900 border border-jungle-teal-800 rounded-xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-100">
        <div className="flex items-center justify-between border-b border-jungle-teal-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted-teal-600/10 text-muted-teal-400 rounded-lg border border-muted-teal-600/20">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Stock-In Entry</h2>
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
          <div className="font-semibold text-jungle-teal-200 text-sm">{product.name}</div>
          {product.name_bn && <div className="text-jungle-teal-400 font-sans text-xs mt-0.5">{product.name_bn}</div>}
          <div className="text-jungle-teal-500 mt-1 flex justify-between">
            <span>Unit: {product.unit}</span>
            <span>Category: {product.category_name || 'Uncategorized'}</span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3 bg-jungle-teal-950/60 rounded-lg border border-jungle-teal-800/80">
            <div className="text-center">
              <div className="text-jungle-teal-400 text-[11px]">Current Stock</div>
              <div className="text-xl font-bold font-mono text-jungle-teal-300">{currentQty}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-jungle-teal-600" />
            <div className="text-center">
              <div className="text-jungle-teal-400 text-[11px]">Adding</div>
              <div className="text-xl font-bold font-mono text-muted-teal-400">+{parsedAdd}</div>
            </div>
            <ArrowRight className="w-5 h-5 text-jungle-teal-600" />
            <div className="text-center">
              <div className="text-jungle-teal-400 text-[11px]">New Stock</div>
              <div className="text-xl font-bold font-mono text-azure-mist-400">{newTotal}</div>
            </div>
          </div>

          <div>
            <label className="block text-jungle-teal-400 font-medium mb-1">
              Quantity to Add <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              required
              autoFocus
              value={addQty}
              onChange={(e) => setAddQty(e.target.value)}
              className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-100 text-sm font-mono focus:outline-hidden focus:border-muted-teal-600"
            />
          </div>

          <div>
            <label className="block text-jungle-teal-400 font-medium mb-1">
              Reference / Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. New delivery from supplier"
              className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-muted-teal-600"
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
              className="px-5 py-2 rounded-lg bg-muted-teal-700 hover:bg-muted-teal-600 text-white font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-muted-teal-700/20"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Updating...' : 'Add to Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
