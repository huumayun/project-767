import React, { useState } from 'react';
import {
  Wrench,
  Store,
  Shield,
  Printer,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Check,
  Cloud,
  Database,
  Download,
  Mail,
  Terminal,
  X,
  Code2
} from 'lucide-react';

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onCompleted: () => void;
}

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onCompleted: () => void;
}

const DeveloperModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0c1613]/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-[850px] max-h-[92vh] overflow-y-auto relative border border-white/70 rounded-[30px] bg-[#f8fbf9]/95 shadow-[0_30px_90px_rgba(0,0,0,0.3)] p-6 md:p-8 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute right-5 top-5 w-10 h-10 rounded-full bg-[#edf3f0] text-[#49625a] flex items-center justify-center hover:bg-[#dfeae5] hover:rotate-90 transition-all focus:outline-hidden"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center px-4 md:px-11 pb-8 pt-2">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#e7f8ed] to-[#d9efe2] border border-[#b7dfc7] text-[#268052] shadow-[0_10px_25px_rgba(35,120,76,0.13)]">
            <Code2 className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#15231f] tracking-tight m-0">Built by GraamTech</h1>
          <p className="mt-2 mx-auto max-w-[580px] text-[#71827c] text-[14px] leading-relaxed">
            Crafted with care, clean engineering and a focus on making everyday software simple, fast and reliable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Dev 1: Rakibul Ahsan Antor */}
          <div className="relative overflow-hidden border border-[#d8e4df] rounded-[24px] p-6 bg-white shadow-[0_12px_30px_rgba(35,57,49,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(35,57,49,0.13)]">
            <div className="absolute w-[150px] h-[150px] -right-[70px] -top-[70px] rounded-full bg-[#eef8f2]" />
            
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-[62px] h-[62px] shrink-0 flex items-center justify-center rounded-[18px] text-white font-black text-[19px] bg-gradient-to-br from-[#287c51] to-[#165b3b] shadow-[0_8px_20px_rgba(27,102,64,0.22)]">
                RA
              </div>
              <div>
                <h2 className="text-[19px] font-[850] text-[#15231f] m-0 leading-tight">Rakibul Ahsan Antor</h2>
                <div className="text-[#5f8975] text-[12px] font-extrabold uppercase tracking-wide mt-1">Lead Developer</div>
              </div>
            </div>

            <p className="relative z-10 my-5 text-[#6a7b75] text-[13px] leading-[1.65]">
              Full-stack developer focused on application architecture, UI/UX, performance and delivering reliable offline-first software.
            </p>

            <div className="relative z-10 grid gap-2.5 mt-auto">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#f5f8f6] text-[#395149] text-[12px]">
                <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-[#e4f3ea] text-[#26734b]">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="truncate">hello.rhantor@gmail.com</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#f5f8f6] text-[#395149] text-[12px]">
                <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-[#e4f3ea] text-[#26734b]">
                  <Terminal className="w-4 h-4" />
                </div>
                <span>Frontend • Backend • UI/UX</span>
              </div>
            </div>
          </div>

          {/* Dev 2: Humayun Ahmed */}
          <div className="relative overflow-hidden border border-[#d8e4df] rounded-[24px] p-6 bg-white shadow-[0_12px_30px_rgba(35,57,49,0.08)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(35,57,49,0.13)]">
            <div className="absolute w-[150px] h-[150px] -right-[70px] -top-[70px] rounded-full bg-[#eef8f2]" />
            
            <div className="relative z-10 flex items-center gap-4">
              <div className="w-[62px] h-[62px] shrink-0 flex items-center justify-center rounded-[18px] text-white font-black text-[19px] bg-gradient-to-br from-[#287c51] to-[#165b3b] shadow-[0_8px_20px_rgba(27,102,64,0.22)]">
                HA
              </div>
              <div>
                <h2 className="text-[19px] font-[850] text-[#15231f] m-0 leading-tight">Humayun Ahmed</h2>
                <div className="text-[#5f8975] text-[12px] font-extrabold uppercase tracking-wide mt-1">Software Developer</div>
              </div>
            </div>

            <p className="relative z-10 my-5 text-[#6a7b75] text-[13px] leading-[1.65]">
              Developer focused on backend systems, database architecture, integrations and building smooth, maintainable software experiences.
            </p>

            <div className="relative z-10 grid gap-2.5 mt-auto">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#f5f8f6] text-[#395149] text-[12px]">
                <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-[#e4f3ea] text-[#26734b]">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="truncate">huumayunahmed@gmail.com</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#f5f8f6] text-[#395149] text-[12px]">
                <div className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg bg-[#e4f3ea] text-[#26734b]">
                  <Terminal className="w-4 h-4" />
                </div>
                <span>Backend • Database • API</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-6 text-[#87958f] text-[11px] font-semibold tracking-wide">
          © {new Date().getFullYear()} • GraamTech Development Team
        </div>
      </div>
    </div>
  );
};

export const FirstRunWizardModal: React.FC<FirstRunWizardModalProps> = ({
  isOpen,
  onCompleted,
}) => {
  const [showDevModal, setShowDevModal] = useState(false);
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 'restore' | 'local-preview' | 'recovery'>(0);
  const [localBackupPreview, setLocalBackupPreview] = useState<{ path: string; name: string; size: number; date: string } | null>(null);
  // Shown once, after setup writes it. Held only for as long as it is on screen.
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);

  // Form State
  const [shopName, setShopName] = useState('My Fatema Electronics');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('Dhaka, Bangladesh');
  const [deviceIdPrefix, setDeviceIdPrefix] = useState('REG01');
  const [defaultInvoiceLayout, setDefaultInvoiceLayout] = useState<'80mm' | 'a4'>('80mm');
  // Deliberately blank: prefilling the seeded password is what let shops finish
  // setup still using owner/owner123.
  const [ownerName, setOwnerName] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('owner');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerPasswordConfirm, setOwnerPasswordConfirm] = useState('');
  /*
   * Off, and offered only in a development build.
   *
   * This box used to come ticked, in the installed app as much as anywhere, so
   * a shop that clicked straight through setup started trading with ten fake
   * parts, three fake customers and two fake suppliers in its books.
   */
  const [seedDemoData, setSeedDemoData] = useState(false);
  const [sampleDataAvailable, setSampleDataAvailable] = useState(false);
  React.useEffect(() => {
    if (!isOpen) return;
    window.api?.app
      ?.info?.()
      .then((info) => setSampleDataAvailable(Boolean(info?.sampleDataAvailable)))
      .catch(() => setSampleDataAvailable(false));
  }, [isOpen]);

  const ownerPasswordError = (() => {
    if (!ownerUsername.trim() || ownerUsername.trim().length < 3) return 'Username must be at least 3 characters.';
    if (!ownerPassword) return null;
    if (ownerPassword.trim().length < 6) return 'Use at least 6 characters for password.';
    if (ownerPassword.trim() === 'owner123') return 'Pick something other than the default password.';
    if (ownerPasswordConfirm && ownerPassword !== ownerPasswordConfirm) return 'The two passwords do not match.';
    return null;
  })();
  const ownerPasswordReady =
    ownerUsername.trim().length >= 3 &&
    ownerPassword.trim().length >= 6 &&
    ownerPassword.trim() !== 'owner123' &&
    ownerPassword === ownerPasswordConfirm;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore State
  const [authCode, setAuthCode] = useState('');
  const [restoreStep, setRestoreStep] = useState<1 | 2>(1);

  if (!isOpen) return null;

  const handleFinishWizard = async () => {
    if (!shopName.trim()) {
      setError('Please enter a workshop or store name.');
      return;
    }
    if (!window.api) return;

    setLoading(true);
    setError(null);
    try {
      // 1. Optionally seed demo electronics items first, so it doesn't get blocked by auth
      if (seedDemoData && sampleDataAvailable) {
        await window.api.demo.seed();
      }

      // 2. Complete wizard (this locks the system and requires auth for future calls)
      const res = await window.api.wizard.completeFirstRun({
        shop_name: shopName.trim(),
        shop_address: shopAddress.trim(),
        shop_phone: shopPhone.trim(),
        device_id_prefix: deviceIdPrefix.trim() || 'REG01',
        default_invoice_layout: defaultInvoiceLayout,
        owner_name: ownerName.trim() || shopName.trim(), // fallback to shop name
        owner_username: ownerUsername.trim(),
        owner_password: ownerPassword.trim(),
      });

      if (res?.recoveryCodes?.length) {
        setRecoveryCodes(res.recoveryCodes);
        setStep('recovery');
      } else {
        onCompleted();
      }
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartRestore = async () => {
    if (!window.api?.gdrive) {
      setError("Google Drive API is not available.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await window.api.gdrive.getAuthUrl();
      if (result?.autoHandled) {
        if (result.success) {
          // Auto-authorized successfully, start download
          await window.api.gdrive.restoreLatest();
        } else {
          setError(result.error || 'Authorization failed or cancelled.');
          setLoading(false);
        }
      } else {
        // Fallback for old behaviour (just in case)
        setRestoreStep(2);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize Google Drive authentication.");
      setLoading(false);
    }
  };

  const handleVerifyAndRestore = async () => {
    if (!window.api?.gdrive || !authCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Authorize with code
      const authRes = await window.api.gdrive.authorize(authCode);
      if (!authRes.success) {
        throw new Error('Authorization failed. Invalid code.');
      }

      // 2. Download and restore latest backup
      // This IPC handler will relaunch the app upon success
      await window.api.gdrive.restoreLatest();
    } catch (err: any) {
      setError('Failed to restore from Drive: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center p-4 overflow-y-auto">
      {/* Abstract Background for Wizard */}
      <div className="fixed inset-0 bg-[#eef5ef] pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[70%] bg-[#dceddf] rounded-full blur-[120px] opacity-80" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-[#d3e5d7] rounded-full blur-[140px] opacity-70" />
      </div>

      <div className="bg-white/70 backdrop-blur-3xl border border-white/60 rounded-[32px] sm:rounded-[36px] max-w-xl w-full p-6 sm:p-8 shadow-[0_20px_40px_-15px_rgba(40,62,50,0.1)] text-[#1a2e22] space-y-5 sm:space-y-6 animate-in fade-in zoom-in duration-300 relative z-10 shrink-0 my-auto">
        {/* Header with Icon */}
        <div className="text-center space-y-2.5">
          <div className="w-14 h-14 bg-[#ebf5ed] text-[#3c5d4b] border border-[#dceddf] rounded-[20px] mx-auto flex items-center justify-center shadow-xs">
            <Wrench className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h2 className="text-[22px] sm:text-2xl font-black tracking-tight text-[#112017]">
            Welcome to Fatema Electronics POS
          </h2>
          <div className="space-y-3">
            <p className="text-[12px] sm:text-[13px] text-[#4d715b] font-medium">
              First-Run Quick Configuration Wizard <span className="mx-1">•</span> Offline-First System
            </p>
            <div className="w-10 h-1 bg-[#517b64]/40 rounded-full mx-auto" />
          </div>
        </div>

        {/* Step Indicator */}
        {typeof step === 'number' && step > 0 && (
          <div className="flex items-center justify-center gap-2">
            <div
              className={`w-8 h-2 rounded-full transition-all ${
                step >= 1 ? 'bg-[#517b64]' : 'bg-[#dceddf]'
              }`}
            />
            <div
              className={`w-8 h-2 rounded-full transition-all ${
                step >= 2 ? 'bg-[#517b64]' : 'bg-[#dceddf]'
              }`}
            />
            <div
              className={`w-8 h-2 rounded-full transition-all ${
                step >= 3 ? 'bg-[#517b64]' : 'bg-[#dceddf]'
              }`}
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* STEP 0: Choose Path */}
        {step === 0 && (
          <div className="space-y-5 pt-2">
            <button
              onClick={() => setStep(1)}
              className="w-full p-3.5 bg-white/80 backdrop-blur-md border border-white hover:border-[#bde3cb] rounded-[24px] flex items-center gap-4 transition-all hover:shadow-[0_10px_20px_-10px_rgba(81,123,100,0.2)] hover:-translate-y-0.5 group"
            >
              <div className="p-3 bg-[#e8f7ed] text-[#2d7a46] rounded-[16px] group-hover:scale-105 transition-transform">
                <Store className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-[16px] text-[#112017] leading-tight">Start a New Shop</h3>
                <p className="text-[12px] text-[#638772] mt-0.5 font-medium">Set up a brand new workspace with fresh data</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#e8f7ed] flex items-center justify-center group-hover:bg-[#d1f0dc] transition-colors shrink-0">
                <ArrowRight className="w-4 h-4 text-[#2d7a46]" />
              </div>
            </button>

            <button
              onClick={() => setStep('restore')}
              className="w-full p-3.5 bg-white/80 backdrop-blur-md border border-white hover:border-[#c5daf7] rounded-[24px] flex items-center gap-4 transition-all hover:shadow-[0_10px_20px_-10px_rgba(59,130,246,0.2)] hover:-translate-y-0.5 group"
            >
              <div className="p-3 bg-[#eff5ff] text-[#2563eb] rounded-[16px] group-hover:scale-105 transition-transform">
                <Cloud className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-[16px] text-[#112017] leading-tight">Restore from Google Drive</h3>
                <p className="text-[12px] text-[#638772] mt-0.5 font-medium">Recover your previous data and settings from the cloud</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#eff5ff] flex items-center justify-center group-hover:bg-[#dbeafe] transition-colors shrink-0">
                <ArrowRight className="w-4 h-4 text-[#2563eb]" />
              </div>
            </button>

            <button
              onClick={async () => {
                if (!window.api) return;
                try {
                  const file = await window.api.backup.selectFile();
                  if (file) {
                    setLoading(true);
                    const info = await window.api.backup.getFileInfo(file);
                    setLocalBackupPreview({ ...info, path: file });
                    setStep('local-preview');
                    setLoading(false);
                  }
                } catch(err: any) {
                  setError('Failed to select backup: ' + err.message);
                  setLoading(false);
                }
              }}
              className="w-full p-3.5 bg-white/80 backdrop-blur-md border border-white hover:border-[#e9d5ff] rounded-[24px] flex items-center gap-4 transition-all hover:shadow-[0_10px_20px_-10px_rgba(168,85,247,0.2)] hover:-translate-y-0.5 group"
            >
              <div className="p-3 bg-[#f8f5ff] text-[#9333ea] rounded-[16px] group-hover:scale-105 transition-transform">
                <Database className="w-6 h-6 stroke-[2]" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-[16px] text-[#112017] leading-tight">Restore from Local File</h3>
                <p className="text-[12px] text-[#638772] mt-0.5 font-medium">Select a backup file (.db) from your computer</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-[#f8f5ff] flex items-center justify-center group-hover:bg-[#f3e8ff] transition-colors shrink-0">
                <ArrowRight className="w-4 h-4 text-[#9333ea]" />
              </div>
            </button>
          </div>
        )}

        {/* RECOVERY CODE STEP - setup is already saved by the time this shows,
            so there is no way back and no way to skip past it unacknowledged. */}
        {step === 'recovery' && recoveryCodes && (
          <div className="space-y-4">
            <div className="text-center space-y-1.5">
              <CheckCircle2 className="w-10 h-10 text-muted-teal-600 mx-auto" />
              <h3 className="font-bold text-lg text-jungle-teal-900">Setup complete</h3>
              <p className="text-xs text-jungle-teal-600 leading-relaxed max-w-sm mx-auto">
                One last thing. This shop runs entirely on this computer - there is no server that
                can email you a password reset. If the owner password is ever forgotten, these codes
                are the way back in. Each one works once.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                Recovery codes
              </p>

              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {recoveryCodes.map((code, i) => (
                  <li
                    key={code}
                    className="flex items-baseline gap-2 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5"
                  >
                    <span className="text-[10px] font-mono text-amber-700 shrink-0">{i + 1}.</span>
                    <code className="font-mono text-sm font-bold tracking-wider text-jungle-teal-900">
                      {code}
                    </code>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.api) return;
                    try {
                      await window.api.settings.exportRecoveryCodes(recoveryCodes);
                    } catch {
                      // Saving is a convenience; the codes are on screen either way.
                    }
                  }}
                  className="flex items-center gap-1.5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white text-[11px] font-semibold py-1.5 px-3 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download as .txt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(recoveryCodes.join('\n'));
                    setRecoveryCopied(true);
                  }}
                  className="flex items-center gap-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-semibold py-1.5 px-3 rounded-lg transition-colors"
                >
                  {recoveryCopied ? <Check className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{recoveryCopied ? 'Copied' : 'Copy all'}</span>
                </button>
              </div>

              <p className="text-[11px] text-amber-800 leading-relaxed">
                Keep them on paper, away from the counter. They are stored hashed, so this is the
                only time they can be read - after this screen, nobody can look them up.
              </p>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-jungle-teal-700 cursor-pointer">
              <input
                type="checkbox"
                checked={recoveryAcknowledged}
                onChange={(e) => setRecoveryAcknowledged(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-azure-mist-700"
              />
              <span>I have saved the recovery codes somewhere safe.</span>
            </label>

            <button
              type="button"
              disabled={!recoveryAcknowledged}
              onClick={onCompleted}
              className="w-full bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-40"
            >
              Start using the POS
            </button>
          </div>
        )}

        {/* RESTORE STEP */}
        {step === 'restore' && (
          <div className="space-y-4 pt-2 w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[#f4f7f6] border border-[#d3dfd8] p-6 rounded-[20px] space-y-4 text-center shadow-xs">
              <Sparkles className="w-8 h-8 text-[#3a6552] mx-auto mb-1 stroke-[2]" />
              <h3 className="font-extrabold text-[17px] text-[#1a2f24] tracking-tight">Google Drive Smart Recovery</h3>
              
              {restoreStep === 1 ? (
                <>
                  <p className="text-[12px] text-[#6d8a7b] leading-relaxed pb-3 px-2">
                    Connect your Google Drive account. We'll find your latest backup and restore your entire POS system exactly as you left it.
                  </p>
                  <button
                    onClick={handleStartRestore}
                    disabled={loading}
                    className="w-full px-6 py-3 bg-[#3a6552] hover:bg-[#2c4e3f] disabled:bg-[#86a394] text-white font-bold rounded-[12px] shadow-[0_8px_20px_-8px_rgba(58,101,82,0.4)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center"
                  >
                    {loading ? <span className="animate-pulse">Connecting...</span> : 'Connect Google Drive'}
                  </button>
                </>
              ) : (
                <div className="text-left space-y-4 pt-2">
                  <div className="bg-white p-4 rounded-[14px] border border-[#d3dfd8] shadow-xs">
                    <p className="text-[11px] text-[#557362] font-semibold space-y-2">
                      <span className="block flex gap-2"><strong className="text-[#3a6552]">1.</strong> A browser window opened. Sign in and grant permission.</span>
                      <span className="block flex gap-2"><strong className="text-[#3a6552]">2.</strong> Copy the entire URL from the address bar of that page.</span>
                      <span className="block flex gap-2"><strong className="text-[#3a6552]">3.</strong> Paste it here to verify and start downloading your backup.</span>
                    </p>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      placeholder="Paste full link (http://localhost/?code=...) here"
                      className="w-full bg-white border border-[#d3dfd8] rounded-[12px] px-3.5 py-3 text-[12px] font-medium text-[#1a2f24] focus:border-[#3a6552] focus:ring-1 focus:ring-[#3a6552]/20 focus:outline-hidden transition-shadow"
                    />
                  </div>
                  <button
                    onClick={handleVerifyAndRestore}
                    disabled={loading || !authCode}
                    className="w-full px-6 py-3 bg-[#3a6552] hover:bg-[#2c4e3f] disabled:bg-[#86a394] text-white font-bold rounded-[12px] shadow-[0_8px_20px_-8px_rgba(58,101,82,0.4)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <span className="animate-pulse">Restoring... Please wait...</span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Verify & Restore Now</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={loading}
                className="text-[12px] text-[#718d7f] hover:text-[#3a6552] font-bold tracking-wide transition-colors disabled:opacity-50 cursor-pointer focus:outline-hidden"
              >
                Cancel and go back
              </button>
            </div>
          </div>
        )}

        {/* LOCAL RESTORE PREVIEW */}
        {step === 'local-preview' && localBackupPreview && (
          <div className="space-y-4 pt-2 w-full max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-[#f4f7f6] border border-[#d3dfd8] p-6 rounded-[20px] space-y-4 text-center shadow-xs">
              <Database className="w-8 h-8 text-[#7c3aed] mx-auto mb-1 stroke-[2]" />
              <h3 className="font-extrabold text-[17px] text-[#1a2f24] tracking-tight">Confirm Local Restore</h3>
              
              <div className="text-left bg-white p-4 rounded-[14px] border border-[#d3dfd8] shadow-xs space-y-2.5">
                <p className="text-[12px] text-[#557362] leading-relaxed">
                  You are about to restore your POS system from the following backup file. Proceeding will replace your current data.
                </p>
                <div className="bg-[#f8faf9] p-2.5 rounded-lg border border-[#e1e9e4]">
                  <p className="text-[10px] text-[#86a394] font-bold uppercase tracking-wider mb-0.5">Backup File Name</p>
                  <p className="text-[12px] text-[#1a2f24] font-bold font-mono break-all">{localBackupPreview.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-[#f8faf9] p-2.5 rounded-lg border border-[#e1e9e4]">
                    <p className="text-[10px] text-[#86a394] font-bold uppercase tracking-wider mb-0.5">Date Created</p>
                    <p className="text-[12px] text-[#1a2f24] font-bold">{new Date(localBackupPreview.date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <div className="bg-[#f8faf9] p-2.5 rounded-lg border border-[#e1e9e4]">
                    <p className="text-[10px] text-[#86a394] font-bold uppercase tracking-wider mb-0.5">File Size</p>
                    <p className="text-[12px] text-[#1a2f24] font-bold">{(localBackupPreview.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!window.api) return;
                  setLoading(true);
                  try {
                    await window.api.backup.restoreLocalFile(localBackupPreview.path);
                    // App automatically restarts here
                  } catch (err: any) {
                    setError('Restore failed: ' + err.message);
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full px-6 py-3.5 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:bg-[#c4b5fd] text-white font-bold rounded-[14px] shadow-[0_8px_20px_-8px_rgba(124,58,237,0.4)] transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="animate-pulse">Restoring... Please wait...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Confirm & Restore Now</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={loading}
                className="text-[12px] text-[#718d7f] hover:text-[#7c3aed] font-bold tracking-wide transition-colors disabled:opacity-50 cursor-pointer focus:outline-hidden"
              >
                Cancel and go back
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Store Information */}
        {step === 1 && (
          <div className="space-y-4 text-xs">
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl space-y-3">
              <div>
                <label className="block text-jungle-teal-700 font-bold mb-1">
                  Workshop / Store Name *
                </label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Master Anis Auto Parts & Workshop"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 text-sm font-semibold focus:outline-hidden focus:border-azure-mist-600"
                />
              </div>

              <div>
                <label className="block text-jungle-teal-700 font-bold mb-1">
                  Contact Phone Numbers
                </label>
                <input
                  type="text"
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  placeholder="01711-000000, 01811-000000"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600"
                />
              </div>

              <div>
                <label className="block text-jungle-teal-700 font-bold mb-1">
                  Store / Workshop Address
                </label>
                <input
                  type="text"
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                  placeholder="e.g. 142 Tejgaon Link Road, Dhaka"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600"
                />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!shopName.trim()) {
                    setError('Please enter workshop name.');
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="px-6 py-2.5 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-colors"
              >
                <span>Next: Hardware & POS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Device & Printer Setup */}
        {step === 2 && (
          <div className="space-y-4 text-xs">
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl space-y-3">
              <div>
                <label className="block text-jungle-teal-700 font-bold mb-1">
                  Default Invoice Layout Format
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div
                    onClick={() => setDefaultInvoiceLayout('80mm')}
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all select-none ${
                      defaultInvoiceLayout === '80mm'
                        ? 'bg-azure-mist-50 border-azure-mist-600 shadow-xs'
                        : 'bg-jungle-teal-50 border-jungle-teal-200 hover:border-jungle-teal-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Printer className="w-4 h-4 text-azure-mist-700" />
                      {defaultInvoiceLayout === '80mm' && (
                        <Check className="w-4 h-4 text-azure-mist-700" />
                      )}
                    </div>
                    <span className="font-bold text-xs text-jungle-teal-900">80mm Thermal</span>
                    <span className="text-[10px] text-jungle-teal-500">POS roll slip receipt</span>
                  </div>

                  <div
                    onClick={() => setDefaultInvoiceLayout('a4')}
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all select-none ${
                      defaultInvoiceLayout === 'a4'
                        ? 'bg-azure-mist-50 border-azure-mist-600 shadow-xs'
                        : 'bg-jungle-teal-50 border-jungle-teal-200 hover:border-jungle-teal-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Printer className="w-4 h-4 text-azure-mist-700" />
                      {defaultInvoiceLayout === 'a4' && (
                        <Check className="w-4 h-4 text-azure-mist-700" />
                      )}
                    </div>
                    <span className="font-bold text-xs text-jungle-teal-900">A4 Sales Invoice</span>
                    <span className="text-[10px] text-jungle-teal-500">Full-page memo for trade customers</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-jungle-teal-700 font-bold mb-1">
                  POS Counter Device Identifier Prefix
                </label>
                <input
                  type="text"
                  value={deviceIdPrefix}
                  onChange={(e) => setDeviceIdPrefix(e.target.value.toUpperCase())}
                  placeholder="REG01"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold uppercase focus:outline-hidden focus:border-azure-mist-600"
                />
                <span className="text-[10px] text-jungle-teal-400 mt-1 block">
                  Invoice format: INV-{deviceIdPrefix}-YYYYMMDD-XXXX
                </span>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-colors"
              >
                <span>Next: Security & Seed</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Owner Password & Demo Data Toggle */}
        {step === 3 && (
          <div className="space-y-4 text-xs">
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl space-y-3">
              <div>
                <label className="block text-jungle-teal-700 font-bold mb-1">
                  Master Owner Account
                </label>
                <input
                  type="text"
                  required
                  value={ownerUsername}
                  onChange={(e) => setOwnerUsername(e.target.value)}
                  placeholder="Username (e.g. owner)"
                  className="w-full bg-white border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 font-bold mb-2"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Password (At least 6 characters)"
                  className="w-full bg-white border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 font-bold mb-2"
                />
                <input
                  type="password"
                  required
                  value={ownerPasswordConfirm}
                  onChange={(e) => setOwnerPasswordConfirm(e.target.value)}
                  placeholder="Type password again to confirm"
                  className="w-full bg-white border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 font-bold"
                />
                {ownerPasswordError && (
                  <span className="text-[11px] text-rose-600 font-semibold mt-1.5 block">
                    {ownerPasswordError}
                  </span>
                )}
                <span className="text-[10px] text-jungle-teal-500 mt-2 block">
                  You can choose your own custom username for the main owner account. This replaces the temporary setup account.
                </span>
              </div>

              {/* Sample data - development builds only */}
              {sampleDataAvailable && (
                <div className="p-3.5 bg-jungle-teal-50 border border-dashed border-jungle-teal-300 rounded-xl flex items-start gap-3 mt-2">
                  <input
                    type="checkbox"
                    id="seedDemo"
                    checked={seedDemoData}
                    onChange={(e) => setSeedDemoData(e.target.checked)}
                    className="mt-0.5 rounded-sm bg-jungle-teal-100 border-jungle-teal-300 text-azure-mist-700 focus:ring-0"
                  />
                  <div>
                    <label htmlFor="seedDemo" className="font-bold text-jungle-teal-900 cursor-pointer block">
                      Load sample data <span className="font-normal text-jungle-teal-500">(development build only)</span>
                    </label>
                    <p className="text-[11px] text-jungle-teal-500 mt-0.5">
                      10 parts with stock, 3 customers and 2 suppliers, for trying the app out. Leave this off for a real shop.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold"
              >
                Back
              </button>
              <button
                type="button"
                disabled={loading || !ownerPasswordReady}
                onClick={handleFinishWizard}
                className="px-6 py-2.5 bg-muted-teal-700 hover:bg-muted-teal-600 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Initializing POS...' : 'Complete & Launch POS'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Software Provider Footer */}
      <div className="mt-8 text-center relative z-10 shrink-0 animate-in fade-in duration-700">
        <button 
          onClick={() => setShowDevModal(true)} 
          className="text-[13px] text-[#517b64] font-bold tracking-[0.05em] uppercase hover:text-[#287c51] transition-colors cursor-pointer focus:outline-hidden"
        >
          Software by GraamTech
        </button>
      </div>

      <DeveloperModal isOpen={showDevModal} onClose={() => setShowDevModal(false)} />
    </div>
  );
};
