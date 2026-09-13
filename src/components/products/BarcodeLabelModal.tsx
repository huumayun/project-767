import React, { useState, useEffect } from 'react';
import { Product } from '../../types/ipc';
import { Printer, Barcode as BarcodeIcon, X, Sliders, Tag } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { useToast } from '../../context/ToastContext';

interface BarcodeLabelModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const toast = useToast();
  const [labelCount, setLabelCount] = useState<number>(12);
  // Labels default to barcode + name only; price is opt-in.
  const [showPrice, setShowPrice] = useState(false);

  useEffect(() => {
    if (isOpen && product.barcode) {
      setTimeout(() => {
        try {
          JsBarcode('#barcode-preview-canvas', product.barcode!, {
            format: 'CODE128',
            width: 1.5,
            height: 45,
            displayValue: true,
            fontSize: 11,
            margin: 5,
          });
        } catch (err) {
          console.error('Barcode rendering error:', err);
        }
      }, 100);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handlePrintLabels = () => {
    const canvas = document.getElementById('barcode-preview-canvas') as HTMLCanvasElement;
    const barcodeDataUrl = canvas ? canvas.toDataURL('image/png') : '';

    /*
     * The label sheet is built as a string and written into a document, so
     * anything from the product has to be escaped on the way in - a part called
     * `Seal 1/2" <A>` closed the div early and threw the rest of the sheet out
     * of shape. The page CSP stops an injected tag from running anything, but
     * that is the last line of defence and not a reason to hand it markup.
     *
     * The two other places that print built HTML - the customer ledger and the
     * shift Z-report - already do this.
     */
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const labelHtml = `
      <div style="border: 1px dashed #ccc; padding: 6px; text-align: center; font-family: sans-serif; width: 180px; page-break-inside: avoid; display: inline-block; margin: 4px; box-sizing: border-box;">
        <div style="font-size: 10px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(product.name)}</div>
        <img src="${esc(barcodeDataUrl)}" style="max-width: 100%; height: auto;" />
        ${showPrice ? `<div style="font-size: 11px; font-weight: bold; font-family: monospace;">MRP: ৳ ${(product.sell_price_paisa / 100).toFixed(2)}</div>` : ''}
      </div>
    `;
  
    let sheetHtml = '';
    for (let i = 0; i < labelCount; i++) {
      sheetHtml += labelHtml;
    }
  
    // Printed through a hidden iframe rather than window.open: the main
    // process denies every new window (electron/security.ts), so window.open
    // returns null in the packaged app and printing could never run.
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
  
    const doc = frame.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(frame);
      toast.error('Could not prepare the label sheet for printing.');
      return;
    }
  
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Barcode Label Sheet - ${esc(product.barcode)}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { margin: 0; padding: 0; font-family: sans-serif; display: flex; flex-wrap: wrap; justify-content: flex-start; }
          </style>
        </head>
        <body>${sheetHtml}</body>
      </html>
    `);
    doc.close();
  
    // Give the barcode image a chance to decode before the print dialog
    // snapshots the page, otherwise the labels print blank.
    const run = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch (err) {
        console.error('Label print failed:', err);
        toast.error('Could not open the print dialog.');
      } finally {
        // Kept briefly: removing it synchronously can cancel the dialog.
        setTimeout(() => frame.parentNode && document.body.removeChild(frame), 60000);
      }
    };
  
    const img = doc.querySelector('img');
    if (img && !img.complete) {
      img.addEventListener('load', run, { once: true });
      img.addEventListener('error', run, { once: true });
    } else {
      setTimeout(run, 60);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 space-y-4">
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Print Barcode Labels</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">Code128 Format (A4 Sticker Sheet)</p>
            </div>
          </div>

          <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barcode Preview Card */}
        <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-xl flex flex-col items-center justify-center space-y-2">
          <span className="font-bold text-xs text-jungle-teal-900 text-center">{product.name}</span>
          <canvas id="barcode-preview-canvas" className="bg-jungle-teal-50 p-2 rounded-lg border border-jungle-teal-200 shadow-xs" />
          {showPrice && (
            <span className="font-mono font-bold text-xs text-jungle-teal-900">
              MRP: ৳ {(product.sell_price_paisa / 100).toFixed(2)}
            </span>
          )}
        </div>

        {/* Options */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">Number of Labels to Print</label>
            <input
              type="number"
              min="1"
              max="200"
              value={labelCount}
              onChange={(e) => setLabelCount(parseInt(e.target.value, 10) || 1)}
              className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="showPrice"
              checked={showPrice}
              onChange={(e) => setShowPrice(e.target.checked)}
              className="rounded-sm bg-jungle-teal-100 border-jungle-teal-300 text-azure-mist-700 focus:ring-0"
            />
            <label htmlFor="showPrice" className="text-jungle-teal-700 font-semibold cursor-pointer">
              Print Retail Price (৳) on Label
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-jungle-teal-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrintLabels}
            className="px-5 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Label Sheet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
