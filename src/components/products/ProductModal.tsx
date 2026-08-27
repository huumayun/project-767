import React, { useState, useEffect } from 'react';
import { Product, Category } from '../../types/ipc';
import { X, Plus, Barcode, Save, AlertCircle } from 'lucide-react';

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
  const [costPriceTaka, setCostPriceTaka] = useState<string>('0');
  const [sellPriceTaka, setSellPriceTaka] = useState<string>('0');
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
      setCostPriceTaka('0');
      setSellPriceTaka('0');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }

    const costNum = parseFloat(costPriceTaka);
    const sellNum = parseFloat(sellPriceTaka);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-950/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-900 border border-jungle-teal-800 rounded-xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-100 my-8">
        <div className="flex items-center justify-between border-b border-jungle-teal-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-azure-mist-600/10 text-azure-mist-400 rounded-lg border border-azure-mist-600/20">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {productToEdit ? 'Edit Product' : 'Add New Product'}
              </h2>
              <p className="text-xs text-jungle-teal-400">
                {productToEdit ? `Updating #${productToEdit.barcode}` : 'Create a new inventory item in SQLite'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-jungle-teal-400 hover:text-white rounded-lg hover:bg-jungle-teal-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Barcode <span className="text-jungle-teal-500 font-normal">(Leave blank to auto-generate INT-)</span>
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="e.g. 890123456789 or auto"
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-600 font-mono"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Unit Type
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-600"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="box">Box</option>
                <option value="set">Set</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="liter">Liter</option>
                <option value="meter">Meter</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Product Name (English) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bearing 6204-RS"
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-600"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Product Name (Bangla) <span className="text-jungle-teal-500 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                placeholder="e.g. বিয়ারিং ৬২০৪"
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-600 font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-jungle-teal-400 font-medium">Category</label>
                <button
                  type="button"
                  onClick={() => setShowNewCatInput(!showNewCatInput)}
                  className="text-azure-mist-400 hover:underline text-[11px] flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> New Category
                </button>
              </div>

              {showNewCatInput ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="New category name..."
                    className="flex-1 bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-1.5 text-jungle-teal-200 text-xs focus:outline-hidden focus:border-azure-mist-600"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    className="bg-azure-mist-700 hover:bg-azure-mist-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-600"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. SKF, NSK, Bosch"
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-jungle-teal-950/40 p-3 rounded-lg border border-jungle-teal-800">
            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Cost Price (৳ Taka)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costPriceTaka}
                onChange={(e) => setCostPriceTaka(e.target.value)}
                placeholder="0.00"
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-muted-teal-400 font-mono focus:outline-hidden focus:border-muted-teal-600"
              />
            </div>

            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Sell Price (৳ Taka) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={sellPriceTaka}
                onChange={(e) => setSellPriceTaka(e.target.value)}
                placeholder="0.00"
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-azure-mist-400 font-mono focus:outline-hidden focus:border-azure-mist-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!productToEdit && (
              <div>
                <label className="block text-jungle-teal-400 font-medium mb-1">
                  Initial Stock Quantity
                </label>
                <input
                  type="number"
                  min="0"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-jungle-teal-200 focus:outline-hidden focus:border-azure-mist-600 font-mono"
                />
              </div>
            )}

            <div>
              <label className="block text-jungle-teal-400 font-medium mb-1">
                Low Stock Threshold (Alert level)
              </label>
              <input
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full bg-jungle-teal-950 border border-jungle-teal-800 rounded-lg px-3 py-2 text-amber-400 focus:outline-hidden focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_serial"
              checked={isSerialTracked}
              onChange={(e) => setIsSerialTracked(e.target.checked)}
              className="rounded-sm bg-jungle-teal-950 border-jungle-teal-800 text-azure-mist-700 focus:ring-azure-mist-600 w-4 h-4"
            />
            <label htmlFor="is_serial" className="text-jungle-teal-300 font-medium select-none">
              Track Serial Numbers for Warranty
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-jungle-teal-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-jungle-teal-800 bg-jungle-teal-900 hover:bg-jungle-teal-800 text-jungle-teal-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-semibold flex items-center gap-2 transition-colors shadow-lg shadow-azure-mist-700/20"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : productToEdit ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
