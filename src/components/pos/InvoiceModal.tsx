import React, { useState, useEffect } from 'react';
import { Printer, Download, X, FileText, CheckCircle2, RefreshCw, QrCode, Phone, MapPin, User, Calendar, Tag, ShieldCheck } from 'lucide-react';
import { usePdfObjectUrl } from '../../utils/pdfObjectUrl';
import { printInvoicePdf } from '../../utils/printPdf';
import { ShopSettings } from '../../types/ipc';

const LAYOUT_TABS: Array<{ id: '80mm' | 'a4'; label: string }> = [
  { id: '80mm', label: '80mm' },
  { id: 'a4', label: 'A4' },
];

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNo: string;
  pdfBase64?: string;
  layout?: '80mm' | 'a4';
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  invoiceNo,
  pdfBase64: initialPdf,
  layout = '80mm',
}) => {
  const [currentLayout, setCurrentLayout] = useState<'80mm' | 'a4'>(layout);
  const [pdfData, setPdfData] = useState<string>(initialPdf || '');
  const [saleDetails, setSaleDetails] = useState<any>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const pdfUrl = usePdfObjectUrl(pdfData);
  // Read with the rest of the shop settings below; a counter is taken to have a
  // printer until those arrive, so a printing shop never sees its button vanish.
  const hasPrinter = shopSettings ? shopSettings.has_printer !== false : true;

  const loadInvoiceData = async (targetLayout: '80mm' | 'a4') => {
    if (!window.api || !invoiceNo) return;
    setLoading(true);
    setError(null);
    try {
      const [saleRes, settingsRes, pdfRes] = await Promise.all([
        window.api.sales.getByInvoice(invoiceNo).catch(() => null),
        window.api.settings.get().catch(() => null),
        window.api.sales.generatePdf({ invoice_no: invoiceNo, layout: targetLayout }).catch(() => null),
      ]);

      if (saleRes) {
        setSaleDetails(saleRes);
      }
      if (settingsRes) {
        setShopSettings(settingsRes);
      }
      if (pdfRes && pdfRes.pdfBase64) {
        setPdfData(pdfRes.pdfBase64);
      }
    } catch (err: any) {
      console.error('Failed to load invoice details:', err);
      setError(err.message || 'Failed to load invoice receipt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && invoiceNo) {
      // The modal stays mounted between bills; "Saved" belongs to the last one.
      setSaveState('idle');
      loadInvoiceData(currentLayout);
    }
  }, [isOpen, invoiceNo]);

  if (!isOpen) return null;

  /*
   * Prints the PDF, not the screen.
   *
   * This built a fresh HTML document and opened a second window for it.
   * Electron denies window.open (electron/security.ts), so it fell through to
   * window.print() - which prints the renderer, sidebar and all. That is the
   * "screenshot" that came out of the printer instead of an invoice. The
   * generated PDF goes to the main process, which prints the document itself.
   */
  const handlePrint = async () => {
    if (!pdfData || !window.api?.print) return;
    setPrinting(true);
    try {
      await printInvoicePdf(pdfData, `invoice-${invoiceNo}`);
    } catch (err: any) {
      setError(err?.message || 'The invoice could not be sent to the printer.');
    } finally {
      setPrinting(false);
    }
  };

  /*
   * Saves through the main process, which asks where and then opens the file.
   *
   * An <a download> pointed at a data: URL started a download Electron never
   * showed: no location asked, nothing opened, so the button looked as though
   * it did nothing at all.
   */
  const handleDownload = async () => {
    if (!pdfData || !window.api?.print?.savePdf) return;
    setSaveState('saving');
    setError(null);
    try {
      const res = await window.api.print.savePdf({
        pdfBase64: pdfData,
        fileName: `Invoice-${invoiceNo}-${currentLayout}`,
      });
      setSaveState(res.success ? 'saved' : 'idle');
    } catch (err: any) {
      setSaveState('idle');
      setError(err?.message || 'The PDF could not be saved.');
    }
  };

  const shopName = shopSettings?.shop_name || 'Mechanical Parts & Hardware Shop';
  const shopAddress = shopSettings?.shop_address || 'Dhaka, Bangladesh';
  const shopPhone = shopSettings?.shop_phone || '';
  const invoiceFooter = shopSettings?.invoice_footer || 'Thank you for your business!';

  // The same switches the PDF obeys. This preview is also what the browser
  // print path renders, so leaving them out here would print a different
  // invoice from the one the PDF produces.
  const logo = shopSettings?.invoice_logo || '';
  const logoHeightMm = shopSettings?.invoice_logo_height_mm ?? 12;
  const invoiceTitle = shopSettings?.invoice_title || '';
  const headerNote = shopSettings?.invoice_header_note || '';
  const terms = shopSettings?.invoice_terms || '';

  const show = {
    logo: shopSettings?.invoice_show_logo ?? true,
    signature: shopSettings?.invoice_show_signature ?? false,
    address: shopSettings?.invoice_show_address ?? true,
    phone: shopSettings?.invoice_show_phone ?? true,
    cashier: shopSettings?.invoice_show_cashier ?? true,
    nameBn: shopSettings?.invoice_show_name_bn ?? true,
    footer: shopSettings?.invoice_show_footer ?? true,
  };

  const items = saleDetails?.items || [];
  const subtotalTaka = ((saleDetails?.subtotal_paisa || 0) / 100).toFixed(2);
  const discountTaka = ((saleDetails?.discount_paisa || 0) / 100).toFixed(2);
  const totalTaka = (((saleDetails?.final_amount_paisa ?? saleDetails?.total_paisa) || 0) / 100).toFixed(2);

  const payments = saleDetails?.payments || [];
  const totalPaidTaka = (payments.reduce((sum: number, p: any) => sum + (p.amount_paisa || 0), 0) / 100).toFixed(2);
  const dueTaka = Math.max(0, ((saleDetails?.total_paisa || 0) - payments.reduce((sum: number, p: any) => sum + (p.amount_paisa || 0), 0)) / 100).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-6 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-muted-teal-100 text-muted-teal-800 rounded-2xl border border-muted-teal-200 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-ui-md font-bold text-jungle-teal-900">Sale Receipt & Invoice</h3>
              <p className="text-ui-2xs text-jungle-teal-600 font-mono">Invoice #{invoiceNo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-jungle-teal-100 p-1 rounded-xl border border-jungle-teal-200 text-ui-xs">
              {LAYOUT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setCurrentLayout(tab.id);
                    // A different paper is a different file; "Saved" was about
                    // the previous one.
                    setSaveState('idle');
                    loadInvoiceData(tab.id);
                  }}
                  className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                    currentLayout === tab.id
                      ? 'bg-azure-mist-700 text-white font-bold shadow-xs'
                      : 'text-jungle-teal-600 hover:text-jungle-teal-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-2 text-jungle-teal-600 hover:text-jungle-teal-800 hover:bg-jungle-teal-100 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-ui-xs font-sans">
            {error}
          </div>
        )}

        {/* Live Receipt Container */}
        <div className="bg-jungle-teal-100/50 p-4 rounded-2xl border border-jungle-teal-200 flex justify-center max-h-[500px] overflow-y-auto shadow-inner">
          {loading && !saleDetails ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-jungle-teal-500 text-ui-sm">
              <RefreshCw className="w-7 h-7 animate-spin text-azure-mist-700" />
              <span className="font-semibold">Loading invoice and receipt data...</span>
            </div>
          ) : pdfUrl ? (
            /*
              The generated PDF itself, not a second drawing of it.
              
              This panel used to lay the invoice out again in HTML - its own
              header, its own table, its own totals - while the PDF that
              actually reached the customer was built separately by
              invoicePdf.ts. Two drawings of one bill drift apart the moment
              either is touched, and they had: the preview never showed what
              came out of the printer. Shown as the PDF, they cannot disagree.
            */
            <iframe
              title={`Invoice ${invoiceNo}`}
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="w-full bg-white rounded-xl border border-slate-200 shadow-md"
              style={{ height: currentLayout === '80mm' ? 520 : 680 }}
            />
          ) : (
            <div className="p-12 text-center text-jungle-teal-500 font-sans text-ui-sm">
              This invoice could not be prepared. Close and try again.
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-jungle-teal-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-ui-xs font-semibold transition-colors"
          >
            Close Window
          </button>

          <div className="flex items-center gap-2.5">
            {pdfData && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={saveState === 'saving'}
                className={
                  hasPrinter
                    ? 'px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-xl text-ui-xs font-semibold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors disabled:opacity-60'
                    : // With no printer this is the way the bill leaves the shop, so
                      // it takes the place and the weight of the Print button.
                      'px-6 py-2.5 bg-linear-to-r from-azure-mist-700 to-azure-mist-600 hover:from-azure-mist-600 hover:to-azure-mist-500 text-white rounded-xl text-ui-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-60'
                }
              >
                {saveState === 'saved' ? (
                  <CheckCircle2 className={`w-4 h-4 ${hasPrinter ? 'text-emerald-600' : ''}`} />
                ) : (
                  <Download className={`w-4 h-4 ${hasPrinter ? 'text-azure-mist-700' : ''}`} />
                )}
                <span>{saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved — opened' : 'Save PDF'}</span>
              </button>
            )}

            {hasPrinter && (
              <button
                type="button"
                onClick={handlePrint}
                disabled={!pdfData || printing}
                className="px-6 py-2.5 bg-linear-to-r from-azure-mist-700 to-azure-mist-600 hover:from-azure-mist-600 hover:to-azure-mist-500 text-white rounded-xl text-ui-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>{printing ? 'Sending to printer…' : 'Print Invoice'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
