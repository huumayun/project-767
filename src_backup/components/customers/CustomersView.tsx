import React, { useState, useEffect } from 'react';
import { Customer, CustomerDueSummary, UserSession } from '../../types/ipc';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  FileText,
  AlertCircle,
  RefreshCw,
  Phone,
  MapPin,
  CheckCircle2,
  UserPlus,
  MessageSquare,
  Share2,
} from 'lucide-react';
import { CustomerFormModal } from './CustomerFormModal';
import { DueCollectionModal } from './DueCollectionModal';
import { CustomerLedgerModal } from './CustomerLedgerModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

interface CustomersViewProps {
  currentSession: UserSession | null;
  /**
   * Called when cash moves in or out of the drawer.
   *
   * The running shift lives in App; without this the sidebar's cash figure
   * stays at whatever it was when the till opened.
   */
  onShiftChanged?: () => void;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ currentSession, onShiftChanged }) => {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [dueSummary, setDueSummary] = useState<CustomerDueSummary | null>(null);
  const [search, setSearch] = useState('');
  const [dueOnlyFilter, setDueOnlyFilter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [collectTargetCustomer, setCollectTargetCustomer] = useState<Customer | null>(null);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [ledgerTargetCustomer, setLedgerTargetCustomer] = useState<Customer | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  // Delete Confirm Modal State
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState<Customer | null>(null);

  const isOwner = currentSession?.role === 'owner';

  const fetchData = async () => {
    if (!window.api) return;
    setLoading(true);
    setError(null);
    try {
      const [list, summary] = await Promise.all([
        window.api.customers.list(),
        window.api.customers.getDueSummary(),
      ]);
      setCustomers(list);
      setDueSummary(summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeletePrompt = (customer: Customer) => {
    if (customer.due_paisa && customer.due_paisa > 0) {
      toast.error(
        `Cannot delete customer! Outstanding due balance of ৳ ${(customer.due_paisa / 100).toFixed(
          2
        )} must be cleared first.`
      );
      return;
    }
    setDeleteTargetCustomer(customer);
  };

  const confirmDelete = async () => {
    if (!deleteTargetCustomer || !window.api) return;
    try {
      await window.api.customers.delete(deleteTargetCustomer.id);
      toast.success(`Customer profile "${deleteTargetCustomer.name}" deleted.`);
      setDeleteTargetCustomer(null);
      fetchData();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  // WhatsApp Reminder Handler
  const handleSendWhatsAppReminder = (cust: Customer) => {
    const dueAmount = ((cust.due_paisa || 0) / 100).toFixed(2);
    const message = `Dear ${cust.name}, you have an outstanding due balance of ৳${dueAmount} at our shop. Please settle it at your earliest convenience. Thank you.`;

    let cleanPhone = (cust.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('01')) {
      cleanPhone = '880' + cleanPhone.slice(1);
    } else if (cleanPhone.startsWith('1')) {
      cleanPhone = '880' + cleanPhone;
    }

    if (cleanPhone.length >= 10) {
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      // window.open is denied by the main process, so this goes through the
      // shell and opens in the real browser.
      window.api?.shell
        .openExternal(waUrl)
        .then(() => toast.success(`WhatsApp reminder opened for ${cust.name}`))
        .catch(() => {
          navigator.clipboard.writeText(message);
          toast.info('Could not open WhatsApp. The reminder was copied to the clipboard instead.');
        });
    } else {
      // If phone number is incomplete, copy message to clipboard
      navigator.clipboard.writeText(message);
      toast.info('No valid phone number for direct link. Reminder message copied to clipboard!');
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (dueOnlyFilter && (!c.due_paisa || c.due_paisa <= 0)) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="h-full flex-1 flex flex-col overflow-hidden min-h-0 space-y-2.5 text-jungle-teal-900 font-sans">
      {/* Top Header - Fixed */}
      <div className="shrink-0 flex items-center justify-between flex-wrap gap-3 bg-jungle-teal-50 border border-jungle-teal-200 p-3 sm:p-3.5 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-ui-lg font-semibold text-jungle-teal-900">Customers &amp; Dues</h2>
            <p className="text-ui-xs text-jungle-teal-600">Due ledger, partial payments and collection receipts</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setEditingCustomer(null);
              setShowFormModal(true);
            }}
            className="h-[40px] px-4 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-semibold rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl border border-jungle-teal-300 transition-colors"
            title="Reload Directory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Due Summary KPIs - Fixed */}
      {dueSummary && (
        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-3 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans block">Total Active Customers</span>
              <span className="text-ui-2xl font-semibold font-mono text-jungle-teal-900">{dueSummary.total_customers_count}</span>
            </div>
            <div className="p-2 bg-jungle-teal-50 text-jungle-teal-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-3 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans block">Customers with Due Balance</span>
              <span className="text-ui-2xl font-semibold font-mono text-amber-800">
                {dueSummary.customers_with_due_count}
              </span>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-3 rounded-2xl shadow-xs flex items-center justify-between">
            <div>
              <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600 font-sans block">Total Outstanding Due</span>
              <span className="text-ui-2xl font-semibold font-mono text-amber-800">
                ৳ {(dueSummary.total_due_paisa / 100).toFixed(2)}
              </span>
            </div>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Search & Due Filter Toolbar */}
      <div className="shrink-0 flex items-center justify-between gap-3 bg-jungle-teal-50 border border-jungle-teal-200 p-2.5 rounded-2xl shadow-xs flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-jungle-teal-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers by name, phone, or address..."
            className="w-full h-[40px] bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl pl-10 pr-4 text-ui-sm placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
          />
        </div>

        <button
          onClick={() => setDueOnlyFilter(!dueOnlyFilter)}
          className={`h-[40px] px-3.5 rounded-xl text-ui-sm font-medium flex items-center gap-1.5 transition-colors border ${
            dueOnlyFilter
              ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
              : 'bg-jungle-teal-100 text-jungle-teal-700 border-jungle-teal-300 hover:bg-jungle-teal-200'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Show Due Only ({dueSummary?.customers_with_due_count || 0})</span>
        </button>
      </div>

      {error && (
        <div className="shrink-0 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-ui-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Customer Directory Table */}
      <div className="flex-1 bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full text-left text-ui-sm border-collapse">
            <thead className="sticky top-0 bg-jungle-teal-100 text-jungle-teal-600 uppercase font-sans text-ui-2xs font-semibold tracking-wider border-b border-jungle-teal-200 z-10">
              <tr>
                <th className="px-3 py-2">Customer Details</th>
                <th className="px-3 py-2">Contact Phone</th>
                <th className="px-3 py-2">Address</th>
                <th className="px-3 py-2 text-right">Lifetime Sales</th>
                <th className="px-3 py-2 text-right">Paid to Date</th>
                <th className="px-3 py-2 text-right">Balance Due</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-jungle-teal-500 font-sans text-ui-sm">
                    No customer accounts found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const due = cust.due_paisa || 0;
                  const hasDue = due > 0;

                  return (
                    <tr key={cust.id} className="h-[52px] hover:bg-azure-mist-50/40 transition-colors">
                      <td className="px-3 font-sans">
                        <div className="text-ui-sm font-semibold text-jungle-teal-900">{cust.name}</div>
                        {cust.note && <div className="text-ui-2xs text-jungle-teal-500 mt-0.5">{cust.note}</div>}
                      </td>
                      <td className="px-3 text-jungle-teal-600">
                        {cust.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-jungle-teal-400" />
                            <span>{cust.phone}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-3 font-sans text-jungle-teal-600">{cust.address || '-'}</td>
                      <td className="px-3 text-right text-jungle-teal-600">
                        ৳ {((cust.total_sales_paisa || 0) / 100).toFixed(2)}
                      </td>
                      <td className="px-3 text-right text-muted-teal-800">
                        ৳ {((cust.total_paid_paisa || 0) / 100).toFixed(2)}
                      </td>
                      <td className="px-3 text-right">
                        <span
                          className={`font-mono text-ui-base font-semibold ${
                            hasDue ? 'text-amber-700' : 'text-muted-teal-800'
                          }`}
                        >
                          ৳ {(due / 100).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 font-sans">
                          {hasDue && (
                            <>
                              <button
                                onClick={() => {
                                  setCollectTargetCustomer(cust);
                                  setShowCollectModal(true);
                                }}
                                className="h-8 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-300 font-medium text-ui-xs flex items-center gap-1 transition-colors"
                                title="Collect Due / Baki Payment"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Collect</span>
                              </button>

                              <button
                                onClick={() => handleSendWhatsAppReminder(cust)}
                                className="h-8 px-2.5 bg-muted-teal-50 hover:bg-muted-teal-100 text-muted-teal-900 rounded-lg border border-muted-teal-300 font-medium text-ui-xs flex items-center gap-1 transition-colors"
                                title="Send a due reminder on WhatsApp (written in Bangla)"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-muted-teal-700" />
                                <span>WhatsApp</span>
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => {
                              setLedgerTargetCustomer(cust);
                              setShowLedgerModal(true);
                            }}
                            className="p-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors"
                            title="View Account Statement & Ledger"
                          >
                            <FileText className="w-3.5 h-3.5 text-azure-mist-700" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingCustomer(cust);
                              setShowFormModal(true);
                            }}
                            className="p-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {isOwner && (
                            <button
                              onClick={() => handleDeletePrompt(cust)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-colors"
                              title="Delete Customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showFormModal && (
        <CustomerFormModal
          isOpen={showFormModal}
          onClose={() => setShowFormModal(false)}
          customer={editingCustomer}
          onSuccess={() => {
            fetchData();
            setShowFormModal(false);
          }}
        />
      )}

      {/* Collect Due Modal */}
      {showCollectModal && collectTargetCustomer && (
        <DueCollectionModal
          isOpen={showCollectModal}
          onClose={() => {
            setShowCollectModal(false);
            setCollectTargetCustomer(null);
          }}
          customer={collectTargetCustomer}
          onSuccess={() => {
            fetchData();
            // Cash over the counter lands in the same drawer a sale does.
            onShiftChanged?.();
            setShowCollectModal(false);
            setCollectTargetCustomer(null);
          }}
        />
      )}

      {/* Account Statement / Ledger Modal */}
      {showLedgerModal && ledgerTargetCustomer && (
        <CustomerLedgerModal
          isOpen={showLedgerModal}
          onClose={() => {
            setShowLedgerModal(false);
            setLedgerTargetCustomer(null);
          }}
          customer={ledgerTargetCustomer}
        />
      )}

      {/* Custom Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteTargetCustomer)}
        title="Delete Customer Account"
        message={`Are you sure you want to permanently delete customer profile "${deleteTargetCustomer?.name}"?`}
        isDanger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetCustomer(null)}
      />
    </div>
  );
};
