import React, { useState, useEffect } from 'react';
import { Product, Category } from '../../types/ipc';
import { X, Plus, Package, Save, AlertCircle, Wand2 } from 'lucide-react';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: Product | null;
  categories: Category[];
  onAddCategory: (name: string) => Promise<Category | null>;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
  categories,
  onAddCategory,
}) => {
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [costPriceTaka, setCostPriceTaka] = useState<string>('');
  const [sellPriceTaka, setSellPriceTaka] = useState<string>('');
  const [stockQty, setStockQty] = useState<string>('0');
  const [lowStockThreshold, setLowStockThreshold] = useState<string>('5');
  const [isSerialTracked, setIsSerialTracked] = useState(false);

  const [newCatName, setNewCatName] = useState('');
  const [showNewCatInput, setShowNewCatInput] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setBarcode(productToEdit.barcode || '');
      setName(productToEdit.name || '');
      setNameBn(productToEdit.name_bn || '');
      setCategoryId(productToEdit.category_id || '');
      setBrand(productToEdit.brand || '');
      setUnit(productToEdit.unit || 'pcs');
      setCostPriceTaka(productToEdit.cost_price_paisa ? (productToEdit.cost_price_paisa / 100).toString() : '0');
      setSellPriceTaka(productToEdit.sell_price_paisa ? (productToEdit.sell_price_paisa / 100).toString() : '0');
      setStockQty(productToEdit.stock_qty ? productToEdit.stock_qty.toString() : '0');
      setLowStockThreshold(productToEdit.low_stock_threshold ? productToEdit.low_stock_threshold.toString() : '5');
      setIsSerialTracked(Boolean(productToEdit.is_serial_tracked));
    } else {
      setBarcode('');
      setName('');
      setNameBn('');
      setCategoryId('');
      setBrand('');
      setUnit('pcs');
      setCostPriceTaka('');
      setSellPriceTaka('');
      setStockQty('0');
      setLowStockThreshold('5');
      setIsSerialTracked(false);
    }
    setError(null);
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await onAddCategory(newCatName.trim());
      if (created) {
        setCategoryId(created.id);
        setNewCatName('');
        setShowNewCatInput(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create category');
    }
  };

  const handleAutoGenerateBarcode = () => {
    const generated = `INT-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    setBarcode(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    const costNum = parseFloat(costPriceTaka || '0');
    const sellNum = parseFloat(sellPriceTaka || '0');
    if (isNaN(costNum) || costNum < 0 || isNaN(sellNum) || sellNum < 0) {
      setError('Prices must be valid positive numbers.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        id: productToEdit?.id,
        barcode: barcode.trim() || null,
        name: name.trim(),
        name_bn: nameBn.trim() || null,
        category_id: categoryId || null,
        brand: brand.trim() || null,
        unit,
        cost_price_paisa: Math.round(costNum * 100),
        sell_price_paisa: Math.round(sellNum * 100),
        stock_qty: parseInt(stockQty, 10) || 0,
        low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
        is_serial_tracked: isSerialTracked,
      };

      if (productToEdit) {
        await window.api.products.update(payload);
      } else {
        await window.api.products.create(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/60 backdrop-blur-sm p-4 overflow-y-auto font-sans">
      <div className="bg-white border border-jungle-teal-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-jungle-teal-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-jungle-teal-50 text-jungle-teal-700 rounded-xl border border-jungle-teal-100">
              <Package className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-jungle-teal-950">
                {productToEdit ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-xs text-jungle-teal-600 font-mono mt-0.5 tracking-tight">
                {productToEdit ? `Updating #${productToEdit.barcode}` : 'Create inventory record'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-jungle-teal-400 hover:text-jungle-teal-700 hover:bg-jungle-teal-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm font-medium">
          {/* Row 1: Barcode & Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-jungle-teal-800">Barcode</label>
                <button
                  type="button"
                  onClick={handleAutoGenerateBarcode}
                  className="text-azure-mist-700 hover:text-azure-mist-800 flex items-center gap-1 text-[11px] font-bold"
                >
                  <Wand2 className="w-3 h-3" /> Auto Generate
                </button>
              </div>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan, or type a barcode"
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 placeholder:text-jungle-teal-400 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all font-mono text-sm shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-800 mb-1.5">Brand / Manufacturer</label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Bosch, NGK, Denso"
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 placeholder:text-jungle-teal-400 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all text-sm shadow-2xs"
              />
            </div>
          </div>

          {/* Row 2: Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-jungle-teal-800 mb-1.5">
                Product Name (English) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Spark Plug Iridium"
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 placeholder:text-jungle-teal-400 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all text-sm shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-800 mb-1.5">
                Product Name (Bangla)
              </label>
              <input
                type="text"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                placeholder="e.g. স্পার্ক প্লাগ"
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 placeholder:text-jungle-teal-400 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all text-sm shadow-2xs"
              />
            </div>
          </div>

          {/* Row 3: Category & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-jungle-teal-800">Category</label>
                <button
                  type="button"
                  onClick={() => setShowNewCatInput(!showNewCatInput)}
                  className="text-azure-mist-700 hover:text-azure-mist-800 flex items-center gap-1 text-[11px] font-bold"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" /> New group
                </button>
              </div>

              {showNewCatInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category..."
                    className="flex-1 bg-white border border-jungle-teal-200 rounded-xl px-3 py-2.5 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 text-sm shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    className="bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-800 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all text-sm shadow-2xs cursor-pointer"
                >
                  <option value="">— No category —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-jungle-teal-800 mb-1.5">Unit of Measure</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3.5 py-2.5 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all text-sm shadow-2xs cursor-pointer"
              >
                <option value="pcs">Pieces (Pcs)</option>
                <option value="box">Box</option>
                <option value="set">Set</option>
                <option value="kg">Kilogram (Kg)</option>
                <option value="liter">Liter</option>
                <option value="meter">Meter</option>
              </select>
            </div>
          </div>

          {/* Row 4: Pricing & Stock */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-jungle-teal-800 mb-1.5">
                Last Purchase Cost (৳) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPriceTaka}
                onChange={(e) => setCostPriceTaka(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 placeholder:text-jungle-teal-300 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all font-mono text-sm shadow-2xs"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-800 mb-1.5">
                Sell Price (৳) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={sellPriceTaka}
                onChange={(e) => setSellPriceTaka(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 placeholder:text-jungle-teal-300 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all font-mono text-sm shadow-2xs"
              />
            </div>

            {!productToEdit && (
              <div>
                <label className="block text-jungle-teal-800 mb-1.5">Initial Stock</label>
                <input
                  type="number"
                  min="0"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all font-mono text-sm shadow-2xs"
                />
              </div>
            )}
            
            <div className={productToEdit ? 'col-span-2' : ''}>
              <label className="block text-jungle-teal-800 mb-1.5">Low Stock Alert</label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full bg-white border border-jungle-teal-200 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 transition-all font-mono text-sm shadow-2xs"
              />
            </div>
          </div>

          {/* Settings */}
          <div className="flex items-center gap-2.5 pt-4 pb-2">
            <input
              type="checkbox"
              id="is_serial"
              checked={isSerialTracked}
              onChange={(e) => setIsSerialTracked(e.target.checked)}
              className="rounded bg-white border-jungle-teal-300 text-azure-mist-700 focus:ring-azure-mist-600 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="is_serial" className="text-jungle-teal-800 font-bold text-xs select-none cursor-pointer">
              Serial Number Tracking (For batteries, high-value components)
            </label>
          </div>

          {/* Footer */}
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
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#2e5952] hover:bg-[#234540] text-white font-bold flex items-center gap-2 transition-colors shadow-lg shadow-[#2e5952]/20"
            >
              {loading ? 'Saving...' : productToEdit ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

