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
} from 'lucide-react';

interface FirstRunWizardModalProps {
  isOpen: boolean;
  onCompleted: () => void;
}

export const FirstRunWizardModal: React.FC<FirstRunWizardModalProps> = ({
  isOpen,
  onCompleted,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form State
  const [shopName, setShopName] = useState('My Mechanical Workshop');
  const [shopPhone, setShopPhone] = useState('');
  const [shopAddress, setShopAddress] = useState('Dhaka, Bangladesh');
  const [deviceIdPrefix, setDeviceIdPrefix] = useState('REG01');
  const [defaultInvoiceLayout, setDefaultInvoiceLayout] = useState<'80mm' | 'a5'>('80mm');
  const [ownerPassword, setOwnerPassword] = useState('owner123');
  const [seedDemoData, setSeedDemoData] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // 1. Complete wizard
      await window.api.wizard.completeFirstRun({
        shop_name: shopName.trim(),
        shop_address: shopAddress.trim(),
        shop_phone: shopPhone.trim(),
        device_id_prefix: deviceIdPrefix.trim() || 'REG01',
        default_invoice_layout: defaultInvoiceLayout,
        owner_password: ownerPassword.trim() || 'owner123',
      });

      // 2. Optionally seed demo mechanical parts
      if (seedDemoData) {
        await window.api.demo.seed();
      }

      onCompleted();
    } catch (err: any) {
      setError(err.message || 'Setup failed.');
    } finally {
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

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            {error}
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
                    onClick={() => setDefaultInvoiceLayout('a5')}
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all select-none ${
                      defaultInvoiceLayout === 'a5'
                        ? 'bg-azure-mist-50 border-azure-mist-600 shadow-xs'
                        : 'bg-jungle-teal-50 border-jungle-teal-200 hover:border-jungle-teal-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Printer className="w-4 h-4 text-azure-mist-700" />
                      {defaultInvoiceLayout === 'a5' && (
                        <Check className="w-4 h-4 text-azure-mist-700" />
                      )}
                    </div>
                    <span className="font-bold text-xs text-jungle-teal-900">A5 Formal Voucher</span>
                    <span className="text-[10px] text-jungle-teal-500">Half-page invoice memo</span>
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
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="owner123"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 font-bold"
                />
                <span className="text-[10px] text-jungle-teal-500 mt-1 block">
                  Username: <strong className="text-jungle-teal-800">owner</strong> (Used for full system control)
                </span>
              </div>

              {/* Demo Data Option */}
              <div className="p-3.5 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl flex items-start gap-3 mt-2">
                <input
                  type="checkbox"
                  id="seedDemo"
                  checked={seedDemoData}
                  onChange={(e) => setSeedDemoData(e.target.checked)}
                  className="mt-0.5 rounded-sm bg-jungle-teal-100 border-jungle-teal-300 text-azure-mist-700 focus:ring-0"
                />
                <div>
                  <label htmlFor="seedDemo" className="font-bold text-jungle-teal-900 cursor-pointer block">
                    Load 10 Sample Mechanical Parts & Customers
                  </label>
                  <p className="text-[11px] text-jungle-teal-500 mt-0.5">
                    Pre-fills genuine automotive components (Pistons, Spark Plugs, Brake Pads, Bearings) and 3 workshop clients for instant testing. (Can be cleared anytime from Settings).
                  </p>
                </div>
              </div>
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
                disabled={loading}
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
