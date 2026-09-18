import React, { useState, useEffect, useRef } from 'react';
import { Product, Category } from '../../types/ipc';
import { CategoryPicker } from './CategoryPicker';
import { Package, X, Plus, AlertCircle, Save, Barcode, Sparkles, CheckCircle2, ArrowRight, Layers, Clock, Tag, CircleDollarSign } from 'lucide-react';
import { playScanSuccess, playScanError } from '../../utils/audio';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  initialBarcode?: string;
  categories: Category[];
  onSuccess: () => void;
  onAddCategory: (name: string) => Promise<Category | null>;
  onSelectExistingProduct?: (prod: Product) => void;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  product,
  initialBarcode = '',
  categories,
  onSuccess,
  onAddCategory,
  onSelectExistingProduct,
}) => {
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [costPriceTaka, setCostPriceTaka] = useState('');
  const [sellPriceTaka, setSellPriceTaka] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [addStockQty, setAddStockQty] = useState('');
  const [stockAdjustmentNote, setStockAdjustmentNote] = useState('Manual Stock Adjustment');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [isSerialTracked, setIsSerialTracked] = useState(false);


  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingProductWarning, setExistingProductWarning] = useState<Product | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (product) {
        setBarcode(product.barcode || '');
        setName(product.name || '');
        setCategoryId(product.category_id || '');
        setBrand(product.brand || '');
        setUnit(product.unit || 'pcs');
        setCostPriceTaka((product.cost_price_paisa / 100).toString());
        setSellPriceTaka((product.sell_price_paisa / 100).toString());
        setStockQty((product.stock_qty || 0).toString());
        setAddStockQty('');
        setLowStockThreshold((product.low_stock_threshold || 5).toString());
        setIsSerialTracked(Boolean(product.is_serial_tracked));
  
        setTimeout(() => nameInputRef.current?.focus(), 120);
      } else {
        setBarcode(initialBarcode || '');
        setName('');
        setCategoryId('');
        setBrand('');
        setUnit('pcs');
        setCostPriceTaka('');
        setSellPriceTaka('');
        setStockQty('0');
        setAddStockQty('');
        setLowStockThreshold('5');
        setIsSerialTracked(false);
  
        if (initialBarcode) {
          setTimeout(() => nameInputRef.current?.focus(), 120);
        } else {
          setTimeout(() => barcodeInputRef.current?.focus(), 120);
        }
      }
      setExistingProductWarning(null);
      setError(null);
    }
  }, [isOpen, product]);

  // If the user scans a barcode while the modal is already open and they are creating a new product
  useEffect(() => {
    if (isOpen && !product && initialBarcode) {
      setBarcode(initialBarcode);
    }
  }, [initialBarcode, isOpen, product]);

  // Live duplicate barcode checker on typing debounce
  useEffect(() => {
    if (!barcode.trim() || (product && product.barcode === barcode.trim())) {
      setExistingProductWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (!window.api) return;
      try {
        const found = await window.api.products.getByBarcode(barcode.trim());
        if (found && (!product || found.id !== product.id)) {
          setExistingProductWarning(found);
        } else {
          setExistingProductWarning(null);
        }
      } catch (err) {
        setExistingProductWarning(null);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [barcode, product]);

  const handleBarcodeKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Stop premature form submission by hardware scanner
      const code = barcode.trim();
      if (!code) return;

      if (!window.api) {
        nameInputRef.current?.focus();
        return;
      }

      try {
        const found = await window.api.products.getByBarcode(code);
        if (found && (!product || found.id !== product.id)) {
          playScanError();
          setExistingProductWarning(found);
        } else {
          playScanSuccess();
          setExistingProductWarning(null);
          nameInputRef.current?.focus();
        }
      } catch (err) {
        nameInputRef.current?.focus();
      }
    }
  };

  const handleGenerateBarcode = () => {
    const randomCode = 'MSP' + Math.floor(10000000 + Math.random() * 90000000);
    setBarcode(randomCode);
    playScanSuccess();
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api) return;

    const costPaisa = Math.round((parseFloat(costPriceTaka) || 0) * 100);
    const sellPaisa = Math.round((parseFloat(sellPriceTaka) || 0) * 100);
    const stock = parseInt(stockQty, 10) || 0;
    const threshold = parseInt(lowStockThreshold, 10) || 5;

    if (sellPaisa < 0 || costPaisa < 0) {
      setError('Prices cannot be negative.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (product) {
        await window.api.products.update({
          id: product.id,
          barcode: barcode.trim() || null,
          name: name.trim(),
          category_id: categoryId || null,
          brand: brand.trim() || null,
          unit,
          cost_price_paisa: costPaisa,
          sell_price_paisa: sellPaisa,
          low_stock_threshold: threshold,
          is_serial_tracked: isSerialTracked,
        });

        // Handle Stock-in or Direct Stock Adjustment
        const added = parseInt(addStockQty, 10);
        if (!isNaN(added) && added > 0) {
          await window.api.products.stockIn({
            product_id: product.id,
            qty: added,
            reason: stockAdjustmentNote || 'Restock via Edit Product',
          });
        } else {
          const newTotal = parseInt(stockQty, 10);
          const originalStock = product.stock_qty || 0;
          if (!isNaN(newTotal) && newTotal !== originalStock) {
            const delta = newTotal - originalStock;
            if (delta > 0) {
              await window.api.products.stockIn({
                product_id: product.id,
                qty: delta,
                reason: 'Direct Stock Adjustment',
              });
            } else if (delta < 0) {
              await window.api.products.stockAdjustment({
                product_id: product.id,
                qty_delta: delta,
                reason: 'Direct Stock Adjustment',
              });
            }
          }
        }
      } else {
        await window.api.products.create({
          barcode: barcode.trim() || null,
          name: name.trim(),
          category_id: categoryId || null,
          brand: brand.trim() || null,
          unit,
          cost_price_paisa: costPaisa,
          sell_price_paisa: sellPaisa,
          stock_qty: stock,
          low_stock_threshold: threshold,
          is_serial_tracked: isSerialTracked,
        });
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/60 backdrop-blur-sm p-4 overflow-y-auto font-sans">
      <div className="bg-white border border-jungle-teal-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-jungle-teal-50 text-jungle-teal-700 rounded-xl border border-jungle-teal-100 shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-jungle-teal-950">
                {product ? 'Edit Product' : 'Add New Product'}
              </h3>
              <p className="text-xs text-jungle-teal-500 font-mono tracking-tight mt-0.5">
                {product ? `ID: ${product.id.slice(0, 8)}` : 'Create inventory record without barcode if needed'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-jungle-teal-400 hover:text-jungle-teal-700 hover:bg-jungle-teal-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {existingProductWarning && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-sm flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">This barcode is already in use:</span> {existingProductWarning.name} (stock {existingProductWarning.stock_qty} {existingProductWarning.unit})
              </div>
            </div>
            {onSelectExistingProduct && (
              <button
                type="button"
                onClick={() => onSelectExistingProduct(existingProductWarning)}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shrink-0 transition-colors"
              >
                <span>Edit</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 text-sm font-medium">
          {/* Basic Details */}
          <div className="bg-jungle-teal-50/40 p-4 rounded-xl border border-jungle-teal-100/50 space-y-4">
            <h4 className="text-xs font-bold text-jungle-teal-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Barcode className="w-4 h-4 text-azure-mist-600" /> Basic Details
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-jungle-teal-800">
                    Barcode <span className="text-jungle-teal-500 font-normal text-xs">(Optional)</span>
                  </label>
                  {!product && (
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="text-azure-mist-700 hover:text-azure-mist-800 text-[11px] font-bold flex items-center gap-1 hover:underline"
                      title="Generate unique internal barcode"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto Generate</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={handleBarcodeKeyDown}
                    placeholder="Leave blank for auto-barcode"
                    className="w-full bg-white border border-jungle-teal-200 rounded-xl pl-9 pr-3 py-2.5 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 placeholder:text-jungle-teal-400 shadow-2xs transition-all"
                  />
                  <Barcode className="w-4 h-4 text-jungle-teal-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-jungle-teal-800 mb-1.5">Brand / Manufacturer</label>
                <div className="relative">
                  <input
                    type="text"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="e.g. Bosch, NGK, Denso"
                    className="w-full bg-white border border-jungle-teal-200 rounded-xl pl-9 pr-3 py-2.5 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 placeholder:text-jungle-teal-400 shadow-2xs transition-all"
                  />
                  <Tag className="w-4 h-4 text-jungle-teal-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-jungle-teal-800 mb-1.5">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spark Plug Iridium"
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 placeholder:text-jungle-teal-400 shadow-2xs transition-all"
              />
            </div>
          </div>

          {/* Categorization */}
          <div className="bg-jungle-teal-50/40 p-4 rounded-xl border border-jungle-teal-100/50 space-y-4">
            <h4 className="text-xs font-bold text-jungle-teal-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-azure-mist-600" /> Categorization
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <CategoryPicker
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                  onAddCategory={onAddCategory}
                />
              </div>

              <div>
                <label className="block text-jungle-teal-800 mb-1.5">Unit of Measure</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 shadow-2xs transition-all cursor-pointer"
                >
                  <option value="pcs">Pieces (Pcs)</option>
                  <option value="set">Set</option>
                  <option value="box">Box</option>
                  <option value="kg">Kilogram (Kg)</option>
                  <option value="ltr">Liter (Ltr)</option>
                  <option value="pair">Pair</option>
                </select>
              </div>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="bg-jungle-teal-50/40 p-4 rounded-xl border border-jungle-teal-100/50 space-y-4">
            <h4 className="text-xs font-bold text-jungle-teal-800 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <CircleDollarSign className="w-4 h-4 text-azure-mist-600" /> Pricing & Inventory
            </h4>
            <div className="grid gap-5 font-mono grid-cols-2 sm:grid-cols-4">
              <div>
                <label className="block text-jungle-teal-800 font-sans mb-1.5">
                  Cost (৳) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={costPriceTaka}
                  onChange={(e) => setCostPriceTaka(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 placeholder:text-jungle-teal-400 shadow-2xs transition-all font-bold"
                />
              </div>

              <div>
                <label className="block text-jungle-teal-800 font-sans mb-1.5">
                  Sell Price (৳) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={sellPriceTaka}
                  onChange={(e) => setSellPriceTaka(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 placeholder:text-jungle-teal-400 shadow-2xs transition-all font-bold"
                />
              </div>

              {!product ? (
                <div>
                  <label className="block text-jungle-teal-800 font-sans mb-1.5">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 shadow-2xs transition-all font-mono font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="flex items-center justify-between mb-1.5">
                    <span className="block text-jungle-teal-800 font-sans">Total Stock</span>
                    <span className="text-[10px] text-azure-mist-800 font-bold bg-azure-mist-50 border border-azure-mist-200 px-1.5 py-0.5 rounded-md leading-none">Cur: {product.stock_qty || 0}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 shadow-2xs transition-all font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-jungle-teal-800 font-sans mb-1.5">Low Stock Alert</label>
                <input
                  type="number"
                  min="0"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-amber-700 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 shadow-2xs transition-all font-mono font-bold"
                />
              </div>
            </div>

            {/* Inventory Batches Details (if multiple batches exist) */}
            {product?.batches && product.batches.length > 0 && (
              <div className="bg-white border border-jungle-teal-100 rounded-xl p-3 shadow-xs mt-3">
                <h4 className="text-[11px] font-bold text-jungle-teal-800 mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-azure-mist-500" />
                  Inventory Cost Breakdown (FIFO Batches)
                </h4>
                <div className="space-y-1.5">
                  {product.batches.map((b, i) => (
                    <div key={i} className="flex justify-between items-center text-[11px] font-mono bg-jungle-teal-50/50 border border-jungle-teal-100 rounded-lg px-2.5 py-1.5 shadow-2xs">
                      <div>
                        <span className="font-semibold text-jungle-teal-800">{b.remaining_qty} {product.unit}</span>
                        {b.received_at && (
                          <span className="text-[9px] text-jungle-teal-500 ml-2 font-sans" title={new Date(b.received_at).toLocaleString()}>
                            {new Date(b.received_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="text-jungle-teal-700 font-bold">@ ৳ {(b.cost_price_paisa / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Advanced Options */}
          <div className="bg-jungle-teal-50/40 p-4 rounded-xl border border-jungle-teal-100/50">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="isSerial"
                checked={isSerialTracked}
                onChange={(e) => setIsSerialTracked(e.target.checked)}
                className="rounded bg-white border-jungle-teal-300 text-azure-mist-700 focus:ring-azure-mist-600 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="isSerial" className="text-jungle-teal-800 font-bold select-none cursor-pointer">
                Serial Number Tracking (For warranty / high-value components)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-jungle-teal-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-jungle-teal-50 hover:bg-jungle-teal-100 text-jungle-teal-800 font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!existingProductWarning}
              className="px-6 py-2.5 rounded-xl bg-[#2e5952] hover:bg-[#234540] text-white font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#2e5952]/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{product ? 'Update Product' : 'Create Product'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
