import React, { useState, useEffect } from 'react';
import { Supplier, Product, PurchasePayload } from '../../types/ipc';
import {
  Truck,
  Plus,
  Search,
  ShoppingCart,
  DollarSign,
  AlertCircle,
  RefreshCw,
  X,
  Trash2,
  Wallet,
  Clock,
  BookOpen,
  Pencil,
  Check,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { SupplierPaymentModal } from './SupplierPaymentModal';
import { SupplierFormModal, SupplierFormValues } from './SupplierFormModal';
import { SupplierLedgerModal } from './SupplierLedgerModal';
import { ConfirmModal } from '../common/ConfirmModal';

interface SuppliersViewProps {
  products: Product[];
  onRefreshProducts: () => void;
  userRole?: 'owner' | 'staff';
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  products,
  onRefreshProducts,
  userRole,
}) => {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payTarget, setPayTarget] = useState<Supplier | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [dateFilter, setDateFilter] = useState<'7' | '15' | '30' | 'all'>('all');
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [ledgerTarget, setLedgerTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [formBusy, setFormBusy] = useState(false);

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchaseInvoiceRef, setPurchaseInvoiceRef] = useState('');
  const [purchasePaidTaka, setPurchasePaidTaka] = useState('');
  const [purchaseTransportTaka, setPurchaseTransportTaka] = useState('');
  const [transportOnInvoice, setTransportOnInvoice] = useState(false);
  const [purchaseNote, setPurchaseNote] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<
    Array<{ product_id: string; qty: number; unit_cost_taka: number }>
  >([]);

  const [salesSummary, setSalesSummary] = useState<{ soldQty: number, salesTaka: number, profitTaka: number } | null>(null);

  const isOwner = userRole === 'owner';

  const fetchSuppliers = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const [sups, purches] = await Promise.all([
        window.api.suppliers.list(),
        window.api.purchases.list(),
      ]);
      setSuppliers(sups);
      setPurchases(purches);
    } catch (err: any) {
      setError(err.message || 'Failed to load suppliers data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (!window.api) return;
    
    const end = new Date();
    const start = new Date();
    if (dateFilter !== 'all') {
      start.setDate(end.getDate() - parseInt(dateFilter, 10));
    } else {
      start.setFullYear(2000);
    }
    
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    window.api.reports.getProfitReport({ startDate: startStr, endDate: endStr })
      .then(report => {
        const soldQty = (report.product_profits || []).reduce((acc, p) => acc + (p.qty_sold || 0), 0);
        setSalesSummary({
          soldQty,
          salesTaka: (report.total_revenue_paisa || 0) / 100,
          profitTaka: (report.gross_profit_paisa || 0) / 100
        });
      })
      .catch((err) => {
        console.error('Failed to load supplier sales summary:', err);
        toast.error('Could not load the sales summary for this period.');
      });
  }, [dateFilter]);

  const handleSupplierSubmit = async (values: SupplierFormValues) => {
    if (!window.api) return;
    setFormBusy(true);
    try {
      if (editTarget) {
        await window.api.suppliers.update({ id: editTarget.id, ...values });
        toast.success(`"${values.name}" updated.`);
      } else {
        await window.api.suppliers.create(values);
        toast.success(`Supplier "${values.name}" added successfully.`);
      }
      setShowSupplierModal(false);
      setEditTarget(null);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err?.message || 'Could not save that supplier.');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!window.api || !deleteTarget) return;
    const name = deleteTarget.name;
    try {
      await window.api.suppliers.remove(deleteTarget.id);
      toast.success(`"${name}" removed.`);
      setDeleteTarget(null);
      fetchSuppliers();
    } catch (err: any) {
      toast.error(err?.message || 'Could not remove that supplier.');
      setDeleteTarget(null);
    }
  };

  const handleAddPurchaseItem = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    setPurchaseItems((prev) => {
      const existing = prev.find((i) => i.product_id === productId);
      if (existing) {
        return prev.map((i) =>
          i.product_id === productId ? { ...i, qty: i.qty + 1 } : i
        );
      } else {
        return [
          ...prev,
          {
            product_id: productId,
            qty: 10,
            unit_cost_taka: prod.cost_price_paisa / 100,
          },
        ];
      }
    });
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api || purchaseItems.length === 0) {
      toast.warning('Please add at least one product to the purchase order.');
      return;
    }

    try {
      const payload: PurchasePayload = {
        supplier_id: purchaseSupplierId || null,
        invoice_ref: purchaseInvoiceRef.trim() || null,
        paid_taka: parseFloat(purchasePaidTaka) || 0,
        transport_taka: parseFloat(purchaseTransportTaka) || 0,
        transport_on_invoice: transportOnInvoice,
        note: purchaseNote.trim() || null,
        items: purchaseItems,
      };

      await window.api.purchases.create(payload);
      toast.success('Purchase recorded successfully! Inventory stock and cost price updated.');
      setShowPurchaseModal(false);
      setPurchaseItems([]);
      setPurchasePaidTaka('');
      setPurchaseTransportTaka('');
      setTransportOnInvoice(false);
      setPurchaseInvoiceRef('');
      setPurchaseNote('');
      fetchSuppliers();
      onRefreshProducts();
    } catch (err: any) {
      toast.error(`Failed to record purchase: ${err.message}`);
    }
  };

  // Transport is apportioned by line value, so every line's landed cost is its
  // own cost times the same multiplier. The main process does the exact paisa
  // split; this is the preview the buyer sees while typing.
  const goodsTaka = purchaseItems.reduce((sum, i) => sum + i.qty * i.unit_cost_taka, 0);
  const transportTaka = parseFloat(purchaseTransportTaka) || 0;
  // What the vendor is owed and what the stock cost are two different numbers
  // once the shop pays its own carrier: the fare joins the stock either way,
  // the vendor's bill only when they were the one who charged it.
  const vendorInvoiceTaka = goodsTaka + (transportOnInvoice ? transportTaka : 0);
  const landedTotalTaka = goodsTaka + transportTaka;
  const paidTaka = parseFloat(purchasePaidTaka) || 0;
  const dueTaka = Math.max(0, vendorInvoiceTaka - paidTaka);
  const overpaidPurchase = paidTaka > vendorInvoiceTaka + 0.005;
  const landedMultiplier = goodsTaka > 0 ? 1 + transportTaka / goodsTaka : 1;

  const filteredSuppliers = suppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q));
  });

  const now = new Date();
  const filteredPurchases = purchases.filter((p) => {
    if (dateFilter === 'all') return true;
    const diffDays = (now.getTime() - new Date(p.created_at).getTime()) / (1000 * 3600 * 24);
    return diffDays <= parseInt(dateFilter, 10);
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 text-jungle-teal-900 pb-2">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-ui-lg font-semibold text-jungle-teal-900">Suppliers &amp; Purchases</h2>
            <p className="text-ui-xs text-jungle-teal-600">Vendors, purchase invoices and payable ledgers</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && (
            <>
              <button
                onClick={() => {
                  setEditTarget(null);
                  setShowSupplierModal(true);
                }}
                className="h-[40px] px-3.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-ui-sm font-medium flex items-center gap-1.5 border border-jungle-teal-300 transition-colors"
              >
                <Plus className="w-4 h-4 text-azure-mist-700" />
                <span>Add Supplier</span>
              </button>

              <button
                onClick={() => setShowPurchaseModal(true)}
                className="h-[40px] px-4 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>New Purchase Invoice</span>
              </button>
            </>
          )}

          <button
            onClick={fetchSuppliers}
            className="p-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl border border-jungle-teal-300 transition-colors"
            title="Reload"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-ui-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Suppliers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs flex flex-col justify-between space-y-3"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-ui-base font-semibold text-jungle-teal-900">{supplier.name}</h3>
                {isOwner && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditTarget(supplier);
                        setShowSupplierModal(true);
                      }}
                      title="Edit supplier"
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-azure-mist-800 hover:bg-azure-mist-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(supplier)}
                      title={
                        supplier.total_payable_paisa > 0
                          ? 'Settle the payable before removing this vendor'
                          : 'Remove supplier'
                      }
                      disabled={supplier.total_payable_paisa > 0}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-jungle-teal-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-ui-xs text-jungle-teal-600 font-mono">{supplier.phone || 'No phone'}</p>
              {supplier.contact_person && (
                <p className="text-ui-xs text-jungle-teal-700 mt-1">
                  Ask for <span className="font-semibold">{supplier.contact_person}</span>
                </p>
              )}
              {supplier.address && <p className="text-ui-xs text-jungle-teal-600 mt-1">{supplier.address}</p>}
            </div>

            <div className="pt-3 border-t border-jungle-teal-200/50 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-bold text-jungle-teal-500 tracking-wider">Total Payable</p>
                <p className="font-mono text-ui-base font-extrabold text-rose-700">
                  ৳ {(supplier.total_payable_paisa / 100).toFixed(2)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerTarget(supplier)}
                  className="h-[40px] px-3 rounded-xl border border-jungle-teal-300 text-jungle-teal-700 text-ui-sm font-medium flex items-center gap-1.5 hover:bg-jungle-teal-100 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Ledger</span>
                </button>
                {supplier.total_payable_paisa > 0 ? (
                  <button
                    type="button"
                    onClick={() => setPayTarget(supplier)}
                    className="h-[40px] px-4 bg-muted-teal-700 hover:bg-muted-teal-800 text-white font-medium rounded-xl text-ui-sm flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Pay</span>
                  </button>
                ) : (
                  <div className="flex-1 min-w-0 h-[40px] px-3 rounded-xl border border-dashed border-jungle-teal-200 text-jungle-teal-500 text-ui-xs flex items-center justify-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>0 due</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mini Dashboard */}
      {(() => {
        const totalBoughtQty = filteredPurchases.reduce((acc, p) => acc + (p.items?.reduce((s: number, i: any) => s + i.qty, 0) || 0), 0);
        const totalBoughtTaka = filteredPurchases.reduce((acc, p) => acc + p.total_paisa, 0) / 100;
        
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-azure-mist-50/50 border border-azure-mist-200 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-azure-mist-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Truck className="w-4 h-4" /> Period Purchases ({dateFilter === 'all' ? 'All Time' : `Last ${dateFilter} Days`})
              </h3>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-ui-xs text-azure-mist-600 mb-0.5">Total Value</p>
                  <p className="font-mono text-xl font-bold text-azure-mist-900">৳ {totalBoughtTaka.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-ui-xs text-azure-mist-600 mb-0.5">Items Bought</p>
                  <p className="font-mono text-xl font-bold text-azure-mist-900">{totalBoughtQty} pcs</p>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Period Sales & Profit ({dateFilter === 'all' ? 'All Time' : `Last ${dateFilter} Days`})
              </h3>
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-ui-xs text-emerald-600 mb-0.5">Gross Sales</p>
                  <p className="font-mono text-xl font-bold text-emerald-900">৳ {(salesSummary?.salesTaka || 0).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-ui-xs text-emerald-600 mb-0.5">Items Sold</p>
                  <p className="font-mono text-xl font-bold text-emerald-900">{salesSummary?.soldQty || 0} pcs</p>
                </div>
                <div className="text-right">
                  <p className="text-ui-xs text-emerald-600 mb-0.5">Profit Made</p>
                  <p className="font-mono text-xl font-bold text-emerald-700">৳ {(salesSummary?.profitTaka || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Recent Purchases List */}
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-3.5 py-2.5 border-b border-jungle-teal-200 bg-jungle-teal-50 flex justify-between items-center flex-wrap gap-3 text-ui-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-jungle-teal-800">Purchase Invoices History</span>
            <span className="font-mono text-jungle-teal-500 bg-jungle-teal-100 px-1.5 py-0.5 rounded text-xs">{filteredPurchases.length} invoices</span>
          </div>
          <div className="flex items-center bg-white border border-jungle-teal-200 rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={() => setDateFilter('7')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${dateFilter === '7' ? 'bg-azure-mist-600 text-white shadow-sm' : 'text-jungle-teal-600 hover:bg-jungle-teal-50'}`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDateFilter('15')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${dateFilter === '15' ? 'bg-azure-mist-600 text-white shadow-sm' : 'text-jungle-teal-600 hover:bg-jungle-teal-50'}`}
            >
              15 Days
            </button>
            <button
              onClick={() => setDateFilter('30')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${dateFilter === '30' ? 'bg-azure-mist-600 text-white shadow-sm' : 'text-jungle-teal-600 hover:bg-jungle-teal-50'}`}
            >
              30 Days
            </button>
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${dateFilter === 'all' ? 'bg-azure-mist-600 text-white shadow-sm' : 'text-jungle-teal-600 hover:bg-jungle-teal-50'}`}
            >
              All Time
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-ui-sm border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-sans text-ui-2xs font-semibold tracking-wider border-b border-jungle-teal-200">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Ref Invoice</th>
                <th className="px-3 py-2 text-right">Transport (৳)</th>
                <th className="px-3 py-2 text-right">Total (৳)</th>
                <th className="px-3 py-2 text-right">Paid (৳)</th>
                <th className="px-3 py-2 text-right">Due (৳)</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-jungle-teal-500 font-sans">
                    No purchase history found for the selected period.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((p) => {
                  const isExpanded = expandedPurchaseId === p.id;
                  return (
                    <React.Fragment key={p.id}>
                      <tr 
                        onClick={() => setExpandedPurchaseId(isExpanded ? null : p.id)}
                        className={`h-[46px] hover:bg-azure-mist-50/40 transition-colors cursor-pointer ${isExpanded ? 'bg-azure-mist-50/50' : ''}`}
                      >
                        <td className="px-3 text-jungle-teal-600">{new Date(p.created_at).toLocaleDateString()}</td>
                        <td className="px-3 font-sans text-jungle-teal-900 font-bold">{p.supplier_name || 'Generic Vendor'}</td>
                        <td className="px-3 text-azure-mist-800 font-bold">{p.invoice_ref || '-'}</td>
                        <td className="px-3 text-right font-mono text-ui-sm whitespace-nowrap text-amber-700">
                          {p.transport_paisa ? `৳ ${(p.transport_paisa / 100).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 text-right font-mono text-ui-sm font-semibold text-jungle-teal-900 whitespace-nowrap">৳ {(p.total_paisa / 100).toFixed(2)}</td>
                        <td className="px-3 text-right font-mono text-ui-sm font-semibold text-muted-teal-800 whitespace-nowrap">৳ {(p.paid_paisa / 100).toFixed(2)}</td>
                        <td
                          className={`px-3 text-right font-mono text-ui-sm font-semibold whitespace-nowrap ${
                            p.total_paisa - p.paid_paisa > 0 ? 'text-rose-700' : 'text-jungle-teal-400'
                          }`}
                        >
                          ৳ {Math.max(0, (p.total_paisa - p.paid_paisa) / 100).toFixed(2)}
                        </td>
                        <td className="px-3 font-sans text-jungle-teal-500">{p.note || '-'}</td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0 border-b border-jungle-teal-200">
                            <div className="bg-azure-mist-50/30 p-3 inset-shadow-sm border-t border-jungle-teal-100">
                              <h4 className="text-[11px] font-bold text-jungle-teal-800 mb-2 flex items-center gap-1 uppercase tracking-wider">
                                <ShoppingCart className="w-3.5 h-3.5" /> Items Purchased
                              </h4>
                              {p.items && p.items.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {p.items.map((item: any, idx: number) => (
                                    <div key={idx} className="bg-white border border-jungle-teal-200 rounded-lg p-2 flex flex-col gap-1 shadow-2xs">
                                      <div className="font-bold text-jungle-teal-900 text-xs truncate">
                                        {item.product_name}
                                      </div>
                                      <div className="flex justify-between items-center text-[10px] font-mono">
                                        <span className="text-jungle-teal-600">Qty: {item.qty}</span>
                                        <span className="text-emerald-700 font-bold">৳ {(item.unit_cost_paisa / 100).toFixed(2)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-jungle-teal-500 italic py-1">No items details available for this invoice.</div>
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

      {showSupplierModal && (
        <SupplierFormModal
          supplier={editTarget}
          busy={formBusy}
          onSubmit={handleSupplierSubmit}
          onClose={() => {
            setShowSupplierModal(false);
            setEditTarget(null);
          }}
        />
      )}

      {/* New Purchase Modal */}
      {showPurchaseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setShowPurchaseModal(false)}
        >
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-2xl w-full max-h-[92vh] shadow-2xl text-jungle-teal-900 flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-jungle-teal-200 shrink-0">
              <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shrink-0">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-ui-lg font-semibold">Record New Purchase Invoice</h3>
                <p className="text-ui-xs text-jungle-teal-600">
                  Stock and cost price update the moment this is saved
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPurchaseModal(false)}
                title="Close"
                className="ml-auto w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePurchaseSubmit} className="flex-1 min-h-0 flex flex-col text-ui-sm">
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">Supplier</label>
                  <select
                    value={purchaseSupplierId}
                    onChange={(e) => setPurchaseSupplierId(e.target.value)}
                    className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                  >
                    <option value="">-- Generic / Spot Vendor --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">Vendor Invoice / Challan Ref</label>
                  <input
                    type="text"
                    value={purchaseInvoiceRef}
                    onChange={(e) => setPurchaseInvoiceRef(e.target.value)}
                    placeholder="e.g. CHAL-8892"
                    className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                  />
                </div>
              </div>

              {/* Items Picker */}
              <div className="space-y-2">
                <label className="block text-jungle-teal-700 font-semibold">Select Products to Add:</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddPurchaseItem(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-semibold"
                >
                  <option value="">-- Click to choose product --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.barcode}) - Current Cost: ৳{(p.cost_price_paisa / 100).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div className="border border-jungle-teal-200 rounded-xl overflow-hidden bg-jungle-teal-50">
                <table className="w-full text-left text-ui-sm">
                  <thead className="bg-jungle-teal-100 text-jungle-teal-600 font-sans text-ui-2xs font-semibold uppercase tracking-wider border-b border-jungle-teal-200">
                    <tr>
                      <th className="px-2.5 py-2">Product</th>
                      <th className="px-2.5 py-2 text-center">Qty</th>
                      <th className="px-2.5 py-2 text-right">Unit Cost (৳)</th>
                      {transportTaka > 0 && (
                        <th className="px-2.5 py-2 text-right">Landed/unit</th>
                      )}
                      <th className="px-2.5 py-2 text-right">Total (৳)</th>
                      <th className="px-2.5 py-2 text-center">Del</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-jungle-teal-100">
                    {purchaseItems.map((item, idx) => {
                      const prod = products.find((p) => p.id === item.product_id);
                      return (
                        <tr key={idx} className="hover:bg-jungle-teal-50 transition-colors">
                          <td className="p-2.5 font-sans font-semibold text-jungle-teal-900">{prod?.name}</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 1;
                                setPurchaseItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, qty: val } : it))
                                );
                              }}
                              className="w-16 bg-jungle-teal-50 border border-jungle-teal-300 rounded-sm px-1.5 py-0.5 text-center text-jungle-teal-900 font-bold"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_cost_taka}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setPurchaseItems((prev) =>
                                  prev.map((it, i) => (i === idx ? { ...it, unit_cost_taka: val } : it))
                                );
                              }}
                              className="w-20 bg-jungle-teal-50 border border-jungle-teal-300 rounded-sm px-1.5 py-0.5 text-right text-jungle-teal-900 font-bold"
                            />
                          </td>
                          {transportTaka > 0 && (
                            <td className="p-2.5 text-right font-mono text-amber-700 whitespace-nowrap">
                              ৳ {(item.unit_cost_taka * landedMultiplier).toFixed(2)}
                            </td>
                          )}
                          <td className="p-2.5 text-right font-bold text-jungle-teal-900 whitespace-nowrap">
                            ৳ {(item.qty * item.unit_cost_taka).toFixed(2)}
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() =>
                                setPurchaseItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="text-jungle-teal-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Charges & Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">
                    Transport / Carrying (৳)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchaseTransportTaka}
                    onChange={(e) => setPurchaseTransportTaka(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                  />
                  <p className="mt-1 text-ui-2xs text-jungle-teal-600">
                    Truck fare, labour, unloading &mdash; split across the lines by value.
                  </p>
                </div>

                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">Paid Amount (৳)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={purchasePaidTaka}
                      onChange={(e) => setPurchasePaidTaka(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 min-w-0 bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono font-bold focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                    />
                    <button
                      type="button"
                      onClick={() => setPurchasePaidTaka(vendorInvoiceTaka.toFixed(2))}
                      disabled={vendorInvoiceTaka <= 0}
                      className="shrink-0 px-3 py-2 rounded-xl border border-jungle-teal-300 text-ui-xs font-medium text-jungle-teal-700 hover:bg-jungle-teal-100 transition-colors disabled:opacity-40"
                    >
                      Pay full
                    </button>
                  </div>
                  <p className="mt-1 text-ui-2xs text-jungle-teal-600">
                    Leave it short to keep the rest as payable on this vendor.
                  </p>
                </div>
              </div>

              {transportTaka > 0 && (
                <div>
                  <p className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 mb-1">
                    Who gets the ৳ {transportTaka.toFixed(2)} transport?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        on: false,
                        label: 'Paid separately',
                        hint: 'Own pickup, thela, labour',
                      },
                      {
                        on: true,
                        label: "Vendor's bill",
                        hint: 'Charge printed on their challan',
                      },
                    ].map((opt) => (
                      <label
                        key={String(opt.on)}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border cursor-pointer transition-colors ${
                          transportOnInvoice === opt.on
                            ? 'border-azure-mist-700 bg-azure-mist-50'
                            : 'border-jungle-teal-200 hover:bg-jungle-teal-100'
                        }`}
                      >
                        <input
                          type="radio"
                          name="transport-payee"
                          checked={transportOnInvoice === opt.on}
                          onChange={() => setTransportOnInvoice(opt.on)}
                          className="shrink-0 accent-azure-mist-700"
                        />
                        <span className="min-w-0">
                          <span className="block text-ui-xs font-medium text-jungle-teal-900">
                            {opt.label}
                          </span>
                          <span className="block text-ui-2xs text-jungle-teal-600 truncate">
                            {opt.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">Internal Note</label>
                <input
                  type="text"
                  value={purchaseNote}
                  onChange={(e) => setPurchaseNote(e.target.value)}
                  placeholder="e.g. Paid in full via Bank"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                />
              </div>

              </div>

              {/* Fixed footer — the numbers that decide the save stay visible */}
              <div className="shrink-0 border-t border-jungle-teal-200 bg-jungle-teal-100/60">
                <div className="grid grid-cols-3 gap-px bg-jungle-teal-200">
                  <div className="bg-jungle-teal-100/60 px-4 py-2">
                    <p className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
                      Vendor invoice
                    </p>
                    <p className="font-mono text-ui-base font-semibold whitespace-nowrap text-jungle-teal-900">
                      ৳ {vendorInvoiceTaka.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-jungle-teal-100/60 px-4 py-2">
                    <p className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
                      Becomes payable
                    </p>
                    <p
                      className={`font-mono text-ui-base font-semibold whitespace-nowrap ${
                        dueTaka > 0 ? 'text-rose-700' : 'text-muted-teal-800'
                      }`}
                    >
                      ৳ {dueTaka.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-jungle-teal-100/60 px-4 py-2">
                    <p className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
                      Stock landed cost
                    </p>
                    <p
                      className={`font-mono text-ui-base font-semibold whitespace-nowrap ${
                        transportTaka > 0 ? 'text-amber-700' : 'text-jungle-teal-900'
                      }`}
                    >
                      ৳ {landedTotalTaka.toFixed(2)}
                    </p>
                  </div>
                </div>

                {overpaidPurchase && (
                  <div className="mx-5 mt-2.5 flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-3 py-2 text-ui-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>
                      Paid amount is more than this vendor&rsquo;s bill of ৳{' '}
                      {vendorInvoiceTaka.toFixed(2)}
                      {transportTaka > 0 && !transportOnInvoice
                        ? ' \u2014 transport is paid separately, so it is not part of the vendor bill.'
                        : '.'}
                    </span>
                  </div>
                )}

                <div className="px-5 py-3 flex items-center gap-3">
                  <p className="text-ui-2xs text-jungle-teal-600 min-w-0">
                    {purchaseItems.length === 0
                      ? 'Add at least one product to save.'
                      : transportTaka > 0
                        ? `Goods ৳ ${goodsTaka.toFixed(2)} + transport ৳ ${transportTaka.toFixed(2)} ${
                            transportOnInvoice ? 'on the vendor bill' : 'paid separately'
                          } · stock costed ${((landedMultiplier - 1) * 100).toFixed(1)}% above vendor price`
                        : `${purchaseItems.length} ${purchaseItems.length === 1 ? 'line' : 'lines'} · goods ৳ ${goodsTaka.toFixed(2)}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPurchaseModal(false)}
                    className="ml-auto shrink-0 h-[40px] px-4 rounded-xl text-ui-sm font-medium text-jungle-teal-700 hover:bg-jungle-teal-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={overpaidPurchase || purchaseItems.length === 0}
                    className="shrink-0 h-[40px] px-4 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-medium rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save &amp; Update Inventory</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {payTarget && (
        <SupplierPaymentModal
          supplier={payTarget}
          busy={payBusy}
          onClose={() => setPayTarget(null)}
          onSubmit={async (amountTaka, method, note) => {
            if (!window.api) return;
            setPayBusy(true);
            try {
              const res = await window.api.suppliers.payDue({
                supplier_id: payTarget.id,
                amount_taka: amountTaka,
                method,
                note,
              });
              toast.success(
                `Paid ৳ ${amountTaka.toFixed(2)} to ${payTarget.name}. Payable now ৳ ${(
                  res.remainingPayablePaisa / 100
                ).toFixed(2)}.`
              );
              setPayTarget(null);
              fetchSuppliers();
            } catch (err: any) {
              toast.error(err?.message || 'Could not record that payment.');
            } finally {
              setPayBusy(false);
            }
          }}
        />
      )}

      {ledgerTarget && (
        <SupplierLedgerModal
          supplier={ledgerTarget}
          onClose={() => setLedgerTarget(null)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        isDanger
        title="Remove this supplier?"
        message={`"${deleteTarget?.name}" will no longer appear in the vendor list. Past purchase invoices stay in the history untouched.`}
        confirmLabel="Remove supplier"
        onConfirm={handleDeleteSupplier}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
