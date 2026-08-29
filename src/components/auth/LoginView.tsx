import React, { useState } from 'react';
import { UserSession } from '../../types/ipc';
import { Wrench, Lock, User, Key, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Language, translations } from '../../i18n/translations';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
  lang: Language;
  onLanguageToggle: () => void;
  onSwitchToPinLogin?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, lang, onLanguageToggle, onSwitchToPinLogin }) => {
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api) return;

    if (!username.trim() || !password.trim()) {
      setError(lang === 'bn' ? 'ইউজারনেম এবং পাসওয়ার্ড পূরণ করুন' : 'Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await window.api.auth.login({ username: username.trim(), password: password.trim() });
      if (res.success && res.session) {
        onLoginSuccess(res.session);
      } else {
        setError(res.error || (lang === 'bn' ? 'লগইন ব্যর্থ হয়েছে। সঠিক তথ্য দিন।' : 'Invalid username or password.'));
      }
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-center items-center bg-linear-to-br from-jungle-teal-950 via-jungle-teal-900 to-jungle-teal-950 text-jungle-teal-100 p-4 relative overflow-hidden select-none">
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-azure-mist-700/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Language Switcher in Top Corner */}
      <div className="absolute top-6 right-6">
        <button
          onClick={onLanguageToggle}
          className="px-3 py-1.5 rounded-xl bg-jungle-teal-800/80 hover:bg-jungle-teal-700 border border-jungle-teal-700 text-xs font-semibold text-jungle-teal-200 transition-all flex items-center gap-1.5 shadow-xs"
        >
          <span>🌐</span>
          <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
        </button>
      </div>

      <div className="max-w-md w-full z-10">
        {/* Branding Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-azure-mist-600/10 text-azure-mist-400 border border-azure-mist-600/30 rounded-3xl mb-4 shadow-xl shadow-azure-mist-950/50">
            <Wrench className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">
            Mechanical Shop POS
          </h1>
          <p className="text-xs text-jungle-teal-400 mt-1 font-mono">
            Offline-First Desktop Terminal · Bangladesh
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-jungle-teal-900/90 border border-jungle-teal-800 rounded-3xl p-7 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-6 border-b border-jungle-teal-800 pb-3">
            <ShieldCheck className="w-5 h-5 text-azure-mist-400" />
            <h2 className="text-sm font-bold text-jungle-teal-200 uppercase tracking-wider font-mono">
              {t.loginTitle}
            </h2>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
              <Lock className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-jungle-teal-300 mb-1.5 font-sans">
                {t.usernameLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-jungle-teal-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="owner / staff"
                  required
                  autoFocus
                  className="w-full bg-jungle-teal-950/80 border border-jungle-teal-700 text-jungle-teal-100 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-azure-mist-600 focus:border-transparent transition-all placeholder:text-jungle-teal-600 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-jungle-teal-300 mb-1.5 font-sans">
                {t.passwordLabel}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-jungle-teal-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-jungle-teal-950/80 border border-jungle-teal-700 text-jungle-teal-100 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-hidden focus:ring-2 focus:ring-azure-mist-600 focus:border-transparent transition-all placeholder:text-jungle-teal-600 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-jungle-teal-500 hover:text-jungle-teal-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-azure-mist-700 to-azure-mist-600 hover:from-azure-mist-600 hover:to-azure-mist-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-azure-mist-700/30 transition-all transform active:scale-[0.99] disabled:opacity-50 text-sm mt-2 font-sans"
            >
              {loading ? (lang === 'bn' ? 'যাচাই করা হচ্ছে...' : 'Verifying...') : t.loginButton}
            </button>

            {onSwitchToPinLogin && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={onSwitchToPinLogin}
                  className="text-xs text-azure-mist-400 hover:text-white font-semibold transition-colors py-1 px-3 rounded-lg hover:bg-jungle-teal-800"
                >
                  ⚡ ৪-ডিজিট পিন দিয়ে দ্রুত লগইন (Quick PIN Login)
                </button>
              </div>
            )}
          </form>

          {/* Quick Credential Hints for Convenience */}
          <div className="mt-6 pt-4 border-t border-jungle-teal-800/80 text-center">
            <p className="text-[11px] text-jungle-teal-400 font-mono mb-2">Default Terminal Credentials:</p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('owner');
                  setPassword('owner123');
                }}
                className="px-2.5 py-1 bg-jungle-teal-800/70 hover:bg-jungle-teal-800 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-mono transition-colors"
              >
                Owner: owner / owner123
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsername('staff');
                  setPassword('staff123');
                }}
                className="px-2.5 py-1 bg-jungle-teal-800/70 hover:bg-jungle-teal-800 text-azure-mist-300 border border-azure-mist-600/30 rounded-lg text-[10px] font-mono transition-colors"
              >
                Staff: staff / staff123
              </button>
            </div>
          </div>
        </div>

        {/* Security Assurance Footer */}
        <div className="text-center mt-6 text-[11px] text-jungle-teal-400 font-mono flex items-center justify-center gap-2">
          <Lock className="w-3 h-3 text-muted-teal-400" />
          <span>Role-Based Access Control (RBAC) & Scrypt/Bcrypt Enabled</span>
        </div>
      </div>
    </div>
  );
};
