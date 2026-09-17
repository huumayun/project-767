import React, { useEffect, useRef } from 'react';
import { Product } from '../../types/ipc';
import { X, Printer, Barcode as BarcodeIcon } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface BarcodeSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

const BarcodeItem: React.FC<{ product: Product }> = ({ product }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && product.barcode) {
      try {
        JsBarcode(svgRef.current, product.barcode, {
          format: 'CODE128',
          width: 1.5,
          height: 38,
          displayValue: true,
          fontSize: 10,
          margin: 4,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (err) {
        console.error('JsBarcode rendering error:', err);
      }
    }
  }, [product.barcode]);

  const priceTaka = product.sell_price_paisa ? (product.sell_price_paisa / 100).toFixed(2) : '0.00';

  return (
    <div className="border border-jungle-teal-300 bg-jungle-teal-50 text-black p-2 rounded-sm flex flex-col items-center justify-between text-center w-full h-32 select-none shadow-xs page-break-inside-avoid">
      <div className="text-[10px] font-bold tracking-tight uppercase truncate max-w-full text-jungle-teal-800">
        Fatema Electronics POS
      </div>
      <div className="text-[11px] font-semibold text-jungle-teal-900 line-clamp-1 max-w-full">
        {product.name}
      </div>
      <svg ref={svgRef} className="max-w-full h-auto"></svg>
      <div className="text-xs font-bold text-jungle-teal-950 font-mono">
        Price: ৳ {priceTaka}
      </div>
    </div>
  );
};

export const BarcodeSheetModal: React.FC<BarcodeSheetModalProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const printAreaRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-barcode-sheet, #printable-barcode-sheet * {
            visibility: visible;
          }
          #printable-barcode-sheet {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 10mm;
          }
        }
      `}</style>

      <div className="bg-jungle-teal-900 border border-jungle-teal-800 rounded-xl max-w-4xl w-full p-6 shadow-2xl text-jungle-teal-100 my-8">
        <div className="flex items-center justify-between border-b border-jungle-teal-800 pb-4 mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azure-mist-600/10 text-azure-mist-400 rounded-lg border border-azure-mist-600/20">
              <BarcodeIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">A4 Barcode Label Print Sheet</h2>
              <p className="text-xs text-jungle-teal-400">Code128 Barcodes ({products.length} Items Selected)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-semibold rounded-lg flex items-center gap-2 text-xs transition-colors shadow-lg shadow-azure-mist-700/20"
            >
              <Printer className="w-4 h-4" />
              Print A4 Sheet
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-jungle-teal-400 hover:text-white rounded-lg hover:bg-jungle-teal-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Grid Area */}
        <div
          id="printable-barcode-sheet"
          ref={printAreaRef}
          className="bg-jungle-teal-950 p-6 rounded-lg border border-jungle-teal-800 max-h-[60vh] overflow-y-auto"
        >
          {products.length === 0 ? (
            <div className="text-center text-jungle-teal-500 text-xs py-8">
              No products selected for barcode printing.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-jungle-teal-50 p-4 rounded-lg">
              {products.map((prod) => (
                <BarcodeItem key={prod.id} product={prod} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
