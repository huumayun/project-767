import React, { useState, useEffect } from 'react';
import { Lock, Delete, KeyRound, ShieldCheck, UserCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { UserSession } from '../../types/ipc';

interface PinLoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  onSwitchToPasswordLogin: () => void;
  shopName?: string;
}

export const PinLoginScreen: React.FC<PinLoginScreenProps> = ({
  onLoginSuccess,
  onSwitchToPasswordLogin,
  shopName = 'Mechanical Parts & POS',
}) => {
  const [pin, setPin] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const handleDigit = (digit: string) => {
    if (loading) return;
    setError(null);
    if (pin.length < 6) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length >= 4) {
        attemptPinLogin(nextPin);
      }
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setError(null);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (loading) return;
    setError(null);
    setPin('');
  };

  const attemptPinLogin = async (pinCode: string) => {
    if (!window.api || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await window.api.auth.pinLogin({ pin: pinCode });
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        triggerError(res.error || 'Invalid PIN');
      }
    } catch (err: any) {
      triggerError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const triggerError = (msg: string) => {
    setError(msg);
    setShake(true);
    setPin('');
    setTimeout(() => setShake(false), 500);
  };

  // Listen to physical keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, loading]);

  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <div className="min-h-screen bg-linear-to-br from-jungle-teal-50 via-jungle-teal-100 to-azure-mist-50 text-jungle-teal-900 flex flex-col items-center justify-center p-4 select-none font-sans relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-muted-teal-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-azure-mist-200/50 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm flex flex-col items-center space-y-6 relative z-10">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-white border border-azure-mist-200 shadow-lg shadow-azure-mist-900/10 mb-1">
            <Lock className="w-8 h-8 text-azure-mist-700" />
          </div>
          <h1 className="text-xl font-extrabold text-jungle-teal-900 tracking-tight">{shopName}</h1>
          <p className="text-xs text-jungle-teal-700">Enter your 4-digit PIN to sign in</p>
        </div>

        {/* PIN Indicators Dots */}
        <div className={`flex items-center gap-4 py-2 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                pin.length > index
                  ? 'bg-azure-mist-700 shadow-md shadow-azure-mist-800/30 scale-125 border border-azure-mist-800'
                  : 'bg-jungle-teal-200 border border-jungle-teal-300'
              }`}
            />
          ))}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="w-full p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Touch-Friendly Numpad */}
        <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
          {numpadKeys.map((key) => {
            const isClear = key === 'C';
            const isBackspace = key === '⌫';
            return (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => {
                  if (isClear) handleClear();
                  else if (isBackspace) handleDelete();
                  else handleDigit(key);
                }}
                className={`h-16 rounded-2xl font-mono text-xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-xs border ${
                  isClear || isBackspace
                    ? 'bg-jungle-teal-50 hover:bg-jungle-teal-100 text-jungle-teal-700 hover:text-jungle-teal-900 border-jungle-teal-200 text-sm'
                    : 'bg-white hover:bg-azure-mist-50 text-jungle-teal-900 hover:text-azure-mist-800 border-jungle-teal-200 hover:border-azure-mist-300'
                }`}
              >
                {isBackspace ? <Delete className="w-5 h-5" /> : key}
              </button>
            );
          })}
        </div>

        {/* Alternative Password Login. Mirrors the Quick PIN button on the
            password screen, and sits at the numpad's width so the column of
            controls keeps one edge. */}
        <div className="pt-2 w-full max-w-[280px] mx-auto">
          <button
            type="button"
            onClick={onSwitchToPasswordLogin}
            className="w-full flex items-center justify-center gap-1.5 whitespace-nowrap bg-white hover:bg-azure-mist-50 border border-azure-mist-200 hover:border-azure-mist-300 text-azure-mist-800 font-semibold text-xs py-2.5 rounded-xl shadow-xs transition-all transform active:scale-[0.99]"
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" />
            <span>Password Login</span>
          </button>
        </div>

      </div>
    </div>
  );
};
