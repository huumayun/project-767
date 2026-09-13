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
} from 'lucide-react';

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onCompleted: () => void;
}

export const FirstRunWizardModal: React.FC<FirstRunWizardModalProps> = ({
  isOpen,
  onCompleted,
}) => {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 'restore' | 'recovery'>(0);
  // Shown once, after setup writes it. Held only for as long as it is on screen.
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);

  // Form State
  const [shopName, setShopName] = useState('My Mechanical Workshop');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('Dhaka, Bangladesh');
  const [deviceIdPrefix, setDeviceIdPrefix] = useState('REG01');
  const [defaultInvoiceLayout, setDefaultInvoiceLayout] = useState<'80mm' | 'a4'>('80mm');
  // Deliberately blank: prefilling the seeded password is what let shops finish
  // setup still using owner/owner123.
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
    if (!ownerPassword) return null;
    if (ownerPassword.trim().length < 6) return 'Use at least 6 characters.';
    if (ownerPassword.trim() === 'owner123') return 'Pick something other than the default password.';
    if (ownerPasswordConfirm && ownerPassword !== ownerPasswordConfirm) return 'The two passwords do not match.';
    return null;
  })();
  const ownerPasswordReady =
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
      // 1. Optionally seed demo mechanical parts first, so it doesn't get blocked by auth
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
    if (!window.api?.gdrive) return;
    await window.api.gdrive.getAuthUrl();
    setRestoreStep(2);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-3xl max-w-xl w-full p-8 shadow-2xl text-jungle-teal-900 space-y-6 animate-in fade-in zoom-in duration-200">
        {/* Header with Icon */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-azure-mist-50 text-azure-mist-700 border border-azure-mist-200 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
            <Wrench className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight text-jungle-teal-900">
            Welcome to Mechanical Shop POS
          </h2>
          <p className="text-xs text-jungle-teal-500 font-sans">
            First-Run Quick Configuration Wizard · Offline-First System
          </p>
        </div>

        {/* Step Indicator */}
        {typeof step === 'number' && step > 0 && (
          <div className="flex items-center justify-center gap-2">
            <div
              className={`w-8 h-2 rounded-full transition-all ${
                step >= 1 ? 'bg-azure-mist-700' : 'bg-jungle-teal-200'
              }`}
            />
            <div
              className={`w-8 h-2 rounded-full transition-all ${
                step >= 2 ? 'bg-azure-mist-700' : 'bg-jungle-teal-200'
              }`}
            />
            <div
              className={`w-8 h-2 rounded-full transition-all ${
                step >= 3 ? 'bg-azure-mist-700' : 'bg-jungle-teal-200'
              }`}
            />
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* STEP 0: Choose Path */}
        {step === 0 && (
          <div className="space-y-4 pt-4">
            <button
              onClick={() => setStep(1)}
              className="w-full p-4 bg-white border border-jungle-teal-200 hover:border-azure-mist-500 rounded-2xl flex items-center gap-4 transition-all hover:shadow-md"
            >
              <div className="p-3 bg-green-50 text-green-600 rounded-xl">
                <Store className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-jungle-teal-900">Start a New Shop</h3>
                <p className="text-xs text-jungle-teal-500 mt-1">Set up a brand new workspace with fresh data</p>
              </div>
              <ArrowRight className="w-5 h-5 text-jungle-teal-300" />
            </button>

            <button
              onClick={() => setStep('restore')}
              className="w-full p-4 bg-white border border-jungle-teal-200 hover:border-azure-mist-500 rounded-2xl flex items-center gap-4 transition-all hover:shadow-md"
            >
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-jungle-teal-900">Restore from Google Drive</h3>
                <p className="text-xs text-jungle-teal-500 mt-1">Recover your previous data and settings from the cloud</p>
              </div>
              <ArrowRight className="w-5 h-5 text-jungle-teal-300" />
            </button>

            <button
              onClick={async () => {
                if (!window.api) return;
                try {
                  const file = await window.api.backup.selectFile();
                  if (file) {
                    setLoading(true);
                    await window.api.backup.restoreLocalFile(file);
                    // App will automatically restart after this
                  }
                } catch(err: any) {
                  setError('Failed to restore: ' + err.message);
                  setLoading(false);
                }
              }}
              className="w-full p-4 bg-white border border-jungle-teal-200 hover:border-azure-mist-500 rounded-2xl flex items-center gap-4 transition-all hover:shadow-md"
            >
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-jungle-teal-900">Restore from Local File</h3>
                <p className="text-xs text-jungle-teal-500 mt-1">Select a backup file (.db) from your computer</p>
              </div>
              <ArrowRight className="w-5 h-5 text-jungle-teal-300" />
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
          <div className="space-y-4">
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-6 rounded-2xl space-y-4 text-center">
              <Sparkles className="w-10 h-10 text-azure-mist-600 mx-auto" />
              <h3 className="font-bold text-lg text-jungle-teal-900">Google Drive Smart Recovery</h3>
              
              {restoreStep === 1 ? (
                <>
                  <p className="text-sm text-jungle-teal-600">
                    Connect your Google Drive account. We'll find your latest backup and restore your entire POS system exactly as you left it.
                  </p>
                  <button
                    onClick={handleStartRestore}
                    className="w-full px-6 py-3 mt-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl shadow-md transition-colors"
                  >
                    Connect Google Drive
                  </button>
                </>
              ) : (
                <div className="text-left space-y-4 pt-2">
                  <div className="bg-white p-4 rounded-xl border border-jungle-teal-200">
                    <p className="text-xs text-jungle-teal-700 font-medium space-y-2">
                      <span className="block">1. A browser window opened. Sign in and grant permission.</span>
                      <span className="block">2. Copy the entire URL from the address bar of that page.</span>
                      <span className="block">3. Paste it here to verify and start downloading your backup.</span>
                    </p>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value)}
                      placeholder="Paste full link (http://localhost/?code=...) here"
                      className="w-full bg-white border border-jungle-teal-300 rounded-xl px-4 py-3 text-xs focus:border-azure-mist-500 focus:outline-hidden"
                    />
                  </div>
                  <button
                    onClick={handleVerifyAndRestore}
                    disabled={loading || !authCode}
                    className="w-full px-6 py-3 bg-jungle-teal-700 hover:bg-jungle-teal-800 text-white font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
            
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setStep(0)}
                disabled={loading}
                className="text-xs text-jungle-teal-500 hover:text-jungle-teal-800 font-semibold"
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

            <div className="flex justify-end pt-2">
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
                  Master Owner Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 font-bold"
                />
                <input
                  type="password"
                  required
                  value={ownerPasswordConfirm}
                  onChange={(e) => setOwnerPasswordConfirm(e.target.value)}
                  placeholder="Type it again to confirm"
                  className="w-full mt-2 bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 font-bold"
                />
                {ownerPasswordError && (
                  <span className="text-[11px] text-rose-600 font-semibold mt-1 block">
                    {ownerPasswordError}
                  </span>
                )}
                <span className="text-[10px] text-jungle-teal-500 mt-1 block">
                  Username: <strong className="text-jungle-teal-800">owner</strong> (Used for full system control).
                  This replaces the temporary setup password.
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
    </div>
  );
};
