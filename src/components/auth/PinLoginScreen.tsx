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
        triggerError(res.error || 'ভুল পিন নম্বর (Invalid PIN)');
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
    <div className="min-h-screen bg-jungle-teal-950 flex flex-col items-center justify-center p-4 select-none font-sans relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-muted-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-azure-mist-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm flex flex-col items-center space-y-6 relative z-10">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-linear-to-b from-muted-teal-700/80 to-jungle-teal-900 border border-muted-teal-500/30 text-white shadow-xl mb-1">
            <Lock className="w-8 h-8 text-azure-mist-300" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight">{shopName}</h1>
          <p className="text-xs text-jungle-teal-300">দ্রুত লগইন করতে ৪ ডিজিট পিন চাপুন (Enter PIN)</p>
        </div>

        {/* PIN Indicators Dots */}
        <div className={`flex items-center gap-4 py-2 ${shake ? 'animate-shake' : ''}`}>
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full transition-all duration-200 ${
                pin.length > index
                  ? 'bg-azure-mist-400 shadow-md shadow-azure-mist-400/50 scale-125 border border-white'
                  : 'bg-jungle-teal-800/80 border border-jungle-teal-700'
              }`}
            />
          ))}
        </div>

        {/* Error Notification */}
        {error && (
          <div className="w-full p-2.5 bg-rose-950/80 border border-rose-700 rounded-xl text-rose-300 text-xs flex items-center justify-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
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
                className={`h-16 rounded-2xl font-mono text-xl font-bold flex items-center justify-center transition-all active:scale-95 shadow-md border ${
                  isClear || isBackspace
                    ? 'bg-jungle-teal-900/60 hover:bg-jungle-teal-800 text-jungle-teal-400 hover:text-white border-jungle-teal-800 text-sm'
                    : 'bg-jungle-teal-900/90 hover:bg-muted-teal-800 text-white hover:text-azure-mist-200 border-jungle-teal-800 hover:border-muted-teal-600'
                }`}
              >
                {isBackspace ? <Delete className="w-5 h-5" /> : key}
              </button>
            );
          })}
        </div>

        {/* Alternative Password Login Link */}
        <div className="pt-2 w-full text-center">
          <button
            type="button"
            onClick={onSwitchToPasswordLogin}
            className="text-xs text-jungle-teal-400 hover:text-azure-mist-300 font-semibold transition-colors flex items-center justify-center gap-1.5 mx-auto py-1.5 px-3 rounded-lg hover:bg-jungle-teal-900"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>ইউজারনেম ও পাসওয়ার্ড দিয়ে লগইন (Password Login)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
