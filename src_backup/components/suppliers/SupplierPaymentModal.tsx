import React, { useEffect, useRef, useState } from 'react';
import { Supplier } from '../../types/ipc';
import { Wallet, X, Check, AlertCircle } from 'lucide-react';
import { CashIcon, BkashIcon, NagadIcon, CardBankIcon } from '../pos/PosIcons';

type Method = 'cash' | 'bkash' | 'nagad' | 'card';

interface SupplierPaymentModalProps {
  supplier: Supplier;
  busy?: boolean;
  onSubmit: (amountTaka: number, method: Method, note: string | null) => void;
  onClose: () => void;
}

const METHODS: Array<{ id: Method; label: string; dot: string }> = [
  { id: 'cash', label: 'Cash', dot: '#3c5d4b' },
  { id: 'bkash', label: 'bKash', dot: '#D12053' },
  { id: 'nagad', label: 'Nagad', dot: '#F7941D' },
  { id: 'card', label: 'Card', dot: '#2563eb' },
];

export const SupplierPaymentModal: React.FC<SupplierPaymentModalProps> = ({
  supplier,
  busy = false,
  onSubmit,
  onClose,
}) => {
  const payablePaisa = supplier.total_payable_paisa || 0;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('cash');
  const [note, setNote] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  const amountPaisa = Math.round((parseFloat(amount) || 0) * 100);
  const overpaying = amountPaisa > payablePaisa;
  const canSave = amountPaisa > 0 && !overpaying && !busy;
  const remainingPaisa = Math.max(0, payablePaisa - amountPaisa);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl w-full max-w-md shadow-2xl text-jungle-teal-900 font-sans overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-jungle-teal-200">
          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-ui-lg font-semibold">Pay Supplier</h3>
            <p className="text-ui-xs text-jungle-teal-600 truncate">{supplier.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="ml-auto w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSubmit(parseFloat(amount), method, note.trim() || null);
          }}
          className="px-5 py-4 space-y-3.5"
        >
          <div className="flex items-center bg-jungle-teal-900 text-white px-4 py-2.5 rounded-xl">
            <span className="text-ui-xs text-jungle-teal-300">Outstanding payable</span>
            <span className="ml-auto font-mono text-ui-2xl font-semibold leading-none">
              ৳ {(payablePaisa / 100).toFixed(2)}
            </span>
          </div>

          <label className="block">
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
              Amount paying (৳)
            </span>
            <div className="mt-1 flex items-center gap-2">
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && onClose()}
                placeholder="0.00"
                className="flex-1 min-w-0 h-11 px-3 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl text-ui-base font-mono font-semibold focus:outline-hidden focus:border-azure-mist-600"
              />
              <button
                type="button"
                onClick={() => setAmount((payablePaisa / 100).toFixed(2))}
                className="h-11 px-3 shrink-0 rounded-xl border border-jungle-teal-200 text-ui-xs font-medium text-jungle-teal-700 hover:bg-jungle-teal-100 transition-colors"
              >
                Pay all
              </button>
            </div>
          </label>

          <div>
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
              Paid by
            </span>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`h-[40px] rounded-xl border flex items-center justify-center gap-1.5 text-ui-xs font-medium transition-colors ${
                    method === m.id
                      ? 'border-azure-mist-700 bg-azure-mist-50 text-azure-mist-800'
                      : 'border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: m.dot }}
                  />
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
              Note (optional)
            </span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. cheque no. 4471"
              className="mt-1 w-full h-[40px] px-3 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl text-ui-sm placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
            />
          </label>

          {overpaying && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-3 py-2 text-ui-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                That is more than the outstanding ৳ {(payablePaisa / 100).toFixed(2)}. Paying more
                than is owed would leave the supplier balance wrong.
              </span>
            </div>
          )}

          {amountPaisa > 0 && !overpaying && (
            <p className="text-ui-xs text-jungle-teal-600">
              Payable after this payment:{' '}
              <span className="font-mono font-semibold text-jungle-teal-900">
                ৳ {(remainingPaisa / 100).toFixed(2)}
              </span>
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="ml-auto h-[40px] px-4 rounded-xl text-ui-sm font-medium text-jungle-teal-700 hover:bg-jungle-teal-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="h-[40px] px-4 bg-muted-teal-700 hover:bg-muted-teal-800 text-white font-medium rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{busy ? 'Saving…' : 'Record payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
