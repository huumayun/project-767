import React, { useState, useEffect } from 'react';
import { CartItem, PaymentItem, UserSession } from '../../types/ipc';
import {
  X,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Printer,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  customerId: string | null;
  customerName?: string;
  currentSession: UserSession | null;
  onCompleteSale: (result: { sale_id: string; invoice_no: string; pdfBase64: string }) => void;
}

type TenderMethod = 'cash' | 'bkash' | 'nagad' | 'card';

const TENDERS: Array<{ id: TenderMethod; label: string; hint: string }> = [
  { id: 'cash', label: 'Cash', hint: 'Notes in the drawer' },
  { id: 'bkash', label: 'bKash', hint: 'Mobile wallet' },
  { id: 'nagad', label: 'Nagad', hint: 'Mobile wallet' },
  { id: 'card', label: 'Card', hint: 'POS terminal' },
];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  cart,
  subtotalPaisa,
  discountPaisa,
  totalPaisa,
  customerId,
  customerName,
  currentSession,
  onCompleteSale,
}) => {
  const [cashAmount, setCashAmount] = useState<string>('');
  const [bkashAmount, setBkashAmount] = useState<string>('');
  const [bkashTrxId, setBkashTrxId] = useState<string>('');
  const [nagadAmount, setNagadAmount] = useState<string>('');
  const [cardAmount, setCardAmount] = useState<string>('');
  const [layout, setLayout] = useState<'80mm' | 'a4'>('80mm');
  /*
   * One tender at a time, because that is how nearly every sale is settled.
   * All four amount boxes used to sit open at once with the total pre-filled
   * into cash, so paying by bKash meant clearing cash first - the till was
   * asking the cashier to undo something before doing anything.
   */
  const [activeMethod, setActiveMethod] = useState<TenderMethod>('cash');
  const [splitMode, setSplitMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const grandTotalTaka = (totalPaisa / 100).toFixed(2);
      setCashAmount(grandTotalTaka);
      setBkashAmount('');
      setBkashTrxId('');
      setNagadAmount('');
      setCardAmount('');
      setActiveMethod('cash');
      setSplitMode(false);
      setError(null);
    }
  }, [isOpen, totalPaisa]);

  if (!isOpen) return null;

  const cashPaisa = Math.round((parseFloat(cashAmount) || 0) * 100);
  const bkashPaisa = Math.round((parseFloat(bkashAmount) || 0) * 100);
  const nagadPaisa = Math.round((parseFloat(nagadAmount) || 0) * 100);
  const cardPaisa = Math.round((parseFloat(cardAmount) || 0) * 100);

  const totalPaidPaisa = cashPaisa + bkashPaisa + nagadPaisa + cardPaisa;
  const changePaisa = Math.max(0, cashPaisa - (totalPaisa - (bkashPaisa + nagadPaisa + cardPaisa)));
  const remainingDuePaisa = Math.max(0, totalPaisa - totalPaidPaisa);

  const amountSetters: Record<TenderMethod, (v: string) => void> = {
    cash: setCashAmount,
    bkash: setBkashAmount,
    nagad: setNagadAmount,
    card: setCardAmount,
  };
  const amountValues: Record<TenderMethod, string> = {
    cash: cashAmount,
    bkash: bkashAmount,
    nagad: nagadAmount,
    card: cardAmount,
  };

  const clearAmounts = () => {
    setCashAmount('');
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
  };

  /** Switching tender moves the whole bill onto the new one, rather than
   *  leaving the old amount behind for the cashier to find and delete. */
  const selectMethod = (method: TenderMethod) => {
    setActiveMethod(method);
    clearAmounts();
    amountSetters[method]((totalPaisa / 100).toFixed(2));
  };

  const handleQuickCash = (amountTaka: number) => {
    setActiveMethod('cash');
    clearAmounts();
    setCashAmount(amountTaka.toString());
  };

  const handlePayExact = () => {
    clearAmounts();
    amountSetters[splitMode ? 'cash' : activeMethod]((totalPaisa / 100).toFixed(2));
    if (splitMode) setActiveMethod('cash');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalPaidPaisa <= 0 && totalPaisa > 0 && !customerId) {
      setError('Cannot complete an unpaid sale without selecting a registered customer.');
      return;
    }

    const payments: PaymentItem[] = [];
    if (cashPaisa > 0) payments.push({ method: 'cash', amount_paisa: cashPaisa });
    if (bkashPaisa > 0) payments.push({ method: 'bkash', amount_paisa: bkashPaisa, trx_id: bkashTrxId.trim() || undefined });
    if (nagadPaisa > 0) payments.push({ method: 'nagad', amount_paisa: nagadPaisa });
    if (cardPaisa > 0) payments.push({ method: 'card', amount_paisa: cardPaisa });

    if (payments.length === 0) {
      payments.push({ method: 'cash', amount_paisa: 0 });
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        customer_id: customerId || null,
        subtotal_paisa: subtotalPaisa,
        discount_paisa: discountPaisa,
        total_paisa: totalPaisa,
        items: cart.map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          unit_price_paisa: it.unit_price_paisa,
          discount_paisa: it.discount_paisa || 0,
        })),
        payments,
        total_paid_paisa: totalPaidPaisa,
        change_paisa: changePaisa,
        layout,
      };

      const result = await window.api.sales.create(payload);
      if (result.success) {
        onCompleteSale(result);
        onClose();
      } else {
        setError('Transaction failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Checkout failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-jungle-teal-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8">
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-muted-teal-100 text-muted-teal-700 rounded-xl border border-muted-teal-200">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-jungle-teal-900">Payment Checkout & Invoicing</h2>
              <p className="text-xs text-jungle-teal-600 font-mono">
                {cart.length} item{cart.length > 1 ? 's' : ''} · Total: ৳ {(totalPaisa / 100).toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-jungle-teal-600 hover:text-jungle-teal-900 rounded-lg hover:bg-jungle-teal-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Summary Box */}
          <div className="grid grid-cols-3 gap-3 bg-jungle-teal-100 p-4 rounded-xl border border-jungle-teal-200 text-center font-mono">
            <div>
              <span className="text-[11px] text-jungle-teal-600">Subtotal</span>
              <div className="text-base font-semibold text-jungle-teal-800">৳ {(subtotalPaisa / 100).toFixed(2)}</div>
            </div>
            <div>
              <span className="text-[11px] text-jungle-teal-600">Discount</span>
              <div className="text-base font-semibold text-amber-600">
                {discountPaisa > 0 ? `- ৳ ${(discountPaisa / 100).toFixed(2)}` : '৳ 0.00'}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-jungle-teal-600">Payable Total</span>
              <div className="text-xl font-bold text-azure-mist-700">৳ {(totalPaisa / 100).toFixed(2)}</div>
            </div>
          </div>

          {customerName && (
            <div className="text-[11px] text-jungle-teal-600 bg-jungle-teal-50 p-2.5 rounded-lg border border-jungle-teal-200 flex justify-between">
              <span>Customer: <strong className="text-jungle-teal-900">{customerName}</strong></span>
              {remainingDuePaisa > 0 && (
                <span className="text-amber-600 font-mono font-semibold">
                  Due to be recorded: ৳ {(remainingDuePaisa / 100).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Tender picker. One row of real buttons rather than four open
              amount boxes: the cashier says how the customer is paying, then
              types one number. */}
          <div>
            <label className="text-jungle-teal-600 font-medium block mb-1.5">Paying by</label>
            <div className="grid grid-cols-4 gap-2">
              {TENDERS.map((tender) => {
                const isActive = !splitMode && activeMethod === tender.id;
                return (
                  <button
                    key={tender.id}
                    type="button"
                    onClick={() => {
                      setSplitMode(false);
                      selectMethod(tender.id);
                    }}
                    className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-azure-mist-600 border-azure-mist-500 text-white'
                        : 'bg-jungle-teal-100 border-jungle-teal-200 text-jungle-teal-700 hover:border-azure-mist-600 hover:text-jungle-teal-900'
                    }`}
                  >
                    <span className="block">{tender.label}</span>
                    <span className={`block text-[10px] font-normal mt-0.5 ${isActive ? 'text-azure-mist-100' : 'text-jungle-teal-500'}`}>
                      {tender.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!splitMode && (
            <div>
              <label className="text-jungle-teal-600 font-medium block mb-1.5">
                {activeMethod === 'cash' ? 'Cash received from customer (৳)' : `${TENDERS.find((t) => t.id === activeMethod)?.label} amount (৳)`}
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  autoFocus
                  value={amountValues[activeMethod]}
                  onChange={(e) => amountSetters[activeMethod](e.target.value)}
                  placeholder="0.00"
                  className="flex-1 min-w-0 bg-jungle-teal-100 border-2 border-azure-mist-700 rounded-xl px-4 py-3 text-2xl text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-400"
                />
                <button
                  type="button"
                  onClick={handlePayExact}
                  className="shrink-0 px-4 rounded-xl border border-azure-mist-600 bg-azure-mist-50 hover:bg-azure-mist-100 text-azure-mist-800 font-bold text-xs transition-colors"
                  title="Fill in the exact bill amount"
                >
                  Exact
                  <span className="block font-mono text-[11px] font-normal mt-0.5">
                    ৳ {(totalPaisa / 100).toFixed(2)}
                  </span>
                </button>
              </div>

              {activeMethod === 'cash' && (
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {[500, 1000, 2000, 5000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickCash(val)}
                      className="py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 border border-jungle-teal-200 rounded-lg font-mono font-bold text-xs transition-colors"
                    >
                      ৳ {val}
                    </button>
                  ))}
                </div>
              )}

              {activeMethod === 'bkash' && (
                <input
                  type="text"
                  value={bkashTrxId}
                  onChange={(e) => setBkashTrxId(e.target.value)}
                  placeholder="bKash TrxID (optional)"
                  className="w-full mt-2 bg-white border border-jungle-teal-200 rounded-lg px-3 py-2 text-jungle-teal-700 font-mono text-[11px] focus:outline-hidden focus:border-pink-500"
                />
              )}
            </div>
          )}

          {/* Split stays available, but out of the way of the ordinary sale. */}
          <div>
            <button
              type="button"
              onClick={() => {
                const next = !splitMode;
                setSplitMode(next);
                if (next) clearAmounts();
                else selectMethod('cash');
              }}
              className="text-[11px] font-semibold text-azure-mist-700 hover:text-azure-mist-800 transition-colors"
            >
              {splitMode ? '← Back to a single payment' : 'Paying with more than one method?'}
            </button>
          </div>

          {splitMode && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                {/* Cash Input */}
                <div>
                  <label className="block text-jungle-teal-600 text-[11px] mb-1 font-medium flex items-center gap-1">
                    <Banknote className="w-3.5 h-3.5 text-muted-teal-700" /> Cash (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-jungle-teal-200 rounded-lg px-3 py-2 text-muted-teal-700 font-mono font-bold focus:outline-hidden focus:border-muted-teal-600"
                  />
                </div>

                {/* bKash Input */}
                <div>
                  <label className="block text-jungle-teal-600 text-[11px] mb-1 font-medium flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-pink-600" /> bKash (৳)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={bkashAmount}
                      onChange={(e) => setBkashAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full min-w-0 bg-white border border-jungle-teal-200 rounded-lg px-3 py-2 text-pink-600 font-mono font-bold focus:outline-hidden focus:border-pink-500"
                    />
                    <input
                      type="text"
                      value={bkashTrxId}
                      onChange={(e) => setBkashTrxId(e.target.value)}
                      placeholder="TrxID"
                      className="w-20 shrink-0 bg-white border border-jungle-teal-200 rounded-lg px-2 py-2 text-jungle-teal-700 font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* Nagad Input */}
                <div>
                  <label className="block text-jungle-teal-600 text-[11px] mb-1 font-medium flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-orange-600" /> Nagad (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={nagadAmount}
                    onChange={(e) => setNagadAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-jungle-teal-200 rounded-lg px-3 py-2 text-orange-600 font-mono font-bold focus:outline-hidden focus:border-orange-500"
                  />
                </div>

                {/* Card Input */}
                <div>
                  <label className="block text-jungle-teal-600 text-[11px] mb-1 font-medium flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Card / POS (৳)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-white border border-jungle-teal-200 rounded-lg px-3 py-2 text-blue-600 font-mono font-bold focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}


          {/* Change or Due Calculation Banner */}
          <div className="p-3.5 rounded-xl border flex items-center justify-between font-mono bg-jungle-teal-100 border-jungle-teal-200">
            <div>
              <span className="text-jungle-teal-600 text-[11px] block">Total Received</span>
              <span className="text-base font-bold text-jungle-teal-900">৳ {(totalPaidPaisa / 100).toFixed(2)}</span>
            </div>

            {changePaisa > 0 && (
              <div className="text-right">
                <span className="text-muted-teal-700 text-[11px] block font-semibold">Change to Return</span>
                <span className="text-xl font-extrabold text-muted-teal-700">৳ {(changePaisa / 100).toFixed(2)}</span>
              </div>
            )}

            {remainingDuePaisa > 0 && (
              <div className="text-right">
                <span className="text-rose-600 text-[11px] block font-semibold">
                  {customerId ? 'Customer Due (Baki)' : 'Unsettled Due'}
                </span>
                <span className="text-lg font-extrabold text-rose-600">৳ {(remainingDuePaisa / 100).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Warning Banner when Walk-in customer has Due */}
          {remainingDuePaisa > 0 && !customerId && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>A walk-in customer cannot be left with a due. Add a customer, or take the full payment.</span>
              </div>
              <button
                type="button"
                onClick={handlePayExact}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-lg text-[11px] whitespace-nowrap transition-colors self-end sm:self-auto cursor-pointer"
              >
                Pay Full (৳{(totalPaisa / 100).toFixed(0)})
              </button>
            </div>
          )}

          {/* Invoice Layout Choice */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-jungle-teal-600 text-[11px]">Invoice Format:</span>
            <div className="flex gap-2">
              {(['80mm', 'a4'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLayout(option)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    layout === option
                      ? 'bg-azure-mist-700 text-white border-azure-mist-600'
                      : 'bg-jungle-teal-100 text-jungle-teal-600 border-jungle-teal-200'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5" /> {option === '80mm' ? '80mm' : option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || cart.length === 0 || (remainingDuePaisa > 0 && !customerId)}
              className={`px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all font-bold text-sm ${
                remainingDuePaisa > 0 && !customerId
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed opacity-80'
                  : 'bg-muted-teal-700 hover:bg-muted-teal-600 text-white shadow-lg shadow-muted-teal-700/20 active:scale-95'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {loading
                ? 'Processing Sale...'
                : remainingDuePaisa > 0 && !customerId
                ? 'Customer Required for Due Sale'
                : 'Complete Sale & Print (F4)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
