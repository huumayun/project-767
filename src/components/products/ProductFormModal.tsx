import React, { useState, useEffect, useRef } from 'react';
import { Product, Category } from '../../types/ipc';
import { CategoryPicker } from './CategoryPicker';
import { Package, X, Plus, AlertCircle, Save, Barcode, Sparkles, CheckCircle2, ArrowRight, Layers } from 'lucide-react';
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
  const [nameBn, setNameBn] = useState('');
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
    if (product) {
      setBarcode(product.barcode || '');
      setName(product.name || '');
      setNameBn(product.name_bn || '');
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
      setNameBn('');
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
  }, [product, initialBarcode, isOpen]);

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
          name_bn: nameBn.trim() || null,
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
          name_bn: nameBn.trim() || null,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">
                {product ? 'Edit Mechanical Part' : 'Add New Product'}
              </h3>
              <p className="text-xs text-jungle-teal-500 font-mono">
                {product ? `ID: ${product.id.slice(0, 8)}` : 'Create inventory record'}
              </p>
            </div>
          </div>

          <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {existingProductWarning && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">This barcode is already in use:</span> {existingProductWarning.name} (stock {existingProductWarning.stock_qty} {existingProductWarning.unit})
              </div>
            </div>
            {onSelectExistingProduct && (
              <button
                type="button"
                onClick={() => onSelectExistingProduct(existingProductWarning)}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0"
              >
                <span>Edit</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Barcode & Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-jungle-teal-700 font-semibold">
                  Barcode
                </label>
                {!product && (
                  <button
                    type="button"
                    onClick={handleGenerateBarcode}
                    className="text-azure-mist-700 hover:text-azure-mist-900 text-[11px] font-semibold flex items-center gap-1 hover:underline"
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
                  placeholder="Scan, or type a barcode"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl pl-9 pr-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-bold"
                />
                <Barcode className="w-4 h-4 text-jungle-teal-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Brand / Manufacturer</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Bosch, NGK, Denso"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
              />
            </div>
          </div>

          {/* Name & Bangla Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Product Name (English) *</label>
              <input
                ref={nameInputRef}
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spark Plug Iridium"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-semibold"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Product Name (Bangla)</label>
              <input
                type="text"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                placeholder="e.g. স্পার্ক প্লাগ"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
              />
            </div>
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
            <CategoryPicker
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              onAddCategory={onAddCategory}
            />
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Unit of Measure</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
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

          {/* Pricing & Stock */}
          <div className={`grid gap-3 font-mono ${product ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
            <div>
              <label className="block text-jungle-teal-700 font-sans font-semibold mb-1">Cost Price (৳) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={costPriceTaka}
                onChange={(e) => setCostPriceTaka(e.target.value)}
                placeholder="0.00"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-bold"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-sans font-semibold mb-1">Sell Price (৳) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={sellPriceTaka}
                onChange={(e) => setSellPriceTaka(e.target.value)}
                placeholder="0.00"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-bold"
              />
            </div>

            {!product && (
              <div>
                <label className="block text-jungle-teal-700 font-sans font-semibold mb-1">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-jungle-teal-700 font-sans font-semibold mb-1">Low Stock Alert</label>
              <input
                type="number"
                min="1"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-bold"
              />
            </div>
          </div>

          {/* Dedicated Stock Management & Restock Box (When Editing) */}
          {product && (
            <div className="bg-azure-mist-50/70 border border-azure-mist-200 p-3.5 rounded-2xl space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-azure-mist-100 text-azure-mist-800 rounded-lg">
                    <Layers className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-jungle-teal-900 text-xs">Stock management</span>
                </div>
                <div className="text-xs font-mono">
                  <span className="text-jungle-teal-500">Current stock: </span>
                  <span className="font-extrabold text-azure-mist-900 bg-jungle-teal-50 px-2 py-0.5 rounded-lg border border-azure-mist-300">
                    {product.stock_qty || 0} {unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">
                    Add new stock (+Qty)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={addStockQty}
                      onChange={(e) => setAddStockQty(e.target.value)}
                      placeholder="e.g. enter 10 if 10 units arrived"
                      className="w-full bg-jungle-teal-50 border border-azure-mist-300 rounded-xl pl-8 pr-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600"
                    />
                    <Plus className="w-4 h-4 text-azure-mist-700 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  {parseInt(addStockQty, 10) > 0 && (
                    <span className="text-[11px] text-muted-teal-800 font-semibold mt-1 block">
                      On save, the new total stock will be {(product.stock_qty || 0) + parseInt(addStockQty, 10)} {unit}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">
                    Or set the total stock directly
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    placeholder="Total quantity…"
                    className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600"
                  />
                  <span className="text-[10px] text-jungle-teal-500 mt-1 block">
                    For stock audits or direct corrections
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isSerial"
              checked={isSerialTracked}
              onChange={(e) => setIsSerialTracked(e.target.checked)}
              className="rounded-sm bg-jungle-teal-100 border-jungle-teal-300 text-azure-mist-700 focus:ring-0"
            />
            <label htmlFor="isSerial" className="text-jungle-teal-700 font-semibold cursor-pointer">
              Serial Number Tracking (For batteries, high-value components)
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              {loading ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
