import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Printer, ArrowRight, FileText, RefreshCw, AlertTriangle, Download, Sparkles, Copy, Check } from 'lucide-react';
import { Customer } from '../../types/ipc';
import { soundFx } from '../../utils/audio';

interface SaleSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNewSale: () => void;
  invoiceNo: string;
  totalPaisa: number;
  paidPaisa: number;
  changePaisa: number;
  duePaisa: number;
  paymentMethodSummary: string;
  customer?: Customer | null;
  autoPrint?: boolean;
  onViewInvoice?: () => void;
}

export const SaleSuccessModal: React.FC<SaleSuccessModalProps> = ({
  isOpen,
  onClose,
  onNewSale,
  invoiceNo,
  totalPaisa,
  paidPaisa,
  changePaisa,
  duePaisa,
  paymentMethodSummary,
  customer,
  autoPrint = false,
  onViewInvoice,
}) => {
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | 'failed'>('idle');
  const [copied, setCopied] = useState(false);
  const printTriggeredRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      soundFx.playSuccessChime();
      if (autoPrint && !printTriggeredRef.current) {
        printTriggeredRef.current = true;
        handleTriggerPrint();
      } else {
        setPrintStatus('idle');
      }
    } else {
      printTriggeredRef.current = false;
      setPrintStatus('idle');
    }
  }, [isOpen, autoPrint]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onNewSale();
      } else if (e.key === 'F8' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        e.stopPropagation();
        handleTriggerPrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onNewSale]);

  if (!isOpen) return null;

  const handleTriggerPrint = async () => {
    setPrintStatus('printing');
    try {
      if (window.api && invoiceNo) {
        const [saleRes, settingsRes] = await Promise.all([
          window.api.sales.getByInvoice(invoiceNo).catch(() => null),
          window.api.settings.get().catch(() => null),
        ]);

        const printWindow = window.open('', '', 'width=800,height=900');
        if (!printWindow) {
          window.print();
          setPrintStatus('success');
          return;
        }

        const items = saleRes?.items || [];
        const shopName = settingsRes?.shop_name || 'Mechanical Workshop';
        const shopAddress = settingsRes?.shop_address || 'Dhaka, Bangladesh';
        const shopPhone = settingsRes?.shop_phone || '';
        const invoiceFooter = settingsRes?.invoice_footer || 'Thank you for your business!';

        const subtotalTaka = ((saleRes?.subtotal_paisa || totalPaisa) / 100).toFixed(2);
        const discountTaka = ((saleRes?.discount_paisa || 0) / 100).toFixed(2);
        const totalTaka = ((totalPaisa) / 100).toFixed(2);
        const paidTaka = ((paidPaisa) / 100).toFixed(2);
        const changeTaka = ((changePaisa) / 100).toFixed(2);
        const dueTaka = ((duePaisa) / 100).toFixed(2);

        printWindow.document.open();
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Invoice #${invoiceNo}</title>
              <meta charset="utf-8" />
              <style>
                @page { margin: 4mm; size: 80mm auto; }
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  color: #0f172a;
                  background: #ffffff;
                  margin: 0;
                  padding: 4px;
                  font-size: 12px;
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
                @media print {
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
              </style>
            </head>
            <body>
              <div class="text-center pb-3 border-b">
                <h2 style="font-weight: 800; font-size: 16px; margin: 0; text-transform: uppercase;">${shopName}</h2>
                <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">${shopAddress}</p>
                ${shopPhone ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">Phone: ${shopPhone}</p>` : ''}
              </div>

              <div class="my-2 border-b font-mono" style="font-size: 11px; padding-bottom: 6px;">
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:#64748b;">Invoice:</span>
                  <span class="font-bold">${invoiceNo}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:2px;">
                  <span style="color:#64748b;">Date:</span>
                  <span>${new Date().toLocaleString()}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:2px;">
                  <span style="color:#64748b;">Customer:</span>
                  <span class="font-bold">${customer?.name || 'Walking Retail Customer'}</span>
                </div>
              </div>

              <table class="my-2">
                <thead>
                  <tr>
                    <th class="text-left">Item</th>
                    <th class="text-center">Qty</th>
                    <th class="text-right">Price</th>
                    <th class="text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="font-mono" style="font-size: 11.5px;">
                  ${items.map((it: any) => `
                    <tr>
                      <td style="padding: 4px 2px; font-family: sans-serif;">${it.product_name || it.name}</td>
                      <td class="text-center font-bold" style="padding: 4px 2px;">${it.qty}</td>
                      <td class="text-right" style="padding: 4px 2px;">৳${(it.unit_price_paisa / 100).toFixed(2)}</td>
                      <td class="text-right font-bold" style="padding: 4px 2px;">৳${(((it.unit_price_paisa * it.qty) - (it.discount_paisa || 0)) / 100).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              <div class="border-t my-2 font-mono" style="font-size: 11.5px; padding-top: 6px;">
                <div style="display:flex; justify-content:space-between; color:#475569;">
                  <span>Subtotal:</span>
                  <span>৳ ${subtotalTaka}</span>
                </div>
                ${Number(discountTaka) > 0 ? `
                  <div style="display:flex; justify-content:space-between; color:#b45309; font-weight:bold;">
                    <span>Discount:</span>
                    <span>- ৳ ${discountTaka}</span>
                  </div>
                ` : ''}
                <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:800; border-top:1px solid #e2e8f0; margin-top:4px; padding-top:4px;">
                  <span>Total Payable:</span>
                  <span>৳ ${totalTaka}</span>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:2px;">
                  <span>Paid (${paymentMethodSummary}):</span>
                  <span class="font-bold">৳ ${paidTaka}</span>
                </div>
                ${Number(changeTaka) > 0 ? `
                  <div style="display:flex; justify-content:space-between; font-weight:bold; color:#065f46; margin-top:2px;">
                    <span>Change Returned:</span>
                    <span>৳ ${changeTaka}</span>
                  </div>
                ` : ''}
                ${Number(dueTaka) > 0 ? `
                  <div style="display:flex; justify-content:space-between; font-weight:bold; color:#991b1b; margin-top:2px;">
                    <span>Remaining Due:</span>
                    <span>৳ ${dueTaka}</span>
                  </div>
                ` : ''}
              </div>

              <div class="text-center pt-3" style="font-size: 10.5px; color: #64748b;">
                <p style="margin: 0; font-weight: bold; color: #1e293b;">${invoiceFooter}</p>
                <p style="margin: 4px 0 0 0; font-size: 9.5px; font-family: monospace;">POS · Verified Transaction</p>
              </div>

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
        setTimeout(() => setPrintStatus('success'), 1200);
      } else {
        setPrintStatus('success');
      }
    } catch (err) {
      console.error('Print trigger error:', err);
      setPrintStatus('failed');
    }
  };

  const handleCopyInvoice = () => {
    navigator.clipboard.writeText(invoiceNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-3xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 flex flex-col space-y-5 animate-in zoom-in-95 duration-200 font-sans">
        
        {/* Animated Badge & Status Header */}
        <div className="text-center space-y-2 pt-2">
          {printStatus === 'printing' ? (
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-azure-mist-100 border border-azure-mist-300 flex items-center justify-center text-azure-mist-700 shadow-inner animate-pulse">
                <Printer className="w-8 h-8 animate-bounce" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-azure-mist-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-azure-mist-600"></span>
              </span>
            </div>
          ) : (
            <div className="relative inline-flex items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <span className="absolute -bottom-1 -right-1 p-1 bg-amber-400 text-slate-900 rounded-full shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
            </div>
          )}

          <div>
            <h2 className="text-ui-lg font-black text-jungle-teal-950">
              {printStatus === 'printing' ? 'Printing Receipt…' : 'Bill Completed Successfully!'}
            </h2>
            <p className="text-ui-xs text-jungle-teal-600">
              {printStatus === 'printing'
                ? 'রিসিট প্রিন্টারে পাঠানো হচ্ছে...'
                : 'বিক্রয় সফলভাবে সম্পন্ন ও ডাটাবেসে সংরক্ষিত হয়েছে।'}
            </p>
          </div>
        </div>

        {/* Invoice Summary Card */}
        <div className="bg-white rounded-2xl p-4 border border-jungle-teal-200 shadow-xs space-y-3 font-mono">
          <div className="flex items-center justify-between pb-2.5 border-b border-dashed border-slate-200 text-xs">
            <span className="text-slate-500 font-sans">Invoice No:</span>
            <div className="flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
              <span>{invoiceNo}</span>
              <button
                type="button"
                onClick={handleCopyInvoice}
                className="text-slate-400 hover:text-slate-700 p-0.5"
                title="Copy Invoice No"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-sans">Customer:</span>
            <span className="font-bold text-slate-800 font-sans">
              {customer?.name || 'Walk-in Retail Customer'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-sans">Paid Amount:</span>
            <span className="font-bold text-slate-800">
              ৳ {(paidPaisa / 100).toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">({paymentMethodSummary})</span>
            </span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-sm">
            <span className="font-bold text-slate-700 font-sans">Total Bill:</span>
            <span className="font-extrabold text-slate-950 text-base">৳ {(totalPaisa / 100).toFixed(2)}</span>
          </div>

          {/* Change Highlight */}
          {changePaisa > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-emerald-800 font-bold text-xs font-sans">ফেরত টাকা (Change Return):</span>
              <span className="text-emerald-900 font-extrabold text-base font-mono">৳ {(changePaisa / 100).toFixed(2)}</span>
            </div>
          )}

          {duePaisa > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-amber-800 font-bold text-xs font-sans">বকেয়া (Customer Due):</span>
              <span className="text-amber-900 font-extrabold text-base font-mono">৳ {(duePaisa / 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Printer Status & Re-Print Helper */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleTriggerPrint}
              disabled={printStatus === 'printing'}
              className="flex-1 py-2.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-jungle-teal-300 transition-colors active:scale-95"
            >
              <Printer className="w-4 h-4 text-jungle-teal-600" />
              <span>{printStatus === 'printing' ? 'Printing…' : 'Re-Print Receipt (F8)'}</span>
            </button>

            {onViewInvoice && (
              <button
                type="button"
                onClick={onViewInvoice}
                className="px-3 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-slate-300 transition-colors active:scale-95"
                title="View Full Invoice / Download PDF"
              >
                <FileText className="w-4 h-4 text-azure-mist-700" />
                <span>View Memo</span>
              </button>
            )}
          </div>

          <p className="text-[11px] text-jungle-teal-600 text-center font-sans">
            💡 প্রিন্টারে কোনো সমস্যা হলে <span className="font-bold text-jungle-teal-900">Re-Print</span> চাপুন বা সেলস হিস্ট্রি থেকে যেকোনো সময় প্রিন্ট করুন।
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="pt-1">
          <button
            type="button"
            autoFocus
            onClick={onNewSale}
            className="w-full py-3.5 bg-linear-to-r from-muted-teal-700 to-muted-teal-600 hover:from-muted-teal-800 hover:to-muted-teal-700 text-white font-extrabold rounded-2xl text-ui-sm flex items-center justify-center gap-2 shadow-lg shadow-muted-teal-900/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Start Next Sale (Enter / Space)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
