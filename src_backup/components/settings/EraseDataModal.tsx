import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { BusinessDataCounts } from '../../types/ipc';

interface EraseDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onErased: (result: { backupFile: string; erased: BusinessDataCounts }) => void;
}

const CONFIRM_WORD = 'ERASE';

/**
 * The only way to erase a shop's business data, and deliberately slow.
 *
 * It replaces a generic "are you sure" box, which confirmed on Enter - so after
 * one click on the red button, the next habitual Enter at a counter deleted the
 * shop's entire history. Here the owner sees exactly what will go, types their
 * password and the word ERASE, and no key press alone can finish it. The main
 * process checks both again and writes a full backup before deleting anything.
 */
export const EraseDataModal: React.FC<EraseDataModalProps> = ({ isOpen, onClose, onErased }) => {
  const [counts, setCounts] = useState<(BusinessDataCounts & { cloudSyncConfigured: boolean }) | null>(null);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
    setConfirmText('');
    setError(null);
    setBusy(false);
    setCounts(null);
    window.api?.data
      ?.counts()
      .then(setCounts)
      .catch((err: any) => setError(err?.message || 'Could not read what is in the database.'));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    // Escape closes. Enter is deliberately left alone - see above.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const ready = password.length > 0 && confirmText.trim().toUpperCase() === CONFIRM_WORD && !busy;

  const handleErase = async () => {
    if (!ready || !window.api?.data) return;
    setBusy(true);
    setError(null);
    try {
      const res = await window.api.data.erase({ password, confirmText });
      onErased({ backupFile: res.backupFile, erased: res.erased });
    } catch (err: any) {
      setError(err?.message || 'Nothing was erased.');
      setBusy(false);
    }
  };

  const rows: Array<[string, number | undefined]> = [
    ['Sales', counts?.sales],
    ['Purchases', counts?.purchases],
    ['Products', counts?.products],
    ['Customers', counts?.customers],
    ['Suppliers', counts?.suppliers],
    ['Shifts', counts?.shifts],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="erase-title"
        className="bg-jungle-teal-50 border border-rose-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-jungle-teal-900 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-2xl shrink-0 bg-rose-100 text-rose-600 border border-rose-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 id="erase-title" className="text-base font-bold text-jungle-teal-900">
              Erase all business data
            </h3>
            <p className="text-xs text-jungle-teal-600 leading-relaxed mt-1">
              For clearing practice sales and test stock before the shop starts using the till for real.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="p-1 text-jungle-teal-500 hover:text-jungle-teal-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <span className="font-bold text-rose-900 block mb-1.5">Will be erased</span>
            <ul className="space-y-0.5 font-mono text-rose-800">
              {rows.map(([label, n]) => (
                <li key={label} className="flex justify-between gap-2">
                  <span className="font-sans">{label}</span>
                  <span>{n === undefined ? '…' : n.toLocaleString('en-US')}</span>
                </li>
              ))}
            </ul>
            <span className="block text-[11px] text-rose-700 mt-1.5">
              …with every payment, return, due and stock record that belongs to them.
            </span>
          </div>
          <div className="rounded-xl border border-jungle-teal-200 bg-white p-3">
            <span className="font-bold text-jungle-teal-900 block mb-1.5">Kept</span>
            <ul className="space-y-0.5 text-jungle-teal-700">
              <li>Staff logins and PINs</li>
              <li>Shop settings and print layout</li>
              <li>The audit log</li>
              <li>All existing backups</li>
            </ul>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
          <span>
            A full backup is saved to the backups folder first. If it cannot be saved, nothing is erased. It can be
            restored from <b>Backups</b> like any other.
          </span>
        </div>

        {counts?.cloudSyncConfigured && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <span>
              Cloud sync is set up. This erases the data on this computer only — the copy already sent to the cloud
              stays there and has to be cleared separately.
            </span>
          </div>
        )}

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">
              Your owner password
            </span>
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              className="w-full h-10 bg-white border border-jungle-teal-200 rounded-xl px-3 text-ui-sm focus:outline-hidden focus:border-rose-500"
            />
          </label>
          <label className="block">
            <span className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">
              Type <span className="font-mono text-rose-700">{CONFIRM_WORD}</span> to confirm
            </span>
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              placeholder={CONFIRM_WORD}
              className="w-full h-10 bg-white border border-jungle-teal-200 rounded-xl px-3 text-ui-sm font-mono tracking-widest focus:outline-hidden focus:border-rose-500"
            />
          </label>
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800">
            {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2.5 pt-4 border-t border-jungle-teal-100">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-xs font-semibold text-jungle-teal-700 bg-jungle-teal-100 hover:bg-jungle-teal-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleErase}
            disabled={!ready}
            className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {busy ? 'Backing up and erasing…' : 'Back up and erase'}
          </button>
        </div>
      </div>
    </div>
  );
};
