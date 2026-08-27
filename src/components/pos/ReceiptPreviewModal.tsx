import React from 'react';
import { CartItem, Customer } from '../../types/ipc';
import { Printer, Check, X, Receipt, User, AlertCircle } from 'lucide-react';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSale: (shouldPrint: boolean) => void;
  cart: CartItem[];
  customer?: Customer | null;
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  changePaisa: number;
  duePaisa: number;
  paymentMethodSummary: string;
  invoiceLayout: '80mm' | 'a5';
  loading?: boolean;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmSale,
  cart,
  customer,
  subtotalPaisa,
  discountPaisa,
  totalPaisa,
  paidPaisa,
  changePaisa,
  duePaisa,
  paymentMethodSummary,
  invoiceLayout,
  loading = false,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        onConfirmSale(true);
      } else if (e.key === 'F7' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        onConfirmSale(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onConfirmSale, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-3xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 font-sans">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-jungle-teal-900">Sale Confirmation & Receipt Preview</h3>
              <p className="text-[11px] text-jungle-teal-500 font-mono">Layout: {invoiceLayout.toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jungle-teal-400 hover:text-jungle-teal-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 font-mono text-xs">
          {/* Customer info */}
          <div className="bg-jungle-teal-50 p-3 rounded-xl border border-jungle-teal-200 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-jungle-teal-500 font-sans">Customer:</span>
              <span className="font-bold text-jungle-teal-900 font-sans">
                {customer?.name || 'Walking Retail Customer'}
              </span>
            </div>
            {customer?.phone && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-jungle-teal-500 font-sans">Phone:</span>
                <span className="text-jungle-teal-700">{customer.phone}</span>
              </div>
            )}
          </div>

          {/* Items Summary Table */}
          <div className="border border-jungle-teal-200 rounded-xl overflow-hidden">
            <div className="bg-jungle-teal-100 px-3 py-1.5 font-bold text-[10px] uppercase text-jungle-teal-600 border-b border-jungle-teal-200 flex justify-between">
              <span>Item ({cart.length})</span>
              <span>Total (৳)</span>
            </div>
            <div className="divide-y divide-jungle-teal-100 max-h-48 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product_id} className="p-2.5 flex justify-between items-center text-[11px]">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-jungle-teal-900 font-sans truncate">{item.name}</div>
                    <div className="text-[10px] text-jungle-teal-500">
                      {item.qty} {item.unit || 'pcs'} × ৳ {(item.unit_price_paisa / 100).toFixed(2)}
                    </div>
                  </div>
                  <div className="font-bold text-jungle-teal-900">
                    ৳ {((item.unit_price_paisa * item.qty) / 100).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="bg-jungle-teal-50 p-3 rounded-xl border border-jungle-teal-200 space-y-1.5 text-xs">
            <div className="flex justify-between text-jungle-teal-600">
              <span>Subtotal:</span>
              <span>৳ {(subtotalPaisa / 100).toFixed(2)}</span>
            </div>
            {discountPaisa > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Discount:</span>
                <span>- ৳ {(discountPaisa / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-extrabold text-jungle-teal-900 border-t border-jungle-teal-200 pt-1.5">
              <span>Net Payable:</span>
              <span className="text-azure-mist-800">৳ {(totalPaisa / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-jungle-teal-700 font-semibold pt-1">
              <span>Paid ({paymentMethodSummary}):</span>
              <span>৳ {(paidPaisa / 100).toFixed(2)}</span>
            </div>
            {changePaisa > 0 && (
              <div className="flex justify-between text-muted-teal-800 font-bold">
                <span>Change Return:</span>
                <span>৳ {(changePaisa / 100).toFixed(2)}</span>
              </div>
            )}
            {duePaisa > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Remaining Due:</span>
                <span>৳ {(duePaisa / 100).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="border-t border-jungle-teal-200 pt-4 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirmSale(false)}
            className="w-full sm:flex-1 py-3 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 font-bold rounded-2xl text-xs transition-colors flex items-center justify-center gap-1.5 border border-jungle-teal-300 active:scale-[0.98]"
            title="Complete the sale without printing (F7)"
          >
            <Check className="w-4 h-4 text-jungle-teal-600" />
            <span>Complete without printing (F7)</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirmSale(true)}
            className="w-full sm:flex-1 py-3 bg-[#283e32] hover:bg-[#141f19] text-white font-black rounded-2xl text-xs transition-all shadow-md shadow-muted-teal-900/20 flex items-center justify-center gap-1.5 active:scale-[0.98]"
            title="Complete the sale and print the receipt (Enter / F8)"
          >
            <Printer className="w-4 h-4" />
            <span>{loading ? 'Processing…' : 'Complete and print (F8 / Enter)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


