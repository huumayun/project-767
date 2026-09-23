import React, { useEffect, useState } from 'react';
import { Supplier, SupplierLedger } from '../../types/ipc';
import { BookOpen, X, AlertCircle, RefreshCw, ShoppingCart, Wallet } from 'lucide-react';

interface SupplierLedgerModalProps {
  supplier: Supplier;
  onClose: () => void;
}

const money = (paisa: number) => `৳ ${(paisa / 100).toFixed(2)}`;

export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({ supplier, onClose }) => {
  const [ledger, setLedger] = useState<SupplierLedger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      setLedger(await window.api.suppliers.getLedger(supplier.id));
    } catch (err: any) {
      setError(err?.message || 'Could not load this ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const rows = ledger?.rows || [];
  const totalBilled = rows.reduce((sum, r) => sum + r.debit_paisa, 0);
  const totalSettled = rows.reduce((sum, r) => sum + r.credit_paisa, 0);
  const totalTransport = rows.reduce((sum, r) => sum + (r.transport_paisa || 0), 0);
  const closing = ledger?.closing_balance_paisa || 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl w-full max-w-3xl max-h-[88vh] shadow-2xl text-jungle-teal-900 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-jungle-teal-200 shrink-0">
          <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-ui-lg font-semibold truncate">{supplier.name}</h3>
            <p className="text-ui-xs text-jungle-teal-600">
              Payable ledger &mdash; every invoice and payment, oldest first
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            title="Reload"
            className="ml-auto w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-500 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-px bg-jungle-teal-200 border-b border-jungle-teal-200 shrink-0">
          {[
            { label: 'Opening', value: money(ledger?.opening_balance_paisa || 0), tone: 'text-jungle-teal-700' },
            { label: 'Billed', value: money(totalBilled), tone: 'text-jungle-teal-900' },
            { label: 'Settled', value: money(totalSettled), tone: 'text-muted-teal-800' },
            {
              label: 'Balance now',
              value: money(closing),
              tone: closing > 0 ? 'text-rose-700' : 'text-muted-teal-800',
            },
          ].map((k) => (
            <div key={k.label} className="bg-jungle-teal-50 px-4 py-2.5">
              <p className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
                {k.label}
              </p>
              <p className={`font-mono text-ui-base font-semibold whitespace-nowrap ${k.tone}`}>
                {k.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {error && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-ui-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && !ledger && (
            <p className="p-8 text-center text-ui-sm text-jungle-teal-500">Loading ledger…</p>
          )}

          {!loading && !error && rows.length === 0 && (
            <div className="p-10 text-center">
              <BookOpen className="w-8 h-8 mx-auto text-jungle-teal-300" />
              <p className="mt-2 text-ui-sm text-jungle-teal-600">
                No purchases or payments recorded for this vendor yet.
              </p>
            </div>
          )}

          {rows.length > 0 && (
            <table className="w-full text-left text-ui-sm border-collapse">
              <thead className="sticky top-0 bg-jungle-teal-100 text-jungle-teal-600 uppercase text-ui-2xs font-semibold tracking-wider border-b border-jungle-teal-200">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Entry</th>
                  <th className="px-3 py-2 text-right">Billed (৳)</th>
                  <th className="px-3 py-2 text-right">Settled (৳)</th>
                  <th className="px-3 py-2 text-right">Balance (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-jungle-teal-100">
                <tr className="h-[42px] bg-jungle-teal-50">
                  <td className="px-3 text-jungle-teal-500 font-mono text-ui-xs">&mdash;</td>
                  <td className="px-3 text-jungle-teal-600 italic">Opening balance</td>
                  <td className="px-3" />
                  <td className="px-3" />
                  <td className="px-3 text-right font-mono font-semibold text-jungle-teal-700 whitespace-nowrap">
                    {money(ledger?.opening_balance_paisa || 0)}
                  </td>
                </tr>

                {rows.map((r) => (
                  <tr key={r.id} className="h-[46px] hover:bg-azure-mist-50/40 transition-colors">
                    <td className="px-3 font-mono text-ui-xs text-jungle-teal-600 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 shrink-0 rounded flex items-center justify-center ${
                            r.kind === 'purchase'
                              ? 'bg-azure-mist-50 text-azure-mist-700'
                              : 'bg-muted-teal-50 text-muted-teal-800'
                          }`}
                        >
                          {r.kind === 'purchase' ? (
                            <ShoppingCart className="w-3 h-3" />
                          ) : (
                            <Wallet className="w-3 h-3" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="font-semibold text-jungle-teal-900">{r.label}</span>
                          {r.transport_paisa > 0 && (
                            <span className="ml-1.5 text-ui-2xs text-amber-700 font-mono whitespace-nowrap">
                              incl. {money(r.transport_paisa)} transport
                            </span>
                          )}
                          {r.note && (
                            <span className="block text-ui-2xs text-jungle-teal-500 truncate">
                              {r.note}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 text-right font-mono whitespace-nowrap text-jungle-teal-900">
                      {r.debit_paisa > 0 ? money(r.debit_paisa) : '—'}
                    </td>
                    <td className="px-3 text-right font-mono whitespace-nowrap text-muted-teal-800">
                      {r.credit_paisa > 0 ? money(r.credit_paisa) : '—'}
                    </td>
                    <td
                      className={`px-3 text-right font-mono font-semibold whitespace-nowrap ${
                        r.balance_paisa > 0 ? 'text-rose-700' : 'text-jungle-teal-500'
                      }`}
                    >
                      {money(r.balance_paisa)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-jungle-teal-200 flex items-center gap-3 shrink-0 bg-jungle-teal-100/60">
          <p className="text-ui-xs text-jungle-teal-600">
            {rows.length} {rows.length === 1 ? 'entry' : 'entries'}
            {totalTransport > 0 && (
              <span className="text-amber-700"> &middot; {money(totalTransport)} transport billed</span>
            )}
          </p>
          <p className="ml-auto text-ui-sm font-semibold">
            Closing balance{' '}
            <span
              className={`font-mono ml-1 ${closing > 0 ? 'text-rose-700' : 'text-muted-teal-800'}`}
            >
              {money(closing)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};
