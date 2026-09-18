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
  Maximize2,
  Shield,
  Clock,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  Keyboard,
  X,
  Cloud,
  Barcode,
  KeyRound,
  Copy,
  Download,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { usePdfObjectUrl } from '../../utils/pdfObjectUrl';
import { printInvoicePdf } from '../../utils/printPdf';
import { EraseDataModal } from './EraseDataModal';

/*
 * Mirrors PAPER_GEOMETRY in electron/services/invoicePrintOptions.ts, which is
 * the source of truth - the renderer needs the numbers only to pick sensible
 * defaults when the owner switches paper.
 */
type InvoicePaperId = '80mm' | 'a4';
type InvoiceFieldKey = 'logo' | 'address' | 'phone' | 'qr' | 'cashier' | 'nameBn' | 'footer';

/*
 * Preview scale. Not a true-to-life ruler - the panel is 320px wide and A4 is
 * 210mm - but the proportions between papers, margins and type are right, which
 * is what the owner is judging.
 */

const PREVIEW_ITEMS = [
  { name: 'Oil Filter C-1122', bn: 'অয়েল ফিল্টার', qty: 2, total: '700.00' },
  { name: 'Brake Pad Front', bn: 'ব্রেক প্যাড', qty: 1, total: '350.00' },
];

const INVOICE_PAPERS: Array<{ id: InvoicePaperId; short: string; hint: string; marginMm: number; fontPt: number }> = [
  { id: '80mm', short: '80mm', hint: 'Thermal roll', marginMm: 3, fontPt: 8 },
  { id: 'a4', short: 'A4', hint: 'Full page', marginMm: 12, fontPt: 10 },
];

const INVOICE_FIELDS: Array<{ key: InvoiceFieldKey; label: string }> = [
  { key: 'logo', label: 'Logo' },
  { key: 'address', label: 'Shop address' },
  { key: 'phone', label: 'Shop phone' },
  { key: 'qr', label: 'QR code' },
  { key: 'cashier', label: 'Cashier name' },
  { key: 'nameBn', label: 'Bengali product name' },
  { key: 'footer', label: 'Footer note' },
];

interface SettingsViewProps {
  currentSession: UserSession | null;
  onSettingsChanged?: () => void;
  /** Opens the cloud sync and backup dialog, which App owns. */
  onOpenSyncModal?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentSession, onSettingsChanged, onOpenSyncModal }) => {
  const toast = useToast();
  // Keyboard shortcut editor state
  const [keys, setKeys] = useState(getShortcuts);
  const [capturing, setCapturing] = useState<ShortcutId | null>(null);
  const [rejected, setRejected] = useState<ShortcutId | null>(null);

  const [shopName, setShopName] = useState('');
  const [invoiceShopName, setInvoiceShopName] = useState('');
  // The code itself is only ever held here, for the moment it is on screen.
  const [recoveryTotal, setRecoveryTotal] = useState(0);
  const [recoveryRemaining, setRecoveryRemaining] = useState(0);
  const [recoverySetAt, setRecoverySetAt] = useState('');
  const [issuedCodes, setIssuedCodes] = useState<string[] | null>(null);
  const [issuingCodes, setIssuingCodes] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [invoiceContacts, setInvoiceContacts] = useState<{name: string, phone: string}[]>([]);
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [deviceIdPrefix, setDeviceIdPrefix] = useState('');
  const [defaultInvoiceLayout, setDefaultInvoiceLayout] = useState<InvoicePaperId>('80mm');
  const [invoiceMarginMm, setInvoiceMarginMm] = useState(3);
  const [invoiceFontPt, setInvoiceFontPt] = useState(8);
  const [invoiceLogo, setInvoiceLogo] = useState('');
  const [invoiceLogoHeightMm, setInvoiceLogoHeightMm] = useState(12);
  const [invoiceSignature, setInvoiceSignature] = useState('');
  const [previewPdf, setPreviewPdf] = useState('');
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrl = usePdfObjectUrl(previewPdf);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [invoiceSignatureHeightMm, setInvoiceSignatureHeightMm] = useState(14);
  const [invoiceTitle, setInvoiceTitle] = useState('');
  const [invoiceHeaderNote, setInvoiceHeaderNote] = useState('');
  const [invoiceTerms, setInvoiceTerms] = useState('');
  const [invoiceShowSignature, setInvoiceShowSignature] = useState(false);
  const [invoiceFields, setInvoiceFields] = useState<Record<InvoiceFieldKey, boolean>>({
    logo: true,
    address: true,
    phone: true,
    qr: true,
    cashier: true,
    nameBn: true,
    footer: true,
  });
  const [idleLockMinutes, setIdleLockMinutes] = useState('15');
  const [hasPrinter, setHasPrinter] = useState(true);
  const [silentPrint, setSilentPrint] = useState(false);
  const [receiptPrinterName, setReceiptPrinterName] = useState('');
  const [printers, setPrinters] = useState<{ name: string; displayName: string; isDefault: boolean; status: number }[]>([]);

  const [enableShifts, setEnableShifts] = useState(true);
  const [barcodeScannerMode, setBarcodeScannerMode] = useState<'speed' | 'prefix'>('speed');
  const [barcodeScannerPrefix, setBarcodeScannerPrefix] = useState('');

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEraseModal, setShowEraseModal] = useState(false);
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);
  const [advancedAuthPassword, setAdvancedAuthPassword] = useState('');
  const [advancedAuthError, setAdvancedAuthError] = useState('');
  const [advancedAuthBusy, setAdvancedAuthBusy] = useState(false);
  // Which build this is. Sample data is offered only when this says so, which
  // it never does in the installed app.
  const [appInfo, setAppInfo] = useState<{ version: string; sampleDataAvailable: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState('print');

  const isOwner = currentSession?.role === 'owner';

  const fetchSettings = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const s = await window.api.settings.get();
      setShopName(s.shop_name || '');
      setRecoveryTotal(s.recovery_codes_total ?? 0);
      setRecoveryRemaining(s.recovery_codes_remaining ?? 0);
      setRecoverySetAt(s.recovery_set_at || '');
      setShopAddress(s.shop_address || '');
      setShopPhone(s.shop_phone || '');
      setInvoiceFooter(s.invoice_footer || '');
      setDeviceIdPrefix(s.device_id_prefix || 'REG01');
      setDefaultInvoiceLayout((s.default_invoice_layout as any) || '80mm');
      setInvoiceMarginMm(s.invoice_margin_mm ?? 3);
      setInvoiceFontPt(s.invoice_font_pt ?? 8);
      setInvoiceLogo(s.invoice_logo || '');
      setInvoiceLogoHeightMm(s.invoice_logo_height_mm ?? 12);
      setInvoiceSignature((s as any).invoice_signature || '');
      setInvoiceSignatureHeightMm((s as any).invoice_signature_height_mm ?? 14);
      setInvoiceTitle(s.invoice_title || '');
      setInvoiceHeaderNote(s.invoice_header_note || '');
      setInvoiceTerms(s.invoice_terms || '');
      setInvoiceShowSignature(s.invoice_show_signature ?? false);
      setInvoiceFields({
        logo: s.invoice_show_logo ?? true,
        address: s.invoice_show_address ?? true,
        phone: s.invoice_show_phone ?? true,
        qr: s.invoice_show_qr ?? true,
        cashier: s.invoice_show_cashier ?? true,
        nameBn: s.invoice_show_name_bn ?? true,
        footer: s.invoice_show_footer ?? true,
      });
      // `|| 15` here would show a stored 0 - never lock - back to the owner as
      // fifteen minutes, and saving the form again would make that stick.
      const storedIdle = parseInt(String(s.idle_lock_minutes ?? ''), 10);
      setIdleLockMinutes((Number.isFinite(storedIdle) && storedIdle >= 0 ? storedIdle : 15).toString());
      setEnableShifts(s.enable_shifts ?? true);
      setHasPrinter(s.has_printer ?? true);
      setSilentPrint(s.silent_print ?? false);
      setReceiptPrinterName(s.receipt_printer_name || '');
      setBarcodeScannerMode(s.barcode_scanner_mode || 'speed');
      setBarcodeScannerPrefix(s.barcode_scanner_prefix || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Asked for once. The list only changes when Windows gains or loses a
  // printer, which is not something that happens while this page is open.
  useEffect(() => {
    window.api?.print
      ?.listPrinters?.()
      .then(setPrinters)
      .catch(() => setPrinters([]));
    window.api?.app
      ?.info?.()
      .then(setAppInfo)
      .catch(() => setAppInfo(null));
  }, []);

  /*
   * Re-renders the sample whenever an option that shows on paper changes.
   *
   * Debounced: dragging the margin slider fires on every pixel, and each render
   * is a real PDF build in the main process. 400ms is long enough that a drag
   * costs one render and short enough to still feel like a preview.
   */
  useEffect(() => {
    if (!window.api || !isOwner) return;
    let cancelled = false;
    setPreviewBusy(true);

    const timer = setTimeout(async () => {
      try {
        /*
         * Named explicitly, because the generic failure below used to swallow
         * this one: when the running build predates the preview endpoint,
         * settings.previewInvoice is simply undefined, the call throws a
         * TypeError, and "could not be prepared" gave no hint that the fix was
         * to relaunch rather than to change a setting.
         */
        if (typeof window.api?.settings?.previewInvoice !== 'function') {
          throw new Error(
            'This running copy of the app is older than the preview feature. Close it completely and start it again.'
          );
        }
        const res = await window.api!.settings.previewInvoice({
          default_invoice_layout: defaultInvoiceLayout,
          invoice_margin_mm: invoiceMarginMm,
          invoice_font_pt: invoiceFontPt,
          invoice_title: invoiceTitle,
          invoice_header_note: invoiceHeaderNote,
          invoice_terms: invoiceTerms,
          invoice_logo: invoiceLogo,
          invoice_logo_height_mm: invoiceLogoHeightMm,
          invoice_signature: invoiceSignature,
          invoice_signature_height_mm: invoiceSignatureHeightMm,
          invoice_show_logo: invoiceFields.logo,
          invoice_show_address: invoiceFields.address,
          invoice_show_phone: invoiceFields.phone,
          invoice_show_qr: invoiceFields.qr,
          invoice_show_cashier: invoiceFields.cashier,
          invoice_show_footer: invoiceFields.footer,
          invoice_show_signature: invoiceShowSignature,
          shop_name: shopName,
          invoice_shop_name: invoiceShopName,
          shop_address: shopAddress,
          shop_phone: shopPhone,
          invoice_contacts: invoiceContacts.filter(c => c.name.trim() || c.phone.trim()),
          invoice_footer: invoiceFooter,
        });
        if (!cancelled) {
          setPreviewPdf(res?.pdfBase64 || '');
          setPreviewError(res?.pdfBase64 ? null : 'The invoice came back empty.');
        }
      } catch (err: any) {
        if (!cancelled) {
          setPreviewPdf('');
          /*
           * "No handler registered" means the window was reloaded but the app
           * itself was not restarted: Electron re-reads preload.js on a reload,
           * so the renderer gains the new call, while the main process keeps
           * the handlers it registered at launch and has never heard of it.
           * Reloading again will not help, and the raw message does not say so.
           */
          const raw = String(err?.message || '');
          setPreviewError(
            /no handler registered/i.test(raw)
              ? 'The app needs a full restart, not a window reload — close it from the terminal (Ctrl+C) and run it again.'
              : raw || 'The preview could not be prepared.'
          );
        }
      } finally {
        if (!cancelled) setPreviewBusy(false);
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [
    isOwner, defaultInvoiceLayout, invoiceMarginMm, invoiceFontPt, invoiceTitle,
    invoiceHeaderNote, invoiceTerms, invoiceLogo, invoiceLogoHeightMm,
    invoiceSignature, invoiceSignatureHeightMm, invoiceFields, invoiceShowSignature,
    shopName, invoiceShopName, shopAddress, shopPhone, invoiceFooter, JSON.stringify(invoiceContacts),
  ]);

  const handleSaveSection = async (sectionName: string, data: Record<string, any>) => {
    if (!window.api || !isOwner) return;

    setLoading(true);
    setError(null);
    setSavedSuccess(false);
    try {
      if (data.enable_shifts === false) {
        const hasOpen = await window.api.shifts.hasAnyOpen();
        if (hasOpen) {
          throw new Error('Please close the running shift before disabling Shift Management.');
        } else {
          toast.success("DEBUG: hasOpen is false");
        }
      }

      await window.api.settings.update(data);
      toast.success(`${sectionName} saved successfully.`);
      if (onSettingsChanged) {
        onSettingsChanged();
      }
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
      toast.success('Sample data loaded: 10 parts, 3 customers, 2 suppliers.');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(`Sample data was not loaded. ${err.message}`);
    }
  };

  /*
   * Logos arrive as whatever the owner had on the counter PC - often a 3000px
   * photo. Stored raw that goes into every backup and every Drive upload, so it
   * is drawn onto a canvas at 600px wide first. PNG keeps a transparent
   * background, which is what a logo on white paper needs.
   */
  /*
   * Shared by the logo and the signature: both are an image the owner picks
   * once, downscaled and stored as a data URL rather than a file path, because
   * a path breaks the moment the picture is moved or the shop changes machine.
   */
  const readImageFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    onReady: (dataUrl: string) => void
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onReady(canvas.toDataURL('image/png'));
      };
      img.onerror = () => toast.error('That file could not be read as an image.');
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSignaturePick = (e: React.ChangeEvent<HTMLInputElement>) =>
    readImageFile(e, (dataUrl) => {
      setInvoiceSignature(dataUrl);
      setInvoiceShowSignature(true);
    });

  const handleLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setInvoiceLogo(canvas.toDataURL('image/png'));
        setInvoiceFields((prev) => ({ ...prev, logo: true }));
      };
      img.onerror = () => toast.error('That file could not be read as an image.');
      img.src = String(reader.result);
    };
    reader.onerror = () => toast.error('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const handleErased = ({ backupFile }: { backupFile: string }) => {
    setShowEraseModal(false);
    toast.success(`Business data erased. A backup was saved first: ${backupFile}`);
    // Every screen holds the old catalogue, customers and shift in memory.
    setTimeout(() => window.location.reload(), 1000);
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

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* SIDEBAR TABS */}
        <div className="w-full md:w-64 shrink-0 flex flex-col gap-1 bg-jungle-teal-50 border border-jungle-teal-200 p-2 rounded-2xl shadow-xs">
          {[
            { id: 'print', label: 'Store Profile & Print', icon: Printer },
            { id: 'hardware', label: 'Hardware', icon: Barcode },
            { id: 'security', label: 'Security & Access', icon: Shield },
            { id: 'backup', label: 'Backup & Data', icon: Cloud },
            { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
            { id: 'advanced', label: 'Advanced Settings', icon: AlertCircle },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
              if (tab.id === 'advanced' && activeTab !== 'advanced') {
                setShowAdvancedAuth(true);
                setAdvancedAuthPassword('');
                setAdvancedAuthError('');
              } else {
                setActiveTab(tab.id);
              }
            }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-ui-sm transition-colors text-left ${activeTab === tab.id ? 'bg-azure-mist-100 text-azure-mist-900 border border-azure-mist-200' : 'text-jungle-teal-600 hover:bg-jungle-teal-100/50 hover:text-jungle-teal-900 border border-transparent'}`}
            >
              <tab.icon className="w-5 h-5 shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 min-w-0 space-y-6">

        

        {/* Cloud Backup Card. The sidebar used to carry a permanent "Local Only"
            chip that was the only way into this dialog; backup is configuration,
            so the door belongs here. */}
        {activeTab === 'backup' && (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5 mb-6">
            <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
              <Cloud className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Cloud Backup &amp; Sync</h3>
          </div>

          <p className="text-ui-xs text-jungle-teal-600 leading-relaxed">
            The shop runs entirely on this computer. Connect Google Drive so a copy of the database
            leaves the counter - without it, a failed disk takes the whole history with it.
          </p>

          <div className="flex justify-end pt-1 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={onOpenSyncModal}
              className="h-9 px-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <Cloud className="w-4 h-4" />
              <span>Open backup settings</span>
            </button>
          </div>
          </div>
        )}

        {/* Owner Recovery Card. Owner-only twice over: this whole view returns
            early for staff, and the handlers behind it require the owner role. */}
        {activeTab === 'security' && (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5 mb-6">
            <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
              <KeyRound className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Owner Recovery Codes</h3>
            {recoveryTotal > 0 ? (
              <span
                className={`ml-auto text-ui-2xs font-semibold px-2 py-0.5 rounded-full border ${
                  recoveryRemaining > 1
                    ? 'text-muted-teal-700 bg-muted-teal-100 border-muted-teal-200'
                    : 'text-amber-800 bg-amber-100 border-amber-300'
                }`}
              >
                {recoveryRemaining} of {recoveryTotal} left
              </span>
            ) : (
              <span className="ml-auto text-ui-2xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                Not set
              </span>
            )}
          </div>

          <p className="text-ui-xs text-jungle-teal-600 leading-relaxed">
            Passwords are stored hashed and this app has no server to email a reset link from. These
            codes are the only way back into the owner account from the login screen. Each one works
            once; using one does not affect the rest.
            {recoverySetAt && <> Sheet issued {new Date(recoverySetAt).toLocaleDateString()}.</>}
          </p>

          {issuedCodes ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-3">
              <p className="text-ui-2xs font-semibold uppercase tracking-wider text-amber-800">
                Save these now
              </p>

              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {issuedCodes.map((code, i) => (
                  <li
                    key={code}
                    className="flex items-baseline gap-2 bg-white border border-amber-200 rounded-lg px-2.5 py-1.5"
                  >
                    <span className="text-ui-2xs font-mono text-amber-700 shrink-0">{i + 1}.</span>
                    <code className="font-mono text-ui-sm font-bold tracking-wider text-jungle-teal-900">
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
                      const res = await window.api.settings.exportRecoveryCodes(issuedCodes);
                      if (res.success) toast.success(`Saved to ${res.filePath}`);
                    } catch (err: any) {
                      toast.error(err?.message || 'Could not save the codes.');
                    }
                  }}
                  className="flex items-center gap-1.5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white text-ui-2xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download as .txt</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(issuedCodes.join('\n'));
                    setCodesCopied(true);
                  }}
                  className="flex items-center gap-1.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 text-ui-2xs font-semibold py-1.5 px-3 rounded-lg transition-colors"
                >
                  {codesCopied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{codesCopied ? 'Copied' : 'Copy all'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIssuedCodes(null)}
                  className="ml-auto text-ui-2xs font-semibold text-jungle-teal-600 hover:text-jungle-teal-900 py-1.5 px-2"
                >
                  Hide
                </button>
              </div>

              <p className="text-ui-2xs text-amber-800 leading-relaxed">
                They are stored hashed, so this is the only time they can be read. Once this panel is
                closed nobody can look them up - not you, and not anyone who takes the database.
              </p>
            </div>
          ) : (
            <>
              {recoveryTotal > 0 && recoveryRemaining === 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-ui-xs text-rose-700 leading-relaxed">
                  Every code on the current sheet has been used. Generate a new sheet now - until you
                  do, a forgotten password can only be fixed with the offline reset tool.
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-1 border-t border-jungle-teal-200">
                {recoveryTotal > 0 && (
                  <p className="text-ui-2xs text-jungle-teal-500 leading-relaxed mr-auto">
                    A new sheet replaces all {recoveryTotal} codes, including unused ones.
                  </p>
                )}
                <button
                  type="button"
                  disabled={issuingCodes}
                  onClick={async () => {
                    if (!window.api) return;
                    setIssuingCodes(true);
                    try {
                      const res = await window.api.settings.generateRecoveryCodes();
                      setIssuedCodes(res.codes);
                      setCodesCopied(false);
                      setRecoveryTotal(res.codes.length);
                      setRecoveryRemaining(res.codes.length);
                      setRecoverySetAt(new Date().toISOString());
                    } catch (err: any) {
                      toast.error(err?.message || 'Could not generate recovery codes.');
                    } finally {
                      setIssuingCodes(false);
                    }
                  }}
                  className="h-9 px-5 shrink-0 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {issuingCodes
                      ? 'Generating...'
                      : recoveryTotal > 0
                        ? 'Generate a new sheet'
                        : 'Generate recovery codes'}
                  </span>
                </button>
              </div>
            </>
            )}
          </div>
        )}

        {/* Barcode Scanner Config Card */}
        {activeTab === 'hardware' && (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5 mb-6">
            <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
              <Barcode className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Barcode Scanner Configuration</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Scanner Detection Mode</label>
              <select
                value={barcodeScannerMode}
                onChange={(e) => setBarcodeScannerMode(e.target.value as any)}
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600 font-semibold"
              >
                <option value="speed">Typing Speed Analysis (Auto-detect, No config needed)</option>
                <option value="prefix">Hardware Prefix Mode (100% Guaranteed, Requires Scanner Config)</option>
              </select>
            </div>

            {barcodeScannerMode === 'prefix' && (
              <div>
                <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Hardware Prefix Key</label>
                <input
                  type="text"
                  value={barcodeScannerPrefix}
                  onChange={(e) => setBarcodeScannerPrefix(e.target.value)}
                  placeholder="e.g. F12 or STX"
                  className="w-full h-[40px] bg-white border border-azure-mist-300 rounded-xl px-3 text-ui-sm text-azure-mist-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600 ring-2 ring-azure-mist-100"
                />
                <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">
                  Click inside and press your scanner's prefix key if it's a visible character, or type its name (like F12).
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-2 mt-4 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={() => handleSaveSection('Barcode Scanner Config', { barcode_scanner_mode: barcodeScannerMode, barcode_scanner_prefix: barcodeScannerPrefix })}
              disabled={loading}
              className="h-9 px-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Scanner Config</span>
            </button>
          </div>
          </div>
        )}
        {/* Security & Inactivity Lock Card */}
        {activeTab === 'security' && (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5 mb-6">
            <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
              <Clock className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Security & Session Policies</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Auto-Lock Inactivity Period (Minutes)</label>
              <input
                type="number"
                min="0"
                max="120"
                value={idleLockMinutes}
                onChange={(e) => setIdleLockMinutes(e.target.value)}
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 font-mono font-semibold focus:outline-hidden focus:border-azure-mist-600"
              />
              <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">
                Locks the counter after this long with no typing or clicking. Set 0 to never lock.
              </span>
            </div>


            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <label htmlFor="enableShifts" className="text-ui-sm font-semibold text-jungle-teal-900 cursor-pointer select-none block">
                  Enable Shift Management (Cash Drawer & Float)
                  <span className="block text-ui-2xs text-jungle-teal-500 font-normal mt-0.5">
                    Require staff to open a shift before selling and close it when done.
                  </span>
                </label>
              </div>
              <button
                type="button"
                id="enableShifts"
                role="switch"
                aria-checked={enableShifts}
                onClick={() => setEnableShifts(!enableShifts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-azure-mist-500 focus:ring-offset-2 ${enableShifts ? 'bg-azure-mist-600' : 'bg-gray-300'}`}
              >
                <span className="sr-only">Enable Shift Management</span>
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${enableShifts ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
            </div>
          </div>
          <div className="flex justify-end pt-2 mt-4 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={() => {
                // `|| 15` would have turned a deliberate 0 - never lock - back
                // into a quarter hour, so the one value the field must be able
                // to carry was the one it could not.
                const typed = parseInt(idleLockMinutes, 10);
                const minutes = Number.isFinite(typed) && typed >= 0 ? typed : 15;
                handleSaveSection('Security & Session Policies', { idle_lock_minutes: minutes, enable_shifts: enableShifts });
              }}
              disabled={loading}
              className="h-9 px-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Policies</span>
            </button>
          </div>
          </div>
        )}



        {/* Print Layout. Everything that decides what a printed invoice looks
            like, with a live preview beside it - the controls are meaningless
            without seeing what they do to the page. */}
        {activeTab === 'print' && (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5 mb-6">
            <div className="flex items-center gap-2 border-b border-jungle-teal-200 pb-3">
              <Store className="w-4 h-4 text-azure-mist-700" />
            <h3 className="font-semibold text-ui-base text-jungle-teal-900">Store Profile & Print Layout</h3>
            <span className="ml-auto text-ui-2xs text-jungle-teal-500">
              Applies to printed invoices and saved PDFs
            </span>
          </div>

          <div className="grid grid-cols-1 min-[1150px]:grid-cols-[1fr_320px] gap-6">
            {/* ---------------- controls ---------------- */}
            <div className="space-y-4 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Shop Name (App Display) *</label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Master Auto Parts"
                className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600 font-semibold mb-3"
              />
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Shop Name (Printed Invoice)</label>
              <input
                type="text"
                value={invoiceShopName}
                onChange={(e) => setInvoiceShopName(e.target.value)}
                placeholder="Leave blank to use App Display name"
                className="w-full h-[40px] bg-white border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600 font-semibold"
              />
            </div>

            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Invoice Contacts</label>
              <div className="space-y-2">
                {invoiceContacts.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Name (e.g. Manager)"
                      value={c.name}
                      onChange={(e) => {
                        const newC = [...invoiceContacts];
                        newC[i].name = e.target.value;
                        setInvoiceContacts(newC);
                      }}
                      className="flex-1 min-w-0 h-[36px] bg-white border border-jungle-teal-200 rounded-lg px-2 text-ui-sm focus:outline-hidden focus:border-azure-mist-600"
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={c.phone}
                      onChange={(e) => {
                        const newC = [...invoiceContacts];
                        newC[i].phone = e.target.value;
                        setInvoiceContacts(newC);
                      }}
                      className="flex-1 min-w-0 h-[36px] bg-white border border-jungle-teal-200 rounded-lg px-2 text-ui-sm focus:outline-hidden focus:border-azure-mist-600 font-mono"
                    />
                    <button type="button" onClick={() => setInvoiceContacts(invoiceContacts.filter((_, idx) => idx !== i))} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 transition-colors">
                      <X className="w-4 h-4"/>
                    </button>
                  </div>
                ))}
                {invoiceContacts.length < 4 && (
                  <button type="button" onClick={() => setInvoiceContacts([...invoiceContacts, {name: '', phone: ''}])} className="text-ui-xs font-semibold text-azure-mist-700 hover:text-azure-mist-900 transition-colors">
                    + Add Contact
                  </button>
                )}
              </div>
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
              placeholder="Thank you, please come again! • Sold goods cannot be returned without receipt."
              className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
            />
          </div>
              <hr className="border-jungle-teal-200" />

              <div>
                <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1.5">Paper</label>
                <div className="grid grid-cols-3 gap-2">
                  {INVOICE_PAPERS.map((paper) => (
                    <button
                      key={paper.id}
                      type="button"
                      onClick={() => {
                        setDefaultInvoiceLayout(paper.id);
                        // Millimetres mean different things on a 76mm-wide roll
                        // and on A4 - a 12mm margin would eat half the roll - so
                        // the paper's own defaults come with it.
                        setInvoiceMarginMm(paper.marginMm);
                        setInvoiceFontPt(paper.fontPt);
                      }}
                      className={`px-2 py-2 rounded-xl border text-ui-xs font-semibold transition-colors ${
                        defaultInvoiceLayout === paper.id
                          ? 'bg-azure-mist-700 border-azure-mist-700 text-white'
                          : 'bg-white border-jungle-teal-200 text-jungle-teal-700 hover:border-azure-mist-300 hover:bg-azure-mist-50'
                      }`}
                    >
                      <span className="block">{paper.short}</span>
                      <span className={`block text-ui-2xs font-normal mt-0.5 ${defaultInvoiceLayout === paper.id ? 'text-azure-mist-100' : 'text-jungle-teal-500'}`}>
                        {paper.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Where receipts go. A counter selling small parts all day was
                  answering the Windows print dialog for every one of them. */}
              <div>
                <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1.5">Receipt Printer</label>
                {/* One control for how this counter hands over a bill. "No
                    printer" is a choice of its own rather than an absence: with
                    it the till stops offering to print and offers a PDF. */}
                <select
                  value={hasPrinter ? receiptPrinterName : '__none__'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__none__') {
                      setHasPrinter(false);
                      setReceiptPrinterName('');
                      setSilentPrint(false);
                      return;
                    }
                    setHasPrinter(true);
                    setReceiptPrinterName(value);
                    // Choosing "ask every time" and leaving the switch on would
                    // be a setting that says one thing and does another.
                    if (!value) setSilentPrint(false);
                  }}
                  className="w-full h-[40px] bg-white border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600"
                >
                  <option value="__none__">No printer at this counter — save bills as PDF</option>
                  <option value="">Ask every time (show the print dialog)</option>
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName}{p.isDefault ? ' — Windows default' : ''}{p.status !== 0 ? ' (Offline/Error)' : ''}
                    </option>
                  ))}
                </select>

                {hasPrinter ? (
                  <>
                    <label
                      className={`flex items-center gap-2 mt-2 text-ui-xs ${receiptPrinterName ? 'text-jungle-teal-700 cursor-pointer' : 'text-jungle-teal-400 cursor-not-allowed'}`}
                    >
                      <input
                        type="checkbox"
                        checked={silentPrint}
                        disabled={!receiptPrinterName}
                        onChange={(e) => setSilentPrint(e.target.checked)}
                        className="accent-azure-mist-700"
                      />
                      <span>Print receipts straight away, without the dialog</span>
                    </label>
                    <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">
                      If the chosen printer is switched off or unplugged, the dialog comes back on its own.
                    </span>
                  </>
                ) : (
                  <span className="text-ui-2xs text-jungle-teal-500 mt-1.5 block">
                    Sales finish without printing. After each sale, <b>Save PDF</b> keeps the bill as a file you can open,
                    send or print later. The paper and layout options below still decide how that PDF looks.
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Page Margin (mm)</label>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={invoiceMarginMm}
                    onChange={(e) => setInvoiceMarginMm(Number(e.target.value))}
                    className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 font-mono font-semibold focus:outline-hidden focus:border-azure-mist-600"
                  />
                </div>
                <div>
                  <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Base Text Size (pt)</label>
                  <input
                    type="number"
                    min={6}
                    max={16}
                    step={0.5}
                    value={invoiceFontPt}
                    onChange={(e) => setInvoiceFontPt(Number(e.target.value))}
                    className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 font-mono font-semibold focus:outline-hidden focus:border-azure-mist-600"
                  />
                  <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">Headings and totals scale with it.</span>
                </div>
              </div>

              {/* ---- masthead ---- */}
              <div className="pt-3 border-t border-jungle-teal-200">
                <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1.5">Logo</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 shrink-0 rounded-xl border border-jungle-teal-200 bg-white flex items-center justify-center overflow-hidden">
                    {invoiceLogo ? (
                      <img src={invoiceLogo} alt="Shop logo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-jungle-teal-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white hover:bg-azure-mist-50 border border-jungle-teal-200 hover:border-azure-mist-300 text-jungle-teal-700 text-ui-2xs font-semibold py-1.5 px-3 rounded-lg transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{invoiceLogo ? 'Replace' : 'Choose image'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleLogoPick} />
                      </label>
                      {invoiceLogo && (
                        <button
                          type="button"
                          onClick={() => setInvoiceLogo('')}
                          className="text-ui-2xs font-semibold text-rose-600 hover:text-rose-800 px-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-ui-2xs text-jungle-teal-500 shrink-0">Height</span>
                      <input
                        type="range"
                        min={5}
                        max={40}
                        value={invoiceLogoHeightMm}
                        onChange={(e) => setInvoiceLogoHeightMm(Number(e.target.value))}
                        className="flex-1 accent-azure-mist-700"
                      />
                      <span className="text-ui-2xs font-mono text-jungle-teal-700 w-10 text-right">{invoiceLogoHeightMm}mm</span>
                    </div>
                  </div>
                </div>

                {/* The shop's signature, printed rather than signed by hand.
                    Only this side: the customer's line stays blank for them. */}
                <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mt-4 mb-1.5">
                  Authorised Signature
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-14 shrink-0 rounded-xl border border-jungle-teal-200 bg-white flex items-center justify-center overflow-hidden">
                    {invoiceSignature ? (
                      <img src={invoiceSignature} alt="Authorised signature" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-jungle-teal-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 bg-white hover:bg-azure-mist-50 border border-jungle-teal-200 hover:border-azure-mist-300 text-jungle-teal-700 text-ui-2xs font-semibold py-1.5 px-3 rounded-lg transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{invoiceSignature ? 'Replace' : 'Choose image'}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleSignaturePick} />
                      </label>
                      {invoiceSignature && (
                        <button
                          type="button"
                          onClick={() => setInvoiceSignature('')}
                          className="text-ui-2xs font-semibold text-rose-600 hover:text-rose-800 px-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-ui-2xs text-jungle-teal-500 shrink-0">Height</span>
                      <input
                        type="range"
                        min={6}
                        max={30}
                        value={invoiceSignatureHeightMm}
                        onChange={(e) => setInvoiceSignatureHeightMm(Number(e.target.value))}
                        className="flex-1 accent-azure-mist-700"
                      />
                      <span className="text-ui-2xs font-mono text-jungle-teal-700 w-10 text-right">{invoiceSignatureHeightMm}mm</span>
                    </div>
                    <p className="text-ui-2xs text-jungle-teal-500">
                      A scan on white, cropped close. Left empty, the invoice prints a blank line to sign.
                    </p>
                  </div>
                </div>
                <span className="text-ui-2xs text-jungle-teal-500 mt-1.5 block">
                  Scaled down to 600px and stored in the database, so it travels with a backup.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Document Title</label>
                  <input
                    type="text"
                    value={invoiceTitle}
                    onChange={(e) => setInvoiceTitle(e.target.value)}
                    placeholder="CASH MEMO"
                    className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600"
                  />
                  <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">Printed above the shop name. Leave blank for none.</span>
                </div>
                <div>
                  <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Header Line</label>
                  <input
                    type="text"
                    value={invoiceHeaderNote}
                    onChange={(e) => setInvoiceHeaderNote(e.target.value)}
                    placeholder="Trade Licence 12345 · VAT 0011"
                    className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 text-ui-sm text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600"
                  />
                  <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">Licence or registration number, under the name.</span>
                </div>
              </div>

              {/* ---- footer ---- */}
              <div>
                <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">Terms &amp; Conditions</label>
                <textarea
                  value={invoiceTerms}
                  onChange={(e) => setInvoiceTerms(e.target.value)}
                  rows={2}
                  placeholder="Goods once sold are not returnable without this memo."
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl px-3 py-2 text-ui-xs text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 resize-y"
                />
                <span className="text-ui-2xs text-jungle-teal-500 mt-1 block">
                  Printed under the footer note. The footer note itself is in Store Profile.
                </span>
              </div>

              <div>
                <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1.5">Show on the invoice</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  {INVOICE_FIELDS.map((field) => (
                    <label
                      key={field.key}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-jungle-teal-200/70 cursor-pointer"
                    >
                      <span className="text-ui-xs text-jungle-teal-800">{field.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={invoiceFields[field.key]}
                        aria-label={field.label}
                        onClick={() => setInvoiceFields((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden focus:ring-2 focus:ring-azure-mist-500 ${
                          invoiceFields[field.key] ? 'bg-azure-mist-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                            invoiceFields[field.key] ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </label>
                  ))}
                </div>
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

            {/* ---------------- live preview ---------------- */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">Preview</span>
                <span className="text-ui-2xs text-jungle-teal-400">
                  {previewBusy ? 'rendering…' : 'the real invoice, sample data'}
                </span>
                {previewUrl && (
                  <div className="ml-auto flex gap-3">
                    <button type="button" onClick={() => setPreviewFullscreen(true)} className="text-jungle-teal-600 hover:text-azure-mist-700 transition-colors flex items-center justify-center p-1 rounded hover:bg-jungle-teal-100" title="Full Screen">
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => { if (previewPdf) printInvoicePdf(previewPdf, 'preview').catch((err) => toast.error(err?.message || 'The preview could not be printed.')); }} className="text-jungle-teal-600 hover:text-azure-mist-700 transition-colors flex items-center justify-center p-1 rounded hover:bg-jungle-teal-100" title="Print">
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {/*
                The generated PDF, not a sketch of one.
                
                This panel used to draw its own approximation in HTML. It agreed
                with the printer only by coincidence, and once the A4 memo
                layout existed it stopped agreeing at all - no signature, none
                of the memo structure - so the options were being set against a
                picture of something that would never come out of the printer.
              */}
              <div className="rounded-xl border border-jungle-teal-200 bg-jungle-teal-100/60 p-3">
                {previewUrl ? (
                  <>
                    <iframe
                      id="preview-iframe"
                      title="Invoice preview"
                      src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                      className="w-full bg-white rounded-lg border border-jungle-teal-200 shadow-sm"
                      style={{ height: defaultInvoiceLayout === '80mm' ? 420 : 560 }}
                    />
                    {previewFullscreen && previewUrl && (
                  <div className="fixed inset-0 z-[9999] bg-slate-900/90 flex flex-col p-4 backdrop-blur-sm animate-fade-in">
                    <div className="flex justify-end mb-4">
                      <button 
                        onClick={() => setPreviewFullscreen(false)} 
                        className="bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
                      >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <iframe
                      src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                      className="w-full flex-1 bg-white rounded-lg shadow-2xl"
                    />
                  </div>
                )}
                  </>
                ) : (
                  <div className="h-[420px] flex items-center justify-center text-ui-xs text-jungle-teal-500">
                    {previewBusy ? 'Preparing the preview…' : previewError || 'The preview could not be prepared.'}
                  </div>
                )}
              </div>

              <label className="flex items-center justify-between gap-2 py-2 mt-2 cursor-pointer">
                <span className="text-ui-xs text-jungle-teal-800">
                  Signature line
                  <span className="block text-ui-2xs text-jungle-teal-500">A5 and A4 only — there is no room on a roll.</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={invoiceShowSignature}
                  aria-label="Signature line"
                  onClick={() => setInvoiceShowSignature((v) => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-hidden focus:ring-2 focus:ring-azure-mist-500 ${
                    invoiceShowSignature ? 'bg-azure-mist-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      invoiceShowSignature ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2 mt-1 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={() =>
                handleSaveSection('Store & Print Layout', {
                  shop_name: shopName.trim(),
                  invoice_shop_name: invoiceShopName.trim(),
                  shop_address: shopAddress.trim(),
                  shop_phone: shopPhone.trim(),
                  invoice_contacts: invoiceContacts.filter(c => c.name.trim() || c.phone.trim()),
                  invoice_footer: invoiceFooter.trim(),
                  default_invoice_layout: defaultInvoiceLayout,
                  invoice_signature: invoiceSignature,
                  invoice_signature_height_mm: invoiceSignatureHeightMm,
                  device_id_prefix: deviceIdPrefix.trim() || 'REG01',
                  invoice_margin_mm: invoiceMarginMm,
                  invoice_font_pt: invoiceFontPt,
                  invoice_show_address: invoiceFields.address,
                  invoice_show_phone: invoiceFields.phone,
                  invoice_show_qr: invoiceFields.qr,
                  invoice_show_cashier: invoiceFields.cashier,
                  invoice_show_name_bn: invoiceFields.nameBn,
                  invoice_show_footer: invoiceFields.footer,
                  invoice_show_logo: invoiceFields.logo,
                  invoice_logo: invoiceLogo,
                  invoice_logo_height_mm: invoiceLogoHeightMm,
                  invoice_title: invoiceTitle.trim(),
                  invoice_header_note: invoiceHeaderNote.trim(),
                  invoice_terms: invoiceTerms.trim(),
                  invoice_show_signature: invoiceShowSignature,
                  has_printer: hasPrinter,
                  receipt_printer_name: hasPrinter ? receiptPrinterName : '',
                  // Cannot be on without a printer to be on for; the dropdown
                  // clears it, and this makes sure of it at the point of saving.
                  silent_print: hasPrinter && Boolean(receiptPrinterName) && silentPrint,
                })
              }
              disabled={loading}
              className="h-9 px-5 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-xs flex items-center gap-2 shadow-sm transition-colors disabled:opacity-40"
            >
              <Save className="w-4 h-4" />
              <span>Save Print Layout</span>
            </button>
          </div>
          </div>
        )}


        {/* Keyboard Shortcuts sits outside the masonry above: seven rows of
            label plus key made it taller than any two other cards stacked, so
            whichever column took it ran long while the other ended halfway down
            the page. Full width, in two columns, it is half the height. */}
        {activeTab === 'shortcuts' && (
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs space-y-3.5 mb-6">
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
        
          <div className="grid grid-cols-1 min-[1150px]:grid-cols-2 gap-x-6">
            {SHORTCUT_DEFS.map((def) => {
              const isCapturing = capturing === def.id;
              const binding = keys[def.id];
              return (
                <div key={def.id} className="py-2.5 flex items-center gap-3 border-b border-jungle-teal-200/70">
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
        )}

        {/* Danger zone. At the bottom and on its own, rather than beside a
          harmless button, so it is only ever reached on purpose. */}
      {activeTab === 'advanced' && (
        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-xs mb-6">
          <div className="flex items-center gap-2 border-b border-rose-100 pb-3">
            <AlertCircle className="w-4 h-4 text-rose-600" />
          <h3 className="font-semibold text-ui-base text-rose-900">Danger Zone</h3>
          {appInfo?.version && (
            <span className="ml-auto text-ui-2xs text-jungle-teal-500 font-mono">v{appInfo.version}</span>
          )}
        </div>
        <div className="pt-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="text-ui-xs text-jungle-teal-700 max-w-2xl">
            <span className="font-semibold text-jungle-teal-900 block">Erase all business data</span>
            Removes every sale, purchase, product, customer, supplier and shift — for clearing practice data before
            going live. Staff logins, settings and the audit log stay. A full backup is saved first, and it asks for
            your password.
          </div>
          <button
            type="button"
            onClick={() => setShowEraseModal(true)}
            className="h-9 px-4 shrink-0 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-semibold rounded-xl text-ui-xs transition-colors"
          >
            Erase business data…
          </button>
          </div>
        </div>
      )}

      </div>
      </div>

      
      {showAdvancedAuth && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-50 p-6 text-center border-b border-rose-100">
              <Shield className="w-12 h-12 text-rose-600 mx-auto mb-3" />
              <h3 className="text-xl font-bold text-rose-900 tracking-tight">Owner Verification</h3>
              <p className="text-sm text-rose-700 mt-2 leading-relaxed">
                You are entering a sensitive area. Please enter the owner password to continue.
              </p>
            </div>
            <div className="p-6">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!window.api || advancedAuthBusy) return;
                  setAdvancedAuthBusy(true);
                  setAdvancedAuthError('');
                  try {
                    const res = await window.api.auth.verifyOwnerPassword({ password: advancedAuthPassword });
                    if (res.success) {
                      setShowAdvancedAuth(false);
                      setActiveTab('advanced');
                    } else {
                      setAdvancedAuthError(res.error || 'Incorrect password');
                    }
                  } catch (err: any) {
                    setAdvancedAuthError(err.message || 'Verification failed');
                  } finally {
                    setAdvancedAuthBusy(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Enter owner password"
                    value={advancedAuthPassword}
                    onChange={(e) => setAdvancedAuthPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:outline-hidden focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-shadow"
                    disabled={advancedAuthBusy}
                  />
                  {advancedAuthError && (
                    <p className="text-xs text-rose-600 font-medium mt-2">{advancedAuthError}</p>
                  )}
                </div>
                
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={advancedAuthBusy}
                    onClick={() => setShowAdvancedAuth(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={advancedAuthBusy || !advancedAuthPassword.trim()}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-white bg-rose-600 hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {advancedAuthBusy ? 'Verifying...' : 'Proceed'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <EraseDataModal
        isOpen={showEraseModal}
        onClose={() => setShowEraseModal(false)}
        onErased={handleErased}
      />
    </div>
  );
};
