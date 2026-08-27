import React, { useState, useEffect } from 'react';
import { AppSettings, UserSession } from '../../types/ipc';
import {
  SHORTCUT_DEFS,
  ShortcutId,
  getShortcuts,
  setShortcut,
  clearShortcut,
  resetShortcuts,
  eventToBinding,
  bindingLabel,
} from '../../utils/shortcuts';
import {
  Settings,
  Store,
  Printer,
  Shield,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Keyboard,
  X,
  Cloud,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface SettingsViewProps {
  currentSession: UserSession | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentSession }) => {
  const toast = useToast();
  // Keyboard shortcut editor state
  const [keys, setKeys] = useState(getShortcuts);
  const [capturing, setCapturing] = useState<ShortcutId | null>(null);
  const [rejected, setRejected] = useState<ShortcutId | null>(null);

  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [deviceIdPrefix, setDeviceIdPrefix] = useState('');
  const [defaultInvoiceLayout, setDefaultInvoiceLayout] = useState<'80mm' | 'a5'>('80mm');
  const [idleLockMinutes, setIdleLockMinutes] = useState('15');

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isOwner = currentSession?.role === 'owner';

  const fetchSettings = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const s = await window.api.settings.get();
      setShopName(s.shop_name || '');
      setShopAddress(s.shop_address || '');
      setShopPhone(s.shop_phone || '');
      setInvoiceFooter(s.invoice_footer || '');
      setDeviceIdPrefix(s.device_id_prefix || 'REG01');
      setDefaultInvoiceLayout((s.default_invoice_layout as any) || '80mm');
      setIdleLockMinutes((s.idle_lock_minutes || 15).toString());
    } catch (err: any) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api || !isOwner) return;

    setLoading(true);
    setError(null);
    setSavedSuccess(false);
    try {
      await window.api.settings.update({
        shop_name: shopName.trim(),
        shop_address: shopAddress.trim(),
        shop_phone: shopPhone.trim(),
        invoice_footer: invoiceFooter.trim(),
        device_id_prefix: deviceIdPrefix.trim() || 'REG01',
        default_invoice_layout: defaultInvoiceLayout,
        idle_lock_minutes: parseInt(idleLockMinutes, 10) || 15,
      });
      setSavedSuccess(true);
      toast.success('Shop configuration saved successfully.');
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings.');
      toast.error(err.message || 'Failed to update settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!window.api) return;
    try {
      await window.api.demo.seed();
      toast.success('10 Sample mechanical parts & customers loaded successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(`Failed to seed demo data: ${err.message}`);
    }
  };

  const handleResetDatabase = async () => {
    if (!window.api) return;
    try {
      await window.api.demo.reset();
      toast.success('Database reset to clean state successfully!');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(`Reset failed: ${err.message}`);
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-12 text-center text-jungle-teal-500 space-y-2 shadow-xs">
        <Shield className="w-12 h-12 mx-auto text-amber-500" />
        <h3 className="text-ui-lg font-semibold text-jungle-teal-900">Owner Authorization Required</h3>
        <p className="text-ui-xs text-jungle-teal-600 max-w-sm mx-auto">
          Shop settings and printer configuration are restricted to the Owner.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-5 text-jungle-teal-900">
      <div className="flex items-center justify-between flex-wrap gap-4 bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-ui-lg font-semibold text-jungle-teal-900">System &amp; Shop Settings</h2>
            <p className="text-ui-xs text-jungle-teal-600">Store branding, receipt format, shortcuts and security</p>
          </div>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 bg-muted-teal-50 text-muted-teal-900 border border-muted-teal-300 px-3 py-1.5 rounded-xl text-ui-xs font-medium">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved Successfully!</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-ui-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="text-ui-sm">
        <div className="grid grid-cols-1 min-[1150px]:grid-cols-2 gap-5 items-start">
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
            <Store className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Store Profile & Invoice Header</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Shop / Workshop Name *</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Master Auto Parts & Mechanical Works"
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Phone Numbers (Comma separated)</label>
              <input
                type="text"
                value={shopPhone}
                onChange={(e) => setShopPhone(e.target.value)}
                placeholder="01711-000000, 01811-000000"
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 font-mono placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Physical Address</label>
            <input
              type="text"
              value={shopAddress}
              onChange={(e) => setShopAddress(e.target.value)}
              placeholder="e.g. 142/A Tejgaon Link Road, Dhaka-1208"
              className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
            />
          </div>

          <div>
            <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Invoice Footer Message</label>
            <input
              type="text"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              placeholder="ধন্যবাদ, আবার আসবেন! • Sold goods cannot be returned without receipt."
              className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
            />
          </div>
        </div>

        {/* Keyboard Shortcuts Card */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
            <Keyboard className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Keyboard Shortcuts</h3>
            <button
              type="button"
              onClick={() => {
                resetShortcuts();
                setKeys(getShortcuts());
                setCapturing(null);
              }}
              className="ml-auto text-ui-xs font-medium text-jungle-teal-600 hover:text-jungle-teal-900 hover:underline"
            >
              Reset to defaults
            </button>
          </div>
        
          <p className="text-ui-xs text-jungle-teal-600">
            Click a key to change it, then press the new one. Function keys, Escape and
            Ctrl/Alt combinations only — a plain letter would be swallowed by the barcode
            scanner. Saved on this computer.
          </p>
        
          <div className="divide-y divide-jungle-teal-200/70">
            {SHORTCUT_DEFS.map((def) => {
              const isCapturing = capturing === def.id;
              const binding = keys[def.id];
              return (
                <div key={def.id} className="py-2.5 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-ui-sm font-medium text-jungle-teal-900">{def.label}</div>
                    <div className="text-ui-xs text-jungle-teal-600">{def.description}</div>
                  </div>
        
                  <button
                    type="button"
                    onClick={() => setCapturing(isCapturing ? null : def.id)}
                    onKeyDown={(e) => {
                      if (!isCapturing) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.key === 'Tab') return;
                      const next = eventToBinding(e);
                      if (!next) {
                        setRejected(def.id);
                        return;
                      }
                      setShortcut(def.id, next);
                      setKeys(getShortcuts());
                      setRejected(null);
                      setCapturing(null);
                    }}
                    onBlur={() => isCapturing && setCapturing(null)}
                    className={`min-w-[92px] h-9 px-3 rounded-xl border font-mono text-ui-sm font-semibold transition-colors ${
                      isCapturing
                        ? 'border-azure-mist-700 bg-azure-mist-50 text-azure-mist-800 animate-pulse'
                        : binding
                        ? 'border-jungle-teal-200 bg-jungle-teal-100 text-jungle-teal-800 hover:border-azure-mist-600'
                        : 'border-dashed border-jungle-teal-300 text-jungle-teal-500 hover:border-azure-mist-600'
                    }`}
                  >
                    {isCapturing ? 'Press a key…' : bindingLabel(binding)}
                  </button>
        
                  <button
                    type="button"
                    onClick={() => {
                      clearShortcut(def.id);
                      setKeys(getShortcuts());
                    }}
                    disabled={!binding}
                    title="Unassign this shortcut"
                    className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-jungle-teal-400"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        
          {rejected && (
            <div className="flex items-start gap-2 text-ui-xs text-amber-800 bg-amber-50 border border-amber-300 rounded-xl p-2.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                That key cannot be used. Pick a function key (F1–F12), Escape, or hold Ctrl
                or Alt with another key.
              </span>
            </div>
          )}
        </div>
        
        {/* Printer & Hardware Setup Card */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
            <Printer className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Printer & Device Configuration</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Default Invoice Layout</label>
              <select
                value={defaultInvoiceLayout}
                onChange={(e) => setDefaultInvoiceLayout(e.target.value as any)}
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600 font-semibold"
              >
                <option value="80mm">80mm Thermal Receipt (POS Roll)</option>
                <option value="a5">A5 Formal Invoice (Half-Page Voucher)</option>
              </select>
            </div>

            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">POS Device / Counter Prefix</label>
              <input
                type="text"
                value={deviceIdPrefix}
                onChange={(e) => setDeviceIdPrefix(e.target.value.toUpperCase())}
                placeholder="REG01"
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 font-mono font-semibold focus:outline-hidden focus:border-azure-mist-600 uppercase"
              />
              <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">
                Used in unique invoice numbering: INV-{deviceIdPrefix}-YYYYMMDD-XXXX
              </span>
            </div>
          </div>
        </div>

        {/* Security & Inactivity Lock Card */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
            <Clock className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Security & Session Policies</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Auto-Lock Inactivity Period (Minutes)</label>
              <input
                type="number"
                min="1"
                max="120"
                value={idleLockMinutes}
                onChange={(e) => setIdleLockMinutes(e.target.value)}
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 font-mono font-semibold focus:outline-hidden focus:border-azure-mist-600"
              />
              <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">
                Automatically switches to locked state when idle.
              </span>
            </div>
          </div>
        </div>

        {/* Demo Data & Database Reset Tools */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5">
          <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
            <Database className="w-4 h-4 text-frozen-water-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Database Tools & Sample Data</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-jungle-teal-50 p-4 rounded-xl border border-jungle-teal-200 space-y-2">
              <span className="font-semibold text-ui-sm text-jungle-teal-900 block">Sample Demo Data</span>
              <p className="text-jungle-teal-600 text-ui-xs">
                Populates 10 automotive mechanical parts with barcodes, Bengali names, and 3 workshop customers.
              </p>
              <button
                type="button"
                onClick={handleSeedDemo}
                className="h-9 px-4 bg-frozen-water-700 hover:bg-frozen-water-800 text-white font-medium rounded-xl text-ui-xs transition-colors"
              >
                Load Sample Mechanical Data
              </button>
            </div>

            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 space-y-2">
              <span className="font-semibold text-ui-sm text-rose-900 block">Reset Database (Clean Slate)</span>
              <p className="text-rose-700 text-ui-xs">
                Clears all sales, inventory, and ledger history for live production store setup.
              </p>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl text-ui-xs transition-colors"
              >
                Reset Database to Clean Slate
              </button>
            </div>
          </div>
        </div>

        </div>

        <div className="sticky bottom-0 z-10 mt-5 flex items-center justify-end gap-3 py-3 border-t border-jungle-teal-200 bg-jungle-teal-100">
          <button
            type="submit"
            disabled={loading}
            className="h-11 px-6 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-sm flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

      {/* Database Reset Confirm Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        title="Reset Entire Database"
        message="DANGER: This action will permanently erase all catalog products, transactions, and customer ledgers to start completely clean. Are you sure you want to proceed?"
        isDanger
        confirmLabel="Erase & Reset Clean"
        onConfirm={() => {
          setShowResetConfirm(false);
          handleResetDatabase();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
};
