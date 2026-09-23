import React, { useState, useEffect } from 'react';
import { Product } from '../../types/ipc';
import { Clock, X, Layers } from 'lucide-react';

interface StockHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export const StockHistoryModal: React.FC<StockHistoryModalProps> = ({ isOpen, onClose, product }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product && window.api) {
      setLoading(true);
      window.api.products.getStockHistory(product.id)
        .then(setHistory)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setHistory([]);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-white border border-jungle-teal-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-jungle-teal-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-100 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-jungle-teal-50 text-jungle-teal-700 rounded-xl border border-jungle-teal-100 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-jungle-teal-950 flex items-center gap-2">
                Stock Details (Batches)
              </h3>
              <p className="text-xs text-jungle-teal-600 font-medium tracking-tight mt-0.5 max-w-[280px] truncate">
                {product.name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-jungle-teal-400 hover:text-jungle-teal-700 hover:bg-jungle-teal-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Current Active Batches */}
          {(!product.batches || product.batches.length === 0) ? (
            <div className="text-center py-8 text-jungle-teal-500 font-medium text-sm bg-jungle-teal-50 rounded-xl border border-jungle-teal-100">
              No stock available for this product.
            </div>
          ) : (
            <div className="space-y-3">
              {product.batches.map((b, i) => (
                <div key={i} className="flex justify-between items-center text-sm font-mono bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-4 py-3 shadow-xs hover:border-azure-mist-300 transition-colors">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-jungle-teal-900 text-base">{b.remaining_qty} {product.unit}</span>
                    {b.received_at && (
                      <span className="text-xs text-jungle-teal-500 font-sans font-medium" title={new Date(b.received_at).toLocaleString()}>
                        Received: {new Date(b.received_at).toLocaleDateString('en-GB')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="text-xs text-jungle-teal-500 font-sans mb-0.5">Batch Cost</span>
                    <span className="text-azure-mist-700 font-bold text-base bg-azure-mist-50 px-2.5 py-0.5 rounded-lg border border-azure-mist-200">
                      ৳ {(b.cost_price_paisa / 100).toFixed(2)}
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
