import React, { useState, useEffect } from 'react';
import { RotateCcw, Printer, Download, X, RefreshCw, CheckCircle2, ExternalLink } from 'lucide-react';
import { usePdfObjectUrl } from '../../utils/pdfObjectUrl';

interface ReturnInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The RTN-... return invoice number to load and display. */
  returnInvoiceNo: string;
  /** Called when the user clicks the original invoice link so the parent can open it. */
  onOpenOriginalInvoice?: (invoiceNo: string) => void;
}

export const ReturnInvoiceModal: React.FC<ReturnInvoiceModalProps> = ({
  isOpen,
  onClose,
  returnInvoiceNo,
  onOpenOriginalInvoice,
}) => {
  const [pdfData, setPdfData] = useState('');
  const [returnDetails, setReturnDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const pdfUrl = usePdfObjectUrl(pdfData);

  const loadData = async () => {
    if (!window.api || !returnInvoiceNo) return;
    setLoading(true);
    setError(null);
    try {
      const [detailsRes, pdfRes] = await Promise.all([
        window.api.sales.getReturnByInvoice(returnInvoiceNo).catch(() => null),
        window.api.sales.generateReturnPdf({ return_invoice_no: returnInvoiceNo, layout: '80mm' }).catch(() => null),
      ]);
      if (detailsRes) setReturnDetails(detailsRes);
      if (pdfRes?.pdfBase64) setPdfData(pdfRes.pdfBase64);
    } catch (err: any) {
      setError(err.message || 'Failed to load return invoice.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && returnInvoiceNo) {
      setSaveState('idle');
      setPdfData('');
      setReturnDetails(null);
      loadData();
    }
  }, [isOpen, returnInvoiceNo]);

  if (!isOpen) return null;

  const handlePrint = async () => {
    if (!pdfData || !window.api?.print) return;
    setPrinting(true);
    try {
      await window.api.print.pdf({ pdfBase64: pdfData, fileName: `return-invoice-${returnInvoiceNo}` });
    } catch (err: any) {
      setError(err?.message || 'Could not send to printer.');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (!pdfData || !window.api?.print?.savePdf) return;
    setSaveState('saving');
    try {
      const res = await window.api.print.savePdf({
        pdfBase64: pdfData,
        fileName: `Return-Invoice-${returnInvoiceNo}`,
      });
      setSaveState(res.success ? 'saved' : 'idle');
    } catch (err: any) {
      setSaveState('idle');
      setError(err?.message || 'Could not save PDF.');
    }
  };

  const originalInvoiceNo = returnDetails?.original_invoice_no;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200 shadow-2xs">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-ui-md font-bold text-jungle-teal-900">Return / Credit Note</h3>
              <p className="text-ui-2xs text-jungle-teal-600 font-mono">{returnInvoiceNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-jungle-teal-600 hover:text-jungle-teal-800 hover:bg-jungle-teal-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Original Invoice Link */}
        {originalInvoiceNo && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs">
            <span className="text-blue-700 font-semibold">Return for original invoice:</span>
            <button
              onClick={() => onOpenOriginalInvoice?.(originalInvoiceNo)}
              className="font-mono font-bold text-azure-mist-700 hover:underline flex items-center gap-1"
            >
              {originalInvoiceNo}
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-ui-xs">
            {error}
          </div>
        )}

        {/* PDF Preview */}
        <div className="bg-jungle-teal-100/50 p-4 rounded-2xl border border-jungle-teal-200 flex justify-center max-h-[500px] overflow-y-auto shadow-inner">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-2 text-jungle-teal-500 text-ui-sm">
              <RefreshCw className="w-7 h-7 animate-spin text-rose-500" />
              <span className="font-semibold">Loading return invoice...</span>
            </div>
          ) : pdfUrl ? (
            <iframe
              title={`Return Invoice ${returnInvoiceNo}`}
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="w-full bg-white rounded-xl border border-slate-200 shadow-md"
              style={{ height: 520 }}
            />
          ) : (
            <div className="p-12 text-center text-jungle-teal-500 font-sans text-ui-sm">
              This return invoice could not be prepared. Close and try again.
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-jungle-teal-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-ui-xs font-semibold transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2.5">
            {pdfData && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={saveState === 'saving'}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 rounded-xl text-ui-xs font-semibold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors disabled:opacity-60"
              >
                {saveState === 'saved' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Download className="w-4 h-4 text-azure-mist-700" />
                )}
                <span>{saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save PDF'}</span>
              </button>
            )}

            {pdfData && (
              <button
                type="button"
                onClick={handlePrint}
                disabled={!pdfData || printing}
                className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white rounded-xl text-ui-xs font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>{printing ? 'Sending...' : 'Print Return Invoice'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
