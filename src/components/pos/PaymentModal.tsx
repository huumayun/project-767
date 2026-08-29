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
  const [layout, setLayout] = useState<'80mm' | 'a5'>('80mm');

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

  const handleQuickCash = (amountTaka: number) => {
    setCashAmount(amountTaka.toString());
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
  };

  const handlePayExact = () => {
    setCashAmount((totalPaisa / 100).toFixed(2));
    setBkashAmount('');
    setNagadAmount('');
    setCardAmount('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/85 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-900 border border-jungle-teal-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-100 my-8">
        <div className="flex items-center justify-between border-b border-jungle-teal-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-muted-teal-600/10 text-muted-teal-400 rounded-xl border border-muted-teal-600/20">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Payment Checkout & Invoicing</h2>
              <p className="text-xs text-jungle-teal-400 font-mono">
                {cart.length} item{cart.length > 1 ? 's' : ''} · Total: ৳ {(totalPaisa / 100).toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-jungle-teal-400 hover:text-white rounded-lg hover:bg-jungle-teal-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Summary Box */}
          <div className="grid grid-cols-3 gap-3 bg-jungle-teal-950 p-4 rounded-xl border border-jungle-teal-800 text-center font-mono">
            <div>
              <span className="text-[11px] text-jungle-teal-400">Subtotal</span>
              <div className="text-base font-semibold text-jungle-teal-200">৳ {(subtotalPaisa / 100).toFixed(2)}</div>
            </div>
            <div>
              <span className="text-[11px] text-jungle-teal-400">Discount</span>
              <div className="text-base font-semibold text-amber-400">
                {discountPaisa > 0 ? `- ৳ ${(discountPaisa / 100).toFixed(2)}` : '৳ 0.00'}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-jungle-teal-400">Payable Total</span>
              <div className="text-xl font-bold text-azure-mist-400">৳ {(totalPaisa / 100).toFixed(2)}</div>
            </div>
          </div>

          {customerName && (
            <div className="text-[11px] text-jungle-teal-400 bg-jungle-teal-800/60 p-2.5 rounded-lg border border-jungle-teal-700 flex justify-between">
              <span>Customer: <strong className="text-white">{customerName}</strong></span>
              {remainingDuePaisa > 0 && (
                <span className="text-amber-400 font-mono font-semibold">
                  Due to be recorded: ৳ {(remainingDuePaisa / 100).toFixed(2)}
                </span>
              )}
            </div>
          )}

          {/* Quick Tender Cash Buttons */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-jungle-teal-400 font-medium">Quick Tender Options</label>
              <button
                type="button"
                onClick={handlePayExact}
                className="text-azure-mist-400 hover:underline text-[11px] font-semibold"
              >
                Exact Amount (৳ {(totalPaisa / 100).toFixed(2)})
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[500, 1000, 2000, 5000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickCash(val)}
                  className="py-2 bg-jungle-teal-800 hover:bg-jungle-teal-700 text-jungle-teal-200 border border-jungle-teal-700 rounded-lg font-mono font-bold text-xs transition-colors"
                >
                  ৳ {val}
                </button>
              ))}
            </div>
          </div>

          {/* Split Payment Methods */}
          <div className="space-y-3 pt-1">
            <span className="text-jungle-teal-300 text-xs font-semibold block">Split Payment Methods:</span>

            <div className="grid grid-cols-2 gap-3">
              {/* Cash Input */}
              <div>
                <label className="block text-jungle-teal-400 text-[11px] mb-1 font-medium flex items-center gap-1">
                  <Banknote className="w-3.5 h-3.5 text-muted-teal-400" /> Cash Tendered (৳)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-jungle-teal-900 border border-jungle-teal-800 rounded-lg px-3 py-2 text-muted-teal-400 font-mono font-bold focus:outline-hidden focus:border-muted-teal-600"
                />
              </div>

              {/* bKash Input */}
              <div>
                <label className="block text-jungle-teal-400 text-[11px] mb-1 font-medium flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-pink-400" /> bKash Payment (৳)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={bkashAmount}
                    onChange={(e) => setBkashAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-jungle-teal-900 border border-jungle-teal-800 rounded-lg px-3 py-2 text-pink-400 font-mono font-bold focus:outline-hidden focus:border-pink-500"
                  />
                  <input
                    type="text"
                    value={bkashTrxId}
                    onChange={(e) => setBkashTrxId(e.target.value)}
                    placeholder="TrxID (opt)"
                    className="w-28 bg-jungle-teal-900 border border-jungle-teal-800 rounded-lg px-2 py-2 text-jungle-teal-300 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Nagad Input */}
              <div>
                <label className="block text-jungle-teal-400 text-[11px] mb-1 font-medium flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-orange-400" /> Nagad Payment (৳)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={nagadAmount}
                  onChange={(e) => setNagadAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-jungle-teal-900 border border-jungle-teal-800 rounded-lg px-3 py-2 text-orange-400 font-mono font-bold focus:outline-hidden focus:border-orange-500"
                />
              </div>

              {/* Card Input */}
              <div>
                <label className="block text-jungle-teal-400 text-[11px] mb-1 font-medium flex items-center gap-1">
                  <CreditCard className="w-3.5 h-3.5 text-blue-400" /> Card / POS (৳)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-jungle-teal-900 border border-jungle-teal-800 rounded-lg px-3 py-2 text-blue-400 font-mono font-bold focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Change or Due Calculation Banner */}
          <div className="p-3.5 rounded-xl border flex items-center justify-between font-mono bg-jungle-teal-950 border-jungle-teal-800">
            <div>
              <span className="text-jungle-teal-400 text-[11px] block">Total Received</span>
              <span className="text-base font-bold text-white">৳ {(totalPaidPaisa / 100).toFixed(2)}</span>
            </div>

            {changePaisa > 0 && (
              <div className="text-right">
                <span className="text-muted-teal-400 text-[11px] block font-semibold">Change to Return</span>
                <span className="text-xl font-extrabold text-muted-teal-400">৳ {(changePaisa / 100).toFixed(2)}</span>
              </div>
            )}

            {remainingDuePaisa > 0 && (
              <div className="text-right">
                <span className="text-rose-400 text-[11px] block font-semibold">
                  {customerId ? 'Customer Due (Baki)' : 'Unsettled Due'}
                </span>
                <span className="text-lg font-extrabold text-rose-400">৳ {(remainingDuePaisa / 100).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Warning Banner when Walk-in customer has Due */}
          {remainingDuePaisa > 0 && !customerId && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>খুচরা কাস্টমারের জন্য বাকি রাখা যাবে না। কাস্টমার যুক্ত করুন অথবা পূর্ণ টাকা পরিশোধ করুন।</span>
              </div>
              <button
                type="button"
                onClick={handlePayExact}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[11px] whitespace-nowrap transition-colors self-end sm:self-auto cursor-pointer"
              >
                Pay Full (৳{(totalPaisa / 100).toFixed(0)})
              </button>
            </div>
          )}

          {/* Invoice Layout Choice */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-jungle-teal-400 text-[11px]">Invoice Format:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLayout('80mm')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  layout === '80mm'
                    ? 'bg-azure-mist-700 text-white border-azure-mist-600'
                    : 'bg-jungle-teal-800 text-jungle-teal-400 border-jungle-teal-700'
                }`}
              >
                <Printer className="w-3.5 h-3.5" /> 80mm
              </button>

              <button
                type="button"
                onClick={() => setLayout('a5')}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  layout === 'a5'
                    ? 'bg-azure-mist-700 text-white border-azure-mist-600'
                    : 'bg-jungle-teal-800 text-jungle-teal-400 border-jungle-teal-700'
                }`}
              >
                <Printer className="w-3.5 h-3.5" /> A5
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-jungle-teal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-jungle-teal-800 hover:bg-jungle-teal-700 text-jungle-teal-300 font-medium rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || cart.length === 0 || (remainingDuePaisa > 0 && !customerId)}
              className={`px-6 py-2.5 rounded-xl flex items-center gap-2 transition-all font-bold text-sm ${
                remainingDuePaisa > 0 && !customerId
                  ? 'bg-amber-900/50 text-amber-300 border border-amber-700/50 cursor-not-allowed opacity-80'
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
