import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Printer, ArrowRight, FileText, RefreshCw, AlertTriangle, Download, Sparkles, Copy, Check } from 'lucide-react';
import { Customer } from '../../types/ipc';
import { soundFx } from '../../utils/audio';
import { printInvoicePdf } from '../../utils/printPdf';
import { useToast } from '../../context/ToastContext';

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
  /** False at a counter with no printer: offer Save PDF where Re-Print would be. */
  hasPrinter?: boolean;
  onViewInvoice?: () => void;
  /**
   * The paper this sale was rung up on. The quick print after a sale used to
   * hardcode `size: 80mm auto`, so a shop set to A5 or A4 still got a receipt
   * cut to a thermal roll.
   */
  layout?: '80mm' | 'a4';
  /** The PDF this sale produced - the document that gets printed. */
  pdfBase64?: string;
}

const PAGE_CSS: Record<'80mm' | 'a4', { margin: string; size: string; padding: string; fontSize: string }> = {
  '80mm': { margin: '3mm', size: '80mm auto', padding: '4px', fontSize: '12px' },
  a4: { margin: '12mm', size: 'A4 portrait', padding: '20px', fontSize: '14px' },
};

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
  hasPrinter = true,
  onViewInvoice,
  layout = '80mm',
  pdfBase64,
}) => {
  const [printStatus, setPrintStatus] = useState<'idle' | 'printing' | 'success' | 'failed'>('idle');
  /** Why the last print failed, in words the cashier can act on. */
  const [printError, setPrintError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [copied, setCopied] = useState(false);
  const printTriggeredRef = useRef(false);
  const toast = useToast();

  useEffect(() => {
    if (!isOpen) setSaveStatus('idle');
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      soundFx.playSuccessChime();
      // Never at a counter with no printer: the print dialog would open over
      // the success screen with nothing to send the receipt to.
      if (autoPrint && hasPrinter && !printTriggeredRef.current) {
        printTriggeredRef.current = true;
        handleTriggerPrint();
      } else {
        setPrintStatus('idle');
      }
    } else {
      printTriggeredRef.current = false;
      setPrintStatus('idle');
      setPrintError(null);
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
        // The same key does the same job either way: hand the customer a copy.
        if (hasPrinter) handleTriggerPrint();
        else handleSavePdf();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onNewSale, hasPrinter]);

  if (!isOpen) return null;

  /*
   * Prints the PDF the sale already produced.
   *
   * This used to rebuild the whole receipt as an HTML string - shop header,
   * item rows, totals, the lot - and open a second window for it. Electron
   * denies window.open, so it fell back to window.print() and the printer got
   * a picture of the POS screen. It was also a third drawing of the invoice,
   * free to disagree with both the PDF and the memo view, and it did.
   */
  /*
   * The sale is already saved by the time this runs, so nothing here may get
   * in the way of the next customer: the counter keeps working while the job
   * spools, and a failure is reported, never thrown. The toast carries the
   * failure beyond this modal - a cashier who has pressed Enter and moved on
   * still learns that the last receipt did not come out.
   */
  const handleTriggerPrint = async () => {
    if (printStatus === 'printing') return;
    setPrintError(null);

    const fail = (reason: string) => {
      setPrintStatus('failed');
      setPrintError(reason);
      toast.showToast('error', `Invoice #${invoiceNo}: ${reason}`, 'Receipt did not print', 8000);
    };

    if (!pdfBase64) {
      fail('No invoice document was produced for this sale. Print it again from Transactions.');
      return;
    }
    if (!window.api?.print) {
      fail('Printing is not available in this window.');
      return;
    }

    setPrintStatus('printing');
    try {
      const res = await printInvoicePdf(pdfBase64, `invoice-${invoiceNo}`);
      if (res.cancelled) {
        // Closing the dialog is a choice, not a fault.
        setPrintStatus('idle');
      } else {
        setPrintStatus('success');
      }
    } catch (err: any) {
      console.error('Print failed:', err);
      fail(err?.message || 'The printer did not accept the receipt.');
    }
  };

  /** Asks where to keep the bill, writes the PDF the sale produced, and opens it. */
  const handleSavePdf = async () => {
    if (!pdfBase64 || !window.api?.print?.savePdf) {
      setSaveStatus('failed');
      return;
    }
    setSaveStatus('saving');
    try {
      const res = await window.api.print.savePdf({ pdfBase64, fileName: `invoice-${invoiceNo}` });
      // Closing the Save dialog is not a failure; the button just rests again.
      setSaveStatus(res.success ? 'saved' : 'idle');
    } catch (err) {
      console.error('Save PDF failed:', err);
      setSaveStatus('failed');
    }
  };

  const handleCopyInvoice = () => {
    navigator.clipboard.writeText(invoiceNo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
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
                ? 'Sending the receipt to the printer...'
                : 'Sale completed and saved.'}
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
            <span className="font-extrabold text-jungle-teal-900 text-base">৳ {(totalPaisa / 100).toFixed(2)}</span>
          </div>

          {/* Change Highlight */}
          {changePaisa > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-emerald-800 font-bold text-xs font-sans">Change Returned:</span>
              <span className="text-emerald-900 font-extrabold text-base font-mono">৳ {(changePaisa / 100).toFixed(2)}</span>
            </div>
          )}

          {duePaisa > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between">
              <span className="text-amber-800 font-bold text-xs font-sans">Customer Due:</span>
              <span className="text-amber-900 font-extrabold text-base font-mono">৳ {(duePaisa / 100).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Printer Status & Re-Print Helper */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            {hasPrinter ? (
              <button
                type="button"
                onClick={handleTriggerPrint}
                disabled={printStatus === 'printing'}
                className="flex-1 py-2.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-jungle-teal-300 transition-colors active:scale-95"
              >
                <Printer className="w-4 h-4 text-jungle-teal-600" />
                <span>{printStatus === 'printing' ? 'Printing…' : 'Re-Print Receipt (F8)'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSavePdf}
                disabled={saveStatus === 'saving' || !pdfBase64}
                className="flex-1 py-2.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-jungle-teal-300 transition-colors active:scale-95 disabled:opacity-60"
              >
                {saveStatus === 'saved' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Download className="w-4 h-4 text-jungle-teal-600" />
                )}
                <span>
                  {saveStatus === 'saving'
                    ? 'Saving…'
                    : saveStatus === 'saved'
                      ? 'Saved — opened'
                      : saveStatus === 'failed'
                        ? 'Could not save — try again'
                        : 'Save PDF (F8)'}
                </span>
              </button>
            )}

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

          {/*
            Print outcome. Shown beside the actions rather than over them: the
            receipt is a courtesy copy, and a printer that is off must never
            stop the counter from taking the next customer.
          */}
          {printStatus === 'failed' && printError ? (
            <div
              role="alert"
              className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-2.5 text-[11px] text-red-900 font-sans"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Receipt did not print</p>
                <p>{printError}</p>
                <p className="text-red-700">
                  Press <span className="font-bold">Re-Print (F8)</span> to try again, or print later from Transactions. The sale is saved.
                </p>
              </div>
            </div>
          ) : printStatus === 'success' ? (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-700 text-center font-sans">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Receipt sent to the printer.
            </p>
          ) : printStatus === 'printing' ? (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-azure-mist-700 text-center font-sans">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Printing the receipt… you can start the next sale meanwhile.
            </p>
          ) : (
            <p className="text-[11px] text-jungle-teal-600 text-center font-sans">
              {hasPrinter ? (
                <>
                  💡 If the printer plays up, press <span className="font-bold text-jungle-teal-900">Re-Print</span>, or print again from Transactions at any time.
                </>
              ) : (
                <>
                  💡 Any bill can be viewed or saved again later from <span className="font-bold text-jungle-teal-900">Transactions</span>.
                </>
              )}
            </p>
          )}
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
