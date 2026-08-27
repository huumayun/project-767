import React, { useState, useEffect } from 'react';
import { Customer } from '../../types/ipc';
import { UserPlus, X, AlertCircle } from 'lucide-react';

interface CustomerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSuccess: (customer: Customer) => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customer) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
      setNote(customer.note || '');
    } else {
      setName('');
      setPhone('');
      setAddress('');
      setNote('');
    }
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!window.api) return;

    setLoading(true);
    setError(null);
    try {
      if (customer) {
        await window.api.customers.update({
          id: customer.id,
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          note: note.trim() || null,
        });
        onSuccess({
          ...customer,
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          note: note.trim() || null,
        });
      } else {
        const created = await window.api.customers.create({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          note: note.trim() || null,
        });
        onSuccess(created);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save customer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 space-y-4">
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">
                {customer ? 'Edit Customer Profile' : 'Register New Customer'}
              </h3>
              <p className="text-xs text-jungle-teal-500 font-mono">Baki / Due Account Ledger Profile</p>
            </div>
          </div>

          <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">Customer / Workshop Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Master Anis Auto Works"
              className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-semibold"
            />
          </div>

          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01700-000000"
              className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
            />
          </div>

          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">Address / Garage Location</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Tejgaon Industrial Area, Dhaka"
              className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
            />
          </div>

          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">Credit Limit / Reference Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Reliable mechanic, payment on Saturdays"
              className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">
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
              {loading ? 'Saving...' : customer ? 'Update Profile' : 'Save Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
