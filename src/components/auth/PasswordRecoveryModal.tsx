import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldAlert, Check, LifeBuoy } from 'lucide-react';

interface PasswordRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the recovered username so the login form can be prefilled. */
  onRecovered: (username: string) => void;
}

const copy = {
  title: 'Forgot your password?',
  intro: 'Enter any one of the recovery codes from your setup sheet, then choose a new owner password.',
  codeLabel: 'Recovery code',
  newLabel: 'New owner password',
  confirmLabel: 'Confirm new password',
  submit: 'Reset password',
  cancel: 'Cancel',
  working: 'Checking...',
  mismatch: 'The two passwords do not match.',
  tooShort: 'The new password must be at least 6 characters.',
  noCode: 'There are no unused recovery codes on this computer, so there is nothing to check against.',
  noCodeHelp:
    'The database can still be recovered on this machine. Ask whoever installed the app to run the reset tool for you.',
  doneTitle: 'Password changed',
  doneUser: 'Sign in with this username',
  doneSpent: 'That code has been used up and will not work again.',
  doneRemaining: (n: number) => `${n} recovery ${n === 1 ? 'code' : 'codes'} left on your sheet.`,
  doneLast: 'That was your last code. Generate a new sheet from Settings once you are signed in.',
  done: 'Go to sign in',
};

export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  isOpen,
  onClose,
  onRecovered,
}) => {
  const t = copy;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ username: string; remaining: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCode('');
    setPassword('');
    setConfirm('');
    setError(null);
    setResult(null);
    setAvailable(null);
    window.api?.auth
      .recoveryAvailable()
      .then((res) => setAvailable(res.available))
      .catch(() => setAvailable(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api) return;

    if (password.length < 6) {
      setError(t.tooShort);
      return;
    }
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await window.api.auth.resetWithRecoveryCode({ code, newPassword: password });
      if (res.success && res.username) {
        setResult({ username: res.username, remaining: res.codesRemaining ?? 0 });
      } else {
        setError(res.error || 'Could not reset the password.');
      }
    } catch (err: any) {
      // The main process throws rather than returns for a lockout, so the wait
      // time reaches the owner instead of a generic failure.
      setError(err?.message || 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-jungle-teal-50 border border-jungle-teal-200 text-jungle-teal-900 rounded-xl px-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-azure-mist-500 focus:border-transparent transition-all placeholder:text-jungle-teal-400 font-mono';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 animate-in zoom-in-95 duration-200">
        {result ? (
          <>
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 rounded-2xl shrink-0 bg-muted-teal-100 text-muted-teal-700 border border-muted-teal-200">
                <Check className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold mb-1.5">{t.doneTitle}</h3>
                <p className="text-xs text-jungle-teal-600 leading-relaxed">{t.doneUser}</p>
                <p className="mt-1 font-mono text-sm font-bold text-jungle-teal-900">{result.username}</p>
              </div>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                result.remaining === 0 ? 'border-rose-200 bg-rose-50' : 'border-amber-300 bg-amber-50'
              }`}
            >
              <p
                className={`text-[11px] font-semibold leading-relaxed ${
                  result.remaining === 0 ? 'text-rose-800' : 'text-amber-900'
                }`}
              >
                {t.doneSpent}
              </p>
              <p
                className={`text-[11px] leading-relaxed mt-1 ${
                  result.remaining === 0 ? 'text-rose-700' : 'text-amber-800'
                }`}
              >
                {result.remaining === 0 ? t.doneLast : t.doneRemaining(result.remaining)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onRecovered(result.username)}
              className="w-full mt-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {t.done}
            </button>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-5">
              <div className="p-3 rounded-2xl shrink-0 bg-azure-mist-100 text-azure-mist-700 border border-azure-mist-200">
                <KeyRound className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold mb-1.5">{t.title}</h3>
                <p className="text-xs text-jungle-teal-600 leading-relaxed">{t.intro}</p>
              </div>
            </div>

            {available === false && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-4 flex items-start gap-2.5">
                <LifeBuoy className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-900 font-semibold leading-relaxed">{t.noCode}</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed mt-1">{t.noCodeHelp}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-jungle-teal-700 mb-1.5">{t.codeLabel}</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  autoFocus
                  required
                  disabled={available === false}
                  className={`${inputClass} tracking-wider uppercase disabled:opacity-50`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-jungle-teal-700 mb-1.5">{t.newLabel}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={available === false}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-jungle-teal-700 mb-1.5">{t.confirmLabel}</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={available === false}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>

              <div className="flex gap-2.5 pt-1.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white hover:bg-jungle-teal-100 border border-jungle-teal-200 text-jungle-teal-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading || available === false}
                  className="flex-1 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-bold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? t.working : t.submit}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
