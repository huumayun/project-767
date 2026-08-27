import React, { useState, useEffect } from 'react';
import { HeldSale, CartItem } from '../../types/ipc';
import { Layers, RotateCcw, Trash2, X, Clock, User } from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

interface HeldSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreCart: (cart: CartItem[]) => void;
}

const billTotalPaisa = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.unit_price_paisa * i.qty, 0);

export const HeldSalesModal: React.FC<HeldSalesModalProps> = ({
  isOpen,
  onClose,
  onRestoreCart,
}) => {
  const toast = useToast();
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchHeld = async () => {
    if (!window.api) return;
    setLoading(true);
    try {
      const list = await window.api.sales.getHeldSales();
      setHeldSales(list);
    } catch (err) {
      console.error('Failed to load held sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchHeld();
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmDelete = async () => {
    if (!deleteTargetId || !window.api) return;
    try {
      await window.api.sales.deleteHeldSale(deleteTargetId);
      toast.success('Parked cart discarded successfully.');
      setDeleteTargetId(null);
      fetchHeld();
    } catch (err: any) {
      toast.error(`Failed to delete held sale: ${err.message}`);
    }
  };

  const handleRestore = async (sale: HeldSale) => {
    if (sale.detail && sale.detail.cartData) {
      if (window.api) {
        try {
          await window.api.sales.deleteHeldSale(sale.id);
        } catch (err) {
          console.error('Failed to remove restored held sale from DB:', err);
        }
      }
      onRestoreCart(sale.detail.cartData);
      toast.info(`Bill restored — ${sale.detail.cartData.length} items`);
      onClose();
    }
  };

  // Falling back to the first entry means a freshly opened modal shows a bill
  // straight away, and deleting the selected one cannot leave an empty pane.
  const selected = heldSales.find((s) => s.id === selectedId) || heldSales[0] || null;
  const selectedItems: CartItem[] = selected?.detail?.cartData || [];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4">
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-4xl w-full shadow-2xl text-jungle-teal-900 font-sans overflow-hidden flex flex-col max-h-[82vh]">
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-jungle-teal-200">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-200 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-ui-lg font-semibold text-jungle-teal-900">Parked Bills</h3>
              <p className="text-ui-xs text-jungle-teal-600">Bills set aside to finish later</p>
            </div>

            {heldSales.length > 0 && (
              <span className="ml-auto font-mono text-ui-xs font-semibold text-amber-800 bg-amber-50 border border-amber-300 rounded-full px-2.5 py-1">
                {heldSales.length} parked
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`${
                heldSales.length > 0 ? '' : 'ml-auto'
              } w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors`}
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading && heldSales.length === 0 && (
            <div className="p-12 text-center text-ui-sm text-jungle-teal-500">Loading…</div>
          )}

          {!loading && heldSales.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-jungle-teal-100 text-jungle-teal-400 flex items-center justify-center mb-3">
                <Layers className="w-6 h-6" />
              </div>
              <div className="text-ui-base font-medium text-jungle-teal-900 mb-1">Nothing parked</div>
              <p className="text-ui-xs text-jungle-teal-600 max-w-xs mx-auto">
                Use Hold on the till to set a bill aside — handy when a customer goes back
                for one more part.
              </p>
            </div>
          )}

          {heldSales.length > 0 && (
            <div className="flex-1 min-h-0 flex">
              {/* Bill list */}
              <div className="w-[260px] shrink-0 border-r border-jungle-teal-200 overflow-y-auto divide-y divide-jungle-teal-100">
                {heldSales.map((sale) => {
                  const items: CartItem[] = sale.detail?.cartData || [];
                  const isActive = selected?.id === sale.id;
                  const customerName = sale.detail?.customerName;
                  return (
                    <button
                      key={sale.id}
                      type="button"
                      onClick={() => setSelectedId(sale.id)}
                      className={`w-full text-left px-3.5 py-3 transition-colors ${
                        isActive
                          ? 'bg-azure-mist-50 border-l-2 border-l-azure-mist-700'
                          : 'border-l-2 border-l-transparent hover:bg-jungle-teal-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <User
                          className={`w-3.5 h-3.5 shrink-0 ${
                            customerName ? 'text-azure-mist-700' : 'text-jungle-teal-400'
                          }`}
                        />
                        <span
                          className={`text-ui-sm font-semibold truncate ${
                            customerName ? 'text-jungle-teal-900' : 'text-jungle-teal-500'
                          }`}
                        >
                          {customerName || 'Walk-in bill'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-ui-2xs text-jungle-teal-600">
                        <Clock className="w-3 h-3 text-jungle-teal-400 shrink-0" />
                        <span>
                          {new Date(sale.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>·</span>
                        <span>{items.length} items</span>
                        <span className="ml-auto font-semibold text-jungle-teal-900">
                          ৳ {(billTotalPaisa(items) / 100).toFixed(2)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected bill */}
              {selected && (
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="shrink-0 px-5 py-3 border-b border-jungle-teal-200">
                    <div className="text-ui-base font-semibold text-jungle-teal-900 truncate">
                      {selected.detail?.customerName || 'Walk-in bill'}
                    </div>
                    <div className="font-mono text-ui-2xs text-jungle-teal-600">
                      <span className="text-azure-mist-800">{selected.invoice_no}</span>
                      {' · '}
                      {new Date(selected.created_at).toLocaleString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: 'short',
                      })}
                      {' · '}
                      {selectedItems.reduce((n, i) => n + i.qty, 0)} units
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-jungle-teal-100">
                    {selectedItems.map((item, idx) => (
                      <div
                        key={`${item.product_id}-${idx}`}
                        className="px-5 py-2 flex items-center gap-3"
                      >
                        <span className="font-mono text-ui-2xs text-jungle-teal-400 w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <span className="flex-1 min-w-0 text-ui-sm text-jungle-teal-900 truncate">
                          {item.name}
                        </span>
                        <span className="font-mono text-ui-2xs text-jungle-teal-600 shrink-0 whitespace-nowrap">
                          {item.qty} × ৳ {(item.unit_price_paisa / 100).toFixed(2)}
                        </span>
                        <span className="font-mono text-ui-sm font-semibold text-jungle-teal-900 w-[92px] text-right shrink-0 whitespace-nowrap">
                          ৳ {((item.unit_price_paisa * item.qty) / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}

                    {selectedItems.length === 0 && (
                      <div className="p-8 text-center text-ui-xs text-jungle-teal-500">
                        This parked bill has no items recorded.
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 px-5 py-3 border-t border-jungle-teal-200 flex items-center gap-3">
                    <span className="text-ui-xs text-jungle-teal-600">Total</span>
                    <span className="font-mono text-ui-xl font-semibold text-jungle-teal-900">
                      ৳ {(billTotalPaisa(selectedItems) / 100).toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(selected.id)}
                      className="ml-auto h-9 px-3 rounded-xl flex items-center gap-1.5 text-ui-xs font-medium text-jungle-teal-600 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                      title="Discard this parked bill"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Discard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRestore(selected)}
                      disabled={selectedItems.length === 0}
                      className="h-9 px-4 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-medium rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore this bill</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={Boolean(deleteTargetId)}
        title="Discard Held Cart"
        message="Are you sure you want to permanently discard this parked cart?"
        isDanger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </>
  );
};
