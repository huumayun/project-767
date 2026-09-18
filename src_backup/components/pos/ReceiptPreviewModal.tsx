import React from 'react';
import { CartItem, Customer } from '../../types/ipc';
import { Printer, Check, X, Receipt, User, AlertCircle, RefreshCw } from 'lucide-react';

/**
 * What the paper is called on screen. "80MM" told the cashier the code name of
 * the setting, not which paper was about to come out of the printer.
 */
const PAPER_LABEL: Record<'80mm' | 'a4', string> = {
  '80mm': '80mm thermal roll',
  a4: 'A4 — full page',
};

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
  invoiceLayout: '80mm' | 'a4';
  loading?: boolean;
  /** False at a counter with no printer: there is nothing to "complete & print". */
  hasPrinter?: boolean;
}

/** Which of the two confirm buttons started the sale. */
type PendingAction = 'print' | 'plain';

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
  hasPrinter = true,
}) => {
  /*
   * `loading` says a sale is in flight but not which button sent it, so
   * "Processing…" always appeared on Complete & print - including when the
   * cashier had pressed Complete only, leaving the button they actually
   * pressed looking inert while another one claimed to be working.
   */
  const [pending, setPending] = React.useState<PendingAction | null>(null);
  const busy = (action: PendingAction) => loading && pending === action;

  React.useEffect(() => {
    if (!isOpen) setPending(null);
  }, [isOpen]);

  // The parent clears `loading` whether the sale saved or threw; either way the
  // buttons go back to their resting labels rather than spinning forever.
  React.useEffect(() => {
    if (!loading) setPending(null);
  }, [loading]);

  const confirmSale = React.useCallback(
    (shouldPrint: boolean) => {
      setPending(shouldPrint ? 'print' : 'plain');
      onConfirmSale(shouldPrint);
    },
    [onConfirmSale]
  );

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (duePaisa > 0 && !customer) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
        return;
      }

      if (e.key === 'Enter' || e.key === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        // With no printer Enter still finishes the sale - it just does not
        // send it to a print dialog there is nothing behind.
        confirmSale(hasPrinter);
      } else if (e.key === 'F7' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        e.stopPropagation();
        confirmSale(false);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, confirmSale, onClose, duePaisa, customer, hasPrinter]);

  if (!isOpen) return null;

  const isDueForbidden = duePaisa > 0 && !customer;

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
              <h3 className="text-ui-base font-bold text-jungle-teal-900">Sale Confirmation & Receipt Preview</h3>
              <p className="text-ui-2xs text-jungle-teal-500">
                {hasPrinter ? (
                  <>
                    Paper: <span className="font-semibold text-jungle-teal-700">{PAPER_LABEL[invoiceLayout]}</span>
                  </>
                ) : (
                  <span className="font-semibold text-jungle-teal-700">No printer · save the bill as PDF after the sale</span>
                )}
                <span className="text-jungle-teal-400"> · Settings › Print Layout</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-jungle-teal-600 hover:text-jungle-teal-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/*
          Body.

          Only the item list scrolls. It used to be the other way round - the
          list was pinned to max-h-48 (156px, about three rows) inside a body
          that scrolled as well, so a twenty-line cart was read three rows at a
          time through two nested scrollbars while the dialog left ~110px of
          the height it was allowed unused. Capping the list also pushed the
          totals below the fold, which is the one thing on here that has to
          stay in view while the cashier confirms.

          `min-h-0` throughout: a flex child defaults to min-height:auto and
          refuses to shrink under its content, which would push the buttons off
          the bottom of the dialog rather than scroll.
        */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 py-4 font-mono text-ui-sm">
          {/* Customer info */}
          <div className="shrink-0 bg-jungle-teal-50 p-3 rounded-xl border border-jungle-teal-200 text-ui-xs">
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

          {/* Warning Banner when Walk-in Customer has Due */}
          {isDueForbidden && (
            <div className="shrink-0 p-3 bg-amber-100 border border-amber-300 rounded-xl text-amber-900 text-ui-sm flex items-center gap-2 font-sans">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>A walk-in customer cannot be sold on credit. Select a customer, or take the full payment.</span>
            </div>
          )}

          {/* Items Summary Table */}
          <div className="flex-1 min-h-0 flex flex-col border border-jungle-teal-200 rounded-xl overflow-hidden">
            <div className="shrink-0 bg-jungle-teal-100 px-3 py-1.5 font-bold text-ui-2xs uppercase text-jungle-teal-600 border-b border-jungle-teal-200 flex justify-between">
              <span>Item ({cart.length})</span>
              <span>Total (৳)</span>
            </div>
            <div className="flex-1 min-h-0 divide-y divide-jungle-teal-100 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product_id} className="p-2.5 flex justify-between items-center text-ui-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="font-bold text-jungle-teal-900 font-sans truncate">{item.name}</div>
                    <div className="text-ui-2xs text-jungle-teal-500">
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
          <div className="shrink-0 bg-jungle-teal-50 p-3 rounded-xl border border-jungle-teal-200 space-y-1.5 text-ui-sm">
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
            <div className="flex justify-between text-ui-base font-extrabold text-jungle-teal-900 border-t border-jungle-teal-200 pt-1.5">
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

        {/*
          Action buttons.

          The label sits on one line and the shortcut on a second, rather than
          both running together. Side by side inside a max-w-md dialog each
          button gets about 158px, and "Complete and print (F8 / Enter)" wants
          250px - so both captions wrapped mid-phrase, to different heights,
          and `items-center` then left the two buttons vertically out of step.
        */}
        <div className="border-t border-jungle-teal-200 pt-4 flex items-stretch gap-2.5 shrink-0">
          {!hasPrinter ? (
            /* No printer: one way to finish, so one button. Two buttons that
               both only save the sale would be a choice with no difference. */
            <button
              type="button"
              disabled={loading || isDueForbidden}
              onClick={() => confirmSale(false)}
              className={`flex-1 min-w-0 px-2 py-2.5 rounded-2xl text-ui-sm transition-all shadow-md flex flex-col items-center justify-center gap-0.5 ${
                isDueForbidden
                  ? 'bg-jungle-teal-100 text-jungle-teal-400 border border-jungle-teal-200 cursor-not-allowed opacity-60'
                  : 'bg-muted-teal-700 hover:bg-muted-teal-800 text-white shadow-muted-teal-900/20 active:scale-[0.98]'
              }`}
              title={isDueForbidden ? 'Cannot confirm due sale for Walk-in customer' : 'Complete the sale (Enter)'}
            >
              <span className="flex items-center gap-1.5 font-black whitespace-nowrap">
                {busy('plain') ? (
                  <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 shrink-0" />
                )}
                {busy('plain') ? 'Processing…' : isDueForbidden ? 'Customer needed' : 'Complete sale'}
              </span>
              <span className="text-ui-2xs font-semibold opacity-70 whitespace-nowrap">Enter</span>
            </button>
          ) : (
          <>
          <button
            type="button"
            disabled={loading || isDueForbidden}
            onClick={() => confirmSale(false)}
            className={`flex-1 min-w-0 px-2 py-2.5 rounded-2xl text-ui-sm transition-colors flex flex-col items-center justify-center gap-0.5 border ${
              isDueForbidden
                ? 'bg-jungle-teal-50 text-jungle-teal-400 border-jungle-teal-200 cursor-not-allowed opacity-60'
                : 'bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 border-jungle-teal-300 active:scale-[0.98]'
            }`}
            title={isDueForbidden ? 'Cannot confirm due sale for Walk-in customer' : 'Complete the sale without printing (F7)'}
          >
            <span className="flex items-center gap-1.5 font-bold whitespace-nowrap">
              {busy('plain') ? (
                <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-jungle-teal-600" />
              ) : (
                <Check className="w-4 h-4 shrink-0 text-jungle-teal-600" />
              )}
              {busy('plain') ? 'Processing…' : 'Complete only'}
            </span>
            <span className="text-ui-2xs font-semibold opacity-70 whitespace-nowrap">no receipt · F7</span>
          </button>

          <button
            type="button"
            disabled={loading || isDueForbidden}
            onClick={() => confirmSale(true)}
            className={`flex-[1.2] min-w-0 px-2 py-2.5 rounded-2xl text-ui-sm transition-all shadow-md flex flex-col items-center justify-center gap-0.5 ${
              isDueForbidden
                ? 'bg-jungle-teal-100 text-jungle-teal-400 border border-jungle-teal-200 cursor-not-allowed opacity-60'
                : 'bg-muted-teal-700 hover:bg-muted-teal-800 text-white shadow-muted-teal-900/20 active:scale-[0.98]'
            }`}
            title={isDueForbidden ? 'Cannot confirm due sale for Walk-in customer' : 'Complete the sale and print the receipt (Enter / F8)'}
          >
            <span className="flex items-center gap-1.5 font-black whitespace-nowrap">
              {busy('print') ? (
                <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
              ) : (
                <Printer className="w-4 h-4 shrink-0" />
              )}
              {busy('print')
                ? 'Processing…'
                : isDueForbidden
                ? 'Customer needed'
                : 'Complete & print'}
            </span>
            <span className="text-ui-2xs font-semibold opacity-70 whitespace-nowrap">Enter · F8</span>
          </button>
          </>
          )}
        </div>
      </div>
    </div>
  );
};


