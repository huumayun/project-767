import React, { useState } from 'react';
import { UserSession } from '../../types/ipc';
import { Wrench, Lock, User, Key, Eye, EyeOff, ShieldCheck, Zap } from 'lucide-react';
import { translations } from '../../i18n/translations';
import { PasswordRecoveryModal } from './PasswordRecoveryModal';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
  onSwitchToPinLogin?: () => void;
  shopName?: string;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onSwitchToPinLogin, shopName }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  const t = translations;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api) {
      // Opened in a plain browser (the Vite dev URL) rather than in Electron:
      // there is no database behind this page, so say how to start the real app.
      setError(
        'Web Browser Mode: This is an Electron desktop app! To use the SQLite database and hardware integrations, please run "npm run electron:dev" or "npm start" in your terminal.'
      );
      return;
    }

    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await window.api.auth.login({ username: username.trim(), password: password.trim() });
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setError(res.error || ('Invalid username or password.'));
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex flex-col justify-center items-center bg-linear-to-br from-jungle-teal-50 via-jungle-teal-100 to-azure-mist-50 text-jungle-teal-900 p-4 relative overflow-hidden select-none">
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-azure-mist-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full z-10">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-white text-azure-mist-700 border border-azure-mist-200 rounded-3xl mb-4 shadow-lg shadow-azure-mist-900/10">
            <Wrench className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-jungle-teal-900 font-sans">
            Fatema Electronics POS
          </h1>
          <p className="text-xs text-jungle-teal-700 mt-1 font-mono">
            Offline-First Desktop Terminal · Bangladesh
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-jungle-teal-200 rounded-3xl p-7 shadow-xl shadow-jungle-teal-900/5">
          <div className="flex items-center gap-2 mb-6 border-b border-jungle-teal-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-azure-mist-600" />
            <h2 className="text-sm font-bold text-jungle-teal-700 uppercase tracking-wider font-mono">
              {t.loginTitle}
            </h2>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
              <Lock className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-jungle-teal-700 mb-1.5 font-sans">
                {t.usernameLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-jungle-teal-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  autoFocus
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-200 text-jungle-teal-900 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-azure-mist-500 focus:border-transparent transition-all placeholder:text-jungle-teal-400 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-jungle-teal-700 mb-1.5 font-sans">
                {t.passwordLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-jungle-teal-400">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-200 text-jungle-teal-900 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-azure-mist-500 focus:border-transparent transition-all placeholder:text-jungle-teal-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-jungle-teal-400 hover:text-jungle-teal-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={() => setShowRecovery(true)}
                className="text-[11px] text-jungle-teal-600 hover:text-azure-mist-800 font-medium transition-colors"
              >
                {'Forgot password?'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-bold py-3 rounded-xl shadow-lg shadow-azure-mist-800/20 transition-all transform active:scale-[0.99] disabled:opacity-50 text-sm mt-2 font-sans"
            >
              {loading ? ('Verifying...') : t.loginButton}
            </button>

            {onSwitchToPinLogin && (
              <div className="pt-4 mt-2 border-t border-jungle-teal-100">
                <button
                  type="button"
                  onClick={onSwitchToPinLogin}
                  className="w-full flex items-center justify-center gap-1.5 bg-azure-mist-50 hover:bg-azure-mist-100 border border-azure-mist-200 hover:border-azure-mist-300 text-azure-mist-800 font-semibold text-xs py-2.5 rounded-xl transition-all transform active:scale-[0.99]"
                >
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span>Quick PIN Login</span>
                </button>
              </div>
            )}
          </form>
        </div>

      </div>

      {/* Security Assurance Footer. Outside the max-w-md column: at this root
          font size that column is ~360px and the line needs ~370px, so keeping
          it inside wrapped "Enabled" onto a line of its own. */}
      <div className="relative z-10 mt-6 text-[11px] text-jungle-teal-700 font-mono flex items-center justify-center gap-2 whitespace-nowrap">
        <Lock className="w-3 h-3 shrink-0 text-muted-teal-600" />
        <span>Role-Based Access Control (RBAC) & Scrypt/Bcrypt Enabled</span>
      </div>

      <PasswordRecoveryModal
        isOpen={showRecovery}
        onClose={() => setShowRecovery(false)}
        onRecovered={(recoveredUsername) => {
          setShowRecovery(false);
          setUsername(recoveredUsername);
          setPassword('');
          setError(null);
        }}
      />
    </div>
  );
};
