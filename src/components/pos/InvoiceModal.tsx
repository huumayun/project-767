import React, { useState, useEffect } from 'react';
import { Printer, Download, X, FileText, CheckCircle2, RefreshCw } from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPdf = async (targetLayout: '80mm' | 'a5') => {
    if (!window.api || !invoiceNo) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.api.sales.generatePdf({
        invoice_no: invoiceNo,
        layout: targetLayout,
      });
      if (res.success && res.pdfBase64) {
        setPdfData(res.pdfBase64);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate invoice PDF.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && invoiceNo) {
      if (!initialPdf) {
        fetchPdf(currentLayout);
      } else {
        setPdfData(initialPdf);
      }
    }
  }, [isOpen, invoiceNo]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-preview-frame') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  const handleDownload = () => {
    if (!pdfData) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${pdfData}`;
    link.download = `Invoice-${invoiceNo}-${currentLayout}.pdf`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted-teal-50 text-muted-teal-700 rounded-xl border border-muted-teal-200 shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Sale Receipt & Invoice</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">Invoice No: {invoiceNo}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-jungle-teal-100 p-1 rounded-xl border border-jungle-teal-200 text-xs">
              <button
                onClick={() => {
                  setCurrentLayout('80mm');
                  fetchPdf('80mm');
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
                  fetchPdf('a5');
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
              className="p-1.5 text-jungle-teal-400 hover:text-jungle-teal-700 font-bold"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            {error}
          </div>
        )}

        {/* PDF Preview Frame */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl overflow-hidden h-[450px] relative flex items-center justify-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-jungle-teal-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-azure-mist-700" />
              <span>Generating printable invoice PDF with Bangla support...</span>
            </div>
          ) : pdfData ? (
            <iframe
              id="pdf-preview-frame"
              src={`data:application/pdf;base64,${pdfData}#toolbar=0&navpanes=0`}
              className="w-full h-full border-none"
              title="Invoice PDF"
            />
          ) : (
            <div className="text-jungle-teal-400 text-xs">No PDF preview available.</div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-jungle-teal-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold"
          >
            Close Window
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!pdfData}
              className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-azure-mist-700" />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!pdfData}
              className="px-6 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-colors disabled:opacity-50"
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
