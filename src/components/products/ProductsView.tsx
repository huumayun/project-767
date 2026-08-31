import React, { useState, useRef } from 'react';
import { Product, Category, UserSession } from '../../types/ipc';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Printer,
  Upload,
  ArrowDownCircle,
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  Barcode,
  Sparkles,
  Clock,
  Layers,
} from 'lucide-react';
import { ProductFormModal } from './ProductFormModal';
import { BarcodeLabelModal } from './BarcodeLabelModal';
import { CsvImportModal } from './CsvImportModal';
import { StockHistoryModal } from './StockHistoryModal';

import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { playScanSuccess } from '../../utils/audio';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

interface ProductsViewProps {
  currentSession: UserSession | null;
  products: Product[];
  categories: Category[];
  loading: boolean;
  onRefresh: () => void;
  onAddCategory: (name: string) => Promise<Category | null>;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  currentSession,
  products,
  categories,
  loading,
  onRefresh,
  onAddCategory,
}) => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  // Quick Barcode Scan State
  const [quickScanInput, setQuickScanInput] = useState('');
  const [initialBarcode, setInitialBarcode] = useState('');
  const quickScanRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeTargetProduct, setBarcodeTargetProduct] = useState<Product | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [historyTargetProduct, setHistoryTargetProduct] = useState<Product | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const [stockInProduct, setStockInProduct] = useState<Product | null>(null);
  const [stockInQty, setStockInQty] = useState<string>('10');
  const [stockInCost, setStockInCost] = useState<string>('');
  const [stockInSellPrice, setStockInSellPrice] = useState<string>('');
  const [stockInReason, setStockInReason] = useState<string>('Quick Stock-in');
  const [stockInLoading, setStockInLoading] = useState(false);

  const openQuickStockIn = (product: Product) => {
    setStockInProduct(product);
    setStockInQty('10');
    setStockInCost((product.cost_price_paisa / 100).toString());
    setStockInSellPrice((product.sell_price_paisa / 100).toString());
    setStockInReason('Quick Stock-in');
  };

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const isOwner = currentSession?.role === 'owner';

  const filteredProducts = products.filter((p) => {
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    if (showLowStockOnly && p.stock_qty > (p.low_stock_threshold ?? 5)) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.name_bn && p.name_bn.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.brand && p.brand.toLowerCase().includes(q))
    );
  });

  const confirmDelete = async () => {
    if (!deleteTarget || !window.api || !isOwner) return;
    try {
      await window.api.products.delete(deleteTarget.id);
      toast.success(`Product "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      toast.error(`Failed to delete product: ${err.message}`);
    }
  };

  const handleQuickScanSubmit = async (e?: React.FormEvent, codeOverride?: string) => {
    if (e) e.preventDefault();
    const code = (codeOverride || quickScanInput).trim();
    if (!code) return;

    if (!window.api) return;

    try {
      const match = products.find((p) => p.barcode === code);
      if (match) {
        playScanSuccess();
        // User requested: if found, auto open Quick Stock Update
        openQuickStockIn(match);
      } else {
        playScanSuccess();
        toast.success(`New barcode scanned: ${code}`);
        setEditingProduct(null);
        setInitialBarcode(code);
        setShowFormModal(true);
      }
      setQuickScanInput('');
    } catch (err: any) {
      toast.error(`Scan error: ${err.message}`);
    }
  };

  useBarcodeScanner((code) => {
    handleQuickScanSubmit(undefined, code);
  });

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api || !stockInProduct || !isOwner) return;

    const parsedQty = parseInt(stockInQty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toast.error('Please enter a positive quantity to add.');
      return;
    }

    const parsedCost = parseFloat(stockInCost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      toast.error('Please enter a valid cost price.');
      return;
    }

    const parsedSellPrice = parseFloat(stockInSellPrice);
    if (isNaN(parsedSellPrice) || parsedSellPrice < 0) {
      toast.error('Please enter a valid sell price.');
      return;
    }

    setStockInLoading(true);

    try {
      await window.api.products.stockIn({
        product_id: stockInProduct.id,
        qty: parsedQty,
        cost_price_paisa: Math.round(parsedCost * 100),
        sell_price_paisa: Math.round(parsedSellPrice * 100),
        reason: stockInReason,
      });
      toast.success(`Added ${parsedQty} units to "${stockInProduct.name}".`);
      setStockInProduct(null);
      onRefresh();
    } catch (err: any) {
      toast.error(`Stock in failed: ${err.message}`);
    } finally {
      setStockInLoading(false);
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col overflow-hidden min-h-0 space-y-2.5 text-jungle-teal-900">
      {/* Top Header - Fixed */}
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-3 bg-jungle-teal-50 border border-jungle-teal-200 p-3 sm:p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-jungle-teal-900">Product & Inventory Catalog</h2>
            <p className="text-xs text-jungle-teal-500">Track stock levels, barcode scanning, labels, and mechanical parts</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Barcode Scanner Bar */}
          {isOwner && (
            <form onSubmit={handleQuickScanSubmit} className="relative flex items-center">
              <input
                ref={quickScanRef}
                type="text"
                value={quickScanInput}
                onChange={(e) => setQuickScanInput(e.target.value)}
                placeholder="Scan, or add by barcode…"
                className="bg-azure-mist-50/70 border border-azure-mist-300 rounded-xl pl-8 pr-20 py-1.5 text-xs text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 w-52 sm:w-64 placeholder:text-jungle-teal-400 placeholder:font-sans"
              />
              <Barcode className="w-4 h-4 text-azure-mist-700 absolute left-2.5 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-1 px-2 py-0.5 bg-azure-mist-700 hover:bg-azure-mist-600 text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors"
              >
                Scan/Add
              </button>
            </form>
          )}

          {isOwner && (
            <>
              <button
                onClick={() => setShowCsvModal(true)}
                className="px-3 py-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors"
              >
                <Upload className="w-4 h-4 text-muted-teal-700" />
                <span>Bulk CSV</span>
              </button>

              <button
                onClick={() => {
                  setEditingProduct(null);
                  setInitialBarcode('');
                  setShowFormModal(true);
                }}
                className="px-3.5 py-1.5 bg-azure-mist-700 hover:bg-azure-mist-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            </>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl border border-jungle-teal-300 transition-colors"
            title="Reload Products"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter / Search Bar - Fixed */}
      <div className="shrink-0 flex items-center gap-3 flex-wrap bg-jungle-teal-50 border border-jungle-teal-200 p-3 rounded-2xl shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-jungle-teal-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by part name, Bengali name, barcode, brand..."
            className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl pl-10 pr-4 py-1.5 text-xs text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-1.5 text-xs text-jungle-teal-700 focus:outline-hidden focus:border-azure-mist-600"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowLowStockOnly(!showLowStockOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${showLowStockOnly
                ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold'
                : 'bg-jungle-teal-50 text-jungle-teal-600 border-jungle-teal-300 hover:bg-jungle-teal-100'
              }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Low Stock Alerts</span>
          </button>
        </div>
      </div>

      {/* Products Table - Scrollable Zone */}
      <div className="flex-1 overflow-y-auto min-h-0 bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-ui-sm border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-sans text-ui-2xs font-semibold tracking-wider border-b border-jungle-teal-200 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2">Barcode</th>
                <th className="px-3 py-2">Product Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-center">Stock</th>
                {isOwner && <th className="px-3 py-2 text-right">Cost (৳)</th>}
                <th className="px-3 py-2 text-right">Sell Price (৳)</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-jungle-teal-500 font-sans">
                    {loading ? 'Loading catalog...' : 'No products found matching filters.'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                    const outOfStock = product.stock_qty <= 0;
                    const isLow = !outOfStock && product.stock_qty <= product.low_stock_threshold;
                    const stockClass = outOfStock
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : isLow
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-muted-teal-50 text-muted-teal-800 border-muted-teal-200';
                    
                    const isExpanded = expandedProductId === product.id;

                    return (
                      <React.Fragment key={product.id}>
                        <tr 
                          onClick={() => setExpandedProductId(isExpanded ? null : product.id)}
                          className={`h-[52px] hover:bg-azure-mist-50/40 transition-colors cursor-pointer ${isExpanded ? 'bg-azure-mist-50/50' : ''}`}
                        >
                          <td className="px-3 font-mono text-ui-2xs text-jungle-teal-500 whitespace-nowrap">
                            {product.barcode || '—'}
                          </td>
                          <td className="px-3 font-sans">
                            <div className="text-ui-sm font-semibold text-jungle-teal-900 leading-tight">
                              {product.name}
                            </div>
                            {product.brand && (
                              <span className="inline-block mt-1 text-ui-2xs font-medium text-jungle-teal-700 bg-jungle-teal-100 border border-jungle-teal-200 rounded px-1.5 py-px">
                                {product.brand}
                              </span>
                            )}
                          </td>
                          <td className="px-3 font-sans text-ui-sm text-jungle-teal-600">
                            {product.category_name || '—'}
                          </td>
                          <td className="px-3 text-center">
                            <span
                              className={`inline-flex items-center font-mono text-ui-2xs font-semibold border rounded px-1.5 py-px whitespace-nowrap ${stockClass}`}
                            >
                              {outOfStock ? 'Out of stock' : `${product.stock_qty} ${product.unit}${isLow ? ' · low' : ''}`}
                            </span>
                          </td>
                          {isOwner && (
                            <td className="px-3 text-right font-mono text-ui-sm text-jungle-teal-600 whitespace-nowrap">
                              ৳ {(product.cost_price_paisa / 100).toFixed(2)}
                            </td>
                          )}
                          <td className="px-3 text-right font-mono text-ui-sm font-semibold text-jungle-teal-900 whitespace-nowrap">
                            ৳ {(product.sell_price_paisa / 100).toFixed(2)}
                          </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {isOwner && (
                              <button
                                onClick={() => openQuickStockIn(product)}
                                className="w-8 h-8 flex items-center justify-center bg-muted-teal-50 hover:bg-muted-teal-100 text-muted-teal-800 rounded-lg border border-muted-teal-200 transition-colors"
                                title="Quick Stock-In"
                              >
                                <ArrowDownCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
  
                            <button
  
                              onClick={() => {
                                setBarcodeTargetProduct(product);
                                setShowBarcodeModal(true);
                              }}
                              className="w-8 h-8 flex items-center justify-center bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors"
                              title="Print Barcode Labels"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
  
                            {isOwner && (
                              <>
                                <button
                                  onClick={() => setHistoryTargetProduct(product)}
                                  className="w-8 h-8 flex items-center justify-center bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors"
                                  title="Stock Details"
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setShowFormModal(true);
                                  }}
                                  className="w-8 h-8 flex items-center justify-center bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors"
                                  title="Edit Product"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
  
                                <button
                                  onClick={() => setDeleteTarget({ id: product.id, name: product.name })}
                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors"
                                  title="Delete Product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && isOwner && (
                        <tr>
                          <td colSpan={7} className="p-0 border-b border-jungle-teal-200">
                            <div className="bg-azure-mist-50/30 p-4 inset-shadow-sm border-t border-jungle-teal-100">
                              <h4 className="text-xs font-bold text-jungle-teal-800 mb-2 flex items-center gap-2 uppercase tracking-wider">
                                <Layers className="w-3.5 h-3.5" /> FIFO Active Batches Breakdown
                              </h4>
                              {product.batches && product.batches.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {product.batches.map((batch, idx) => (
                                    <div key={idx} className="bg-white border border-jungle-teal-200 rounded-xl p-3 shadow-2xs flex flex-col gap-1 relative overflow-hidden">
                                      <div className="absolute top-0 left-0 w-1 h-full bg-jungle-teal-400 opacity-50"></div>
                                      <div className="flex justify-between items-start pl-2">
                                        <span className="text-[10px] font-semibold text-jungle-teal-500 uppercase tracking-wide">
                                          Batch {idx + 1}
                                        </span>
                                        {batch.received_at && (
                                          <span className="text-[10px] text-jungle-teal-400 bg-jungle-teal-50 px-1.5 py-0.5 rounded font-mono">
                                            {new Date(batch.received_at).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex justify-between items-end mt-1 pl-2">
                                        <div className="flex flex-col">
                                          <span className="text-[10px] text-jungle-teal-500 mb-0.5">Quantity Left</span>
                                          <span className="font-mono text-sm font-bold text-jungle-teal-900">
                                            {batch.remaining_qty} <span className="text-[10px] text-jungle-teal-600 font-sans">{product.unit}</span>
                                          </span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                          <span className="text-[10px] text-jungle-teal-500 mb-0.5">Cost Price</span>
                                          <span className="font-mono text-sm font-bold text-emerald-700">
                                            ৳ {(batch.cost_price_paisa / 100).toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-jungle-teal-500 italic py-2">
                                  No active FIFO batches found for this product. Fallback unit cost will be used for sales.
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stock-In Modal */}
      {isOwner && stockInProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4">

          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-jungle-teal-900 space-y-4">
            <h3 className="text-base font-bold text-jungle-teal-900">Quick Stock-In</h3>
            <div className="text-xs text-jungle-teal-600 font-sans">
              <div className="mb-2">
                Add inventory for <strong className="text-azure-mist-800 text-sm">{stockInProduct.name}</strong>
              </div>
              
              {stockInProduct.batches && stockInProduct.batches.length > 0 ? (
                <div className="bg-white border border-jungle-teal-200 rounded-lg p-2.5 space-y-1.5 shadow-2xs mb-1">
                  <div className="text-[10px] font-bold text-jungle-teal-800 uppercase tracking-wider mb-1">Current Active Stock:</div>
                  {stockInProduct.batches.map((b, i) => (
                    <div key={i} className="flex justify-between items-center font-mono">
                      <div>
                        <span className="font-semibold text-jungle-teal-900">{b.remaining_qty} {stockInProduct.unit}</span>
                        {b.received_at && (
                          <span className="text-[9px] text-jungle-teal-500 ml-2 font-sans opacity-80" title={new Date(b.received_at).toLocaleString()}>
                            {new Date(b.received_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <span className="text-jungle-teal-700">@ ৳ {(b.cost_price_paisa / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-jungle-teal-200 rounded-lg p-2.5 shadow-2xs mb-1">
                  <div className="text-[10px] font-bold text-jungle-teal-800 uppercase tracking-wider mb-1">Current Active Stock:</div>
                  <div className="flex justify-between items-center font-mono">
                    <span className="font-semibold text-jungle-teal-900">{stockInProduct.stock_qty} {stockInProduct.unit}</span>
                    <span className="text-jungle-teal-700">@ ৳ {(stockInProduct.cost_price_paisa / 100).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleStockInSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">Quantity to Add</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={stockInQty}
                    onChange={(e) => setStockInQty(e.target.value)}
                    className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                  />
                </div>
                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">Unit Cost (৳)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={stockInCost}
                    onChange={(e) => setStockInCost(e.target.value)}
                    className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                  />
                  {(() => {
                    const prevCost = stockInProduct.cost_price_paisa / 100;
                    const curCost = parseFloat(stockInCost);
                    if (isNaN(curCost) || stockInCost === '') return null;
                    const diff = curCost - prevCost;
                    if (diff > 0) {
                      return <div className="text-[10px] text-rose-600 mt-1 font-semibold flex items-center gap-0.5"><span>▲</span> +৳{diff.toFixed(2)} (Higher)</div>;
                    } else if (diff < 0) {
                      return <div className="text-[10px] text-emerald-600 mt-1 font-semibold flex items-center gap-0.5"><span>▼</span> -৳{Math.abs(diff).toFixed(2)} (Lower)</div>;
                    }
                    return <div className="text-[10px] text-jungle-teal-500 mt-1 font-semibold flex items-center gap-0.5"><span>=</span> Same Price</div>;
                  })()}
                </div>
              </div>

              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">New Sell Price (৳)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={stockInSellPrice}
                  onChange={(e) => setStockInSellPrice(e.target.value)}
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                />
              </div>

              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">Note / Reference</label>
                <input
                  type="text"
                  value={stockInReason}
                  onChange={(e) => setStockInReason(e.target.value)}
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">
                <button
                  type="button"
                  onClick={() => setStockInProduct(null)}
                  className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stockInLoading}
                  className="px-5 py-2 bg-muted-teal-700 hover:bg-muted-teal-600 text-white font-bold rounded-xl shadow-md transition-colors"
                >
                  {stockInLoading ? 'Adding...' : 'Confirm Stock-In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showFormModal && (
        <ProductFormModal
          isOpen={showFormModal}
          onClose={() => {
            setShowFormModal(false);
            setEditingProduct(null);
            setInitialBarcode('');
          }}
          product={editingProduct}
          initialBarcode={initialBarcode}
          categories={categories}
          onSuccess={() => {
            onRefresh();
            setShowFormModal(false);
            setEditingProduct(null);
            setInitialBarcode('');
          }}
          onAddCategory={onAddCategory}
          onSelectExistingProduct={(prod) => {
            setEditingProduct(prod);
            setInitialBarcode('');
          }}
        />
      )}

      {/* Barcode Label Print Modal */}
      {showBarcodeModal && barcodeTargetProduct && (
        <BarcodeLabelModal
          isOpen={showBarcodeModal}
          onClose={() => {
            setShowBarcodeModal(false);
            setBarcodeTargetProduct(null);
          }}
          product={barcodeTargetProduct}
        />
      )}

      {/* Bulk CSV Import Modal */}
      {showCsvModal && (
        <CsvImportModal
          isOpen={showCsvModal}
          onClose={() => setShowCsvModal(false)}
          onSuccess={() => {
            onRefresh();
            setShowCsvModal(false);
          }}
        />
      )}

      {/* Stock History Modal */}
      <StockHistoryModal
        isOpen={Boolean(historyTargetProduct)}
        onClose={() => setHistoryTargetProduct(null)}
        product={historyTargetProduct}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete Product"
        message={`Are you sure you want to permanently delete product "${deleteTarget?.name}"?`}
        isDanger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
