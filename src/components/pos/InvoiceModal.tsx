import React, { useState, useEffect, useRef } from 'react';
import { Printer, Download, X, FileText, CheckCircle2, RefreshCw, QrCode, Phone, MapPin, User, Calendar, Tag, ShieldCheck } from 'lucide-react';
import { ShopSettings } from '../../types/ipc';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoiceNo: string;
  pdfBase64?: string;
  layout?: '80mm' | 'a5';
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  invoiceNo,
  pdfBase64: initialPdf,
  layout = '80mm',
}) => {
  const [currentLayout, setCurrentLayout] = useState<'80mm' | 'a5'>(layout);
  const [pdfData, setPdfData] = useState<string>(initialPdf || '');
  const [saleDetails, setSaleDetails] = useState<any>(null);
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const loadInvoiceData = async (targetLayout: '80mm' | 'a5') => {
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
      loadInvoiceData(currentLayout);
    }
  }, [isOpen, invoiceNo]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (!printAreaRef.current) {
      window.print();
      return;
    }

    const printContent = printAreaRef.current.innerHTML;
    const printWindow = window.open('', '', 'width=800,height=900');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${invoiceNo}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              margin: ${currentLayout === '80mm' ? '4mm' : '10mm'};
              size: ${currentLayout === '80mm' ? '80mm auto' : 'A5 portrait'};
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #0f172a;
              background: #ffffff;
              margin: 0;
              padding: ${currentLayout === '80mm' ? '4px' : '16px'};
              font-size: ${currentLayout === '80mm' ? '12px' : '13px'};
              line-height: 1.35;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold { font-weight: 700; }
            .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
            .border-b { border-bottom: 1px dashed #cbd5e1; }
            .border-t { border-top: 1px dashed #cbd5e1; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .w-full { width: 100%; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 4px 2px; }
            th { border-bottom: 1px solid #0f172a; font-size: 11px; text-transform: uppercase; }
            .totals-row td { padding: 2px 0; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownload = () => {
    if (!pdfData) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfData}`;
    link.download = `Invoice-${invoiceNo}-${currentLayout}.pdf`;
    link.click();
  };

  const shopName = shopSettings?.shop_name || 'Mechanical Parts & Hardware Shop';
  const shopAddress = shopSettings?.shop_address || 'Dhaka, Bangladesh';
  const shopPhone = shopSettings?.shop_phone || '';
  const invoiceFooter = shopSettings?.invoice_footer || 'Thank you for your business!';

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
              <button
                onClick={() => {
                  setCurrentLayout('80mm');
                  loadInvoiceData('80mm');
                }}
                className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                  currentLayout === '80mm'
                    ? 'bg-azure-mist-700 text-white font-bold shadow-xs'
                    : 'text-jungle-teal-600 hover:text-jungle-teal-900'
                }`}
              >
                80mm Thermal
              </button>
              <button
                onClick={() => {
                  setCurrentLayout('a5');
                  loadInvoiceData('a5');
                }}
                className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                  currentLayout === 'a5'
                    ? 'bg-azure-mist-700 text-white font-bold shadow-xs'
                    : 'text-jungle-teal-600 hover:text-jungle-teal-900'
                }`}
              >
                A5 Formal
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-jungle-teal-400 hover:text-jungle-teal-800 hover:bg-jungle-teal-100 rounded-xl transition-colors"
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
          ) : (
            <div
              ref={printAreaRef}
              className={`bg-white text-slate-900 shadow-md border border-slate-200 rounded-xl p-6 font-sans transition-all ${
                currentLayout === '80mm' ? 'w-[320px] text-xs' : 'w-full max-w-[520px] text-sm'
              }`}
            >
              {/* Shop Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h2 className="font-extrabold text-base tracking-tight text-slate-900 uppercase">{shopName}</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">{shopAddress}</p>
                {shopPhone && <p className="text-[11px] text-slate-600">Mobile: {shopPhone}</p>}
              </div>

              {/* Invoice Meta */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="font-bold text-slate-900">{saleDetails?.invoice_no || invoiceNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="text-slate-800">
                    {saleDetails?.created_at
                      ? new Date(saleDetails.created_at).toLocaleString('en-GB')
                      : new Date().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cashier:</span>
                  <span className="text-slate-800">{saleDetails?.cashier_name || 'Staff'}</span>
                </div>
                {saleDetails?.customer_name && (
                  <div className="flex justify-between pt-1 border-t border-slate-100 font-sans">
                    <span className="text-slate-500">Customer:</span>
                    <span className="font-bold text-slate-900">
                      {saleDetails.customer_name} {saleDetails.customer_phone ? `(${saleDetails.customer_phone})` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Items List Table */}
              <div className="py-3 border-b border-dashed border-slate-300">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase font-mono text-slate-600">
                      <th className="pb-1">Item</th>
                      <th className="pb-1 text-center">Qty</th>
                      <th className="pb-1 text-right">Price</th>
                      <th className="pb-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11.5px] font-mono">
                    {items.map((it: any, idx: number) => {
                      const linePrice = (it.unit_price_paisa / 100).toFixed(2);
                      const lineTotal = (((it.unit_price_paisa * it.qty) - (it.discount_paisa || 0)) / 100).toFixed(2);
                      return (
                        <tr key={idx} className="py-1">
                          <td className="py-1.5 font-sans font-medium text-slate-900 pr-1">
                            <div>{it.product_name || it.name}</div>
                            {it.product_name_bn && (
                              <div className="text-[10px] text-slate-500">{it.product_name_bn}</div>
                            )}
                          </td>
                          <td className="py-1.5 text-center font-bold text-slate-800">{it.qty}</td>
                          <td className="py-1.5 text-right text-slate-600">৳{linePrice}</td>
                          <td className="py-1.5 text-right font-bold text-slate-900">৳{lineTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Calculations & Totals */}
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[11.5px] font-mono space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>৳ {subtotalTaka}</span>
                </div>
                {Number(discountTaka) > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Discount:</span>
                    <span>- ৳ {discountTaka}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span>৳ {totalTaka}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Total Paid:</span>
                  <span className="font-bold text-emerald-800">৳ {totalPaidTaka}</span>
                </div>
                {Number(dueTaka) > 0 && (
                  <div className="flex justify-between text-rose-700 font-extrabold">
                    <span>Remaining Due:</span>
                    <span>৳ {dueTaka}</span>
                  </div>
                )}
              </div>

              {/* Payment Methods Breakdown */}
              {payments.length > 0 && (
                <div className="py-2 text-[10.5px] font-mono text-slate-600 border-b border-dashed border-slate-300">
                  <span className="font-bold text-slate-800">Payment: </span>
                  {payments.map((p: any, i: number) => (
                    <span key={i}>
                      {p.method?.toUpperCase()} (৳{((p.amount_paisa || 0) / 100).toFixed(2)})
                      {i < payments.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}

              {/* Footer Notice & Software Attribution */}
              <div className="pt-3 text-center text-[10.5px] text-slate-500 font-sans space-y-1">
                <p className="font-semibold text-slate-800">{invoiceFooter}</p>
                <div className="flex items-center justify-center gap-1 text-[9.5px] text-slate-400 font-mono pt-1">
                  <ShieldCheck className="w-3 h-3 text-muted-teal-600" />
                  <span>Mechanical Shop POS · Verified Transaction</span>
                </div>
              </div>
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
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-xl text-ui-xs font-semibold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors"
              >
                <Download className="w-4 h-4 text-azure-mist-700" />
                <span>Download PDF</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-6 py-2.5 bg-linear-to-r from-azure-mist-700 to-azure-mist-600 hover:from-azure-mist-600 hover:to-azure-mist-500 text-white rounded-xl text-ui-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
