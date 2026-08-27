import React from 'react';
import { UserSession } from '../types/ipc';
import { Shield, LogOut, Lock } from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface AuthBannerProps {
  currentSession: UserSession | null;
  onLogout: () => void;
  lang: Language;
  onLanguageToggle: () => void;
}

export const AuthBanner: React.FC<AuthBannerProps> = ({
  currentSession,
  onLogout,
  lang,
  onLanguageToggle,
}) => {
  const t = translations[lang];

  return (
    <div className="bg-jungle-teal-900 border-b border-jungle-teal-800 text-jungle-teal-100 px-4 sm:px-6 py-2 flex items-center justify-between text-xs flex-wrap gap-2">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 font-medium text-jungle-teal-400">
          <Shield className="w-4 h-4 text-azure-mist-400" />
          <span>{t.activeRole}:</span>
        </span>
        {currentSession ? (
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[11px] font-mono ${
                currentSession.role === 'owner'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-azure-mist-600/20 text-azure-mist-300 border border-azure-mist-600/40'
              }`}
            >
              {currentSession.role === 'owner' ? t.ownerRole : t.staffRole} ({currentSession.name})
            </span>
            <span className="hidden md:inline text-jungle-teal-400 text-[11px]">
              • {currentSession.role === 'owner' ? t.ownerDesc : t.staffDesc}
            </span>
          </div>
        ) : (
          <span className="text-rose-400 font-semibold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Authentication Required
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Language Toggle */}
        <button
          onClick={onLanguageToggle}
          className="px-2.5 py-1 rounded-lg bg-jungle-teal-800 hover:bg-jungle-teal-700 border border-jungle-teal-700 text-[11px] font-semibold text-jungle-teal-200 transition-colors flex items-center gap-1"
        >
          <span>🌐</span>
          <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
        </button>

        {currentSession && (
          <button
            onClick={onLogout}
            className="flex items-center gap-1 bg-jungle-teal-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 text-jungle-teal-300 px-3 py-1 rounded-lg border border-jungle-teal-700 transition-all font-sans"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.logout}</span>
          </button>
        )}
      </div>
    </div>
  );
};
