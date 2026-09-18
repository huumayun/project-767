import React, { useEffect, useRef, useState } from 'react';
import { Supplier } from '../../types/ipc';
import { Truck, X, Check, AlertCircle } from 'lucide-react';

export interface SupplierFormValues {
  name: string;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  opening_balance_taka: number;
  payment_terms_days: number | null;
  note: string | null;
}

interface SupplierFormModalProps {
  /** Passing a supplier switches the modal to edit mode. */
  supplier?: Supplier | null;
  busy?: boolean;
  onSubmit: (values: SupplierFormValues) => void;
  onClose: () => void;
}

const inputClass =
  'w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600';

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  supplier,
  busy = false,
  onSubmit,
  onClose,
}) => {
  const isEdit = !!supplier;
  const [name, setName] = useState(supplier?.name || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [address, setAddress] = useState(supplier?.address || '');
  const [contact, setContact] = useState(supplier?.contact_person || '');
  const [opening, setOpening] = useState(
    supplier ? ((supplier.opening_balance_paisa || 0) / 100).toFixed(2) : ''
  );
  const [terms, setTerms] = useState(
    supplier?.payment_terms_days != null ? String(supplier.payment_terms_days) : ''
  );
  const [note, setNote] = useState(supplier?.note || '');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  // Editing the opening balance moves the live payable by the same amount, so
  // the buyer is told what their correction will actually do before they save.
  const openingPaisa = Math.round((parseFloat(opening) || 0) * 100);
  const previousOpeningPaisa = supplier?.opening_balance_paisa || 0;
  const openingDeltaPaisa = isEdit ? openingPaisa - previousOpeningPaisa : 0;
  const projectedPayablePaisa = (supplier?.total_payable_paisa || 0) + openingDeltaPaisa;
  const openingTooLow = isEdit && projectedPayablePaisa < 0;
  const canSave = name.trim().length > 0 && !openingTooLow && !busy;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    onSubmit({
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      contact_person: contact.trim() || null,
      opening_balance_taka: parseFloat(opening) || 0,
      payment_terms_days: terms.trim() ? parseInt(terms, 10) : null,
      note: note.trim() || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-jungle-teal-900 space-y-4 my-8">
        <div className="flex items-start gap-3 border-b border-jungle-teal-200 pb-3">
          <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-ui-lg font-semibold">
              {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
            </h3>
            <p className="text-ui-xs text-jungle-teal-600">
              {isEdit
                ? 'Vendor details and opening balance corrections'
                : 'Vendor details and the balance you already owe them'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="ml-auto w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-jungle-teal-400 hover:text-jungle-teal-900 hover:bg-jungle-teal-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3 text-ui-sm">
          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">
              Supplier / Vendor Name *
            </label>
            <input
              ref={nameRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onClose()}
              placeholder="e.g. Rahim Spares Importer"
              className={`${inputClass} font-semibold`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01700-000000"
                className={`${inputClass} font-mono`}
              />
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">Contact Person</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. Jamal (manager)"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">Address / Hub</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Nawabpur, Dhaka"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">
                Opening Payable (৳)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} font-mono font-bold`}
              />
              <p className="mt-1 text-ui-2xs font-normal text-jungle-teal-600">
                {isEdit
                  ? 'Correcting this moves the payable by the same amount.'
                  : 'What you already owe them from before this software.'}
              </p>
            </div>

            <div>
              <label className="block text-jungle-teal-700 font-semibold mb-1">
                Payment Terms (days)
              </label>
              <input
                type="number"
                min="0"
                max="365"
                step="1"
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="e.g. 30"
                className={`${inputClass} font-mono font-bold`}
              />
              <p className="mt-1 text-ui-2xs font-normal text-jungle-teal-600">
                Credit window agreed with them. Blank means cash only.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-jungle-teal-700 font-semibold mb-1">Note</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. delivers Sat and Tue only"
              className={inputClass}
            />
          </div>

          {isEdit && openingDeltaPaisa !== 0 && !openingTooLow && (
            <p className="text-ui-xs text-jungle-teal-600">
              Payable moves {openingDeltaPaisa > 0 ? 'up' : 'down'} by{' '}
              <span className="font-mono font-semibold text-jungle-teal-900">
                ৳ {(Math.abs(openingDeltaPaisa) / 100).toFixed(2)}
              </span>{' '}
              to{' '}
              <span className="font-mono font-semibold text-jungle-teal-900">
                ৳ {(projectedPayablePaisa / 100).toFixed(2)}
              </span>
              .
            </p>
          )}

          {openingTooLow && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-3 py-2 text-ui-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                That opening balance would push the payable below zero. The lowest it can go is ৳{' '}
                {((previousOpeningPaisa - (supplier?.total_payable_paisa || 0)) / 100).toFixed(2)}.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">
            <button
              type="button"
              onClick={onClose}
              className="h-[40px] px-4 rounded-xl text-ui-sm font-medium text-jungle-teal-700 hover:bg-jungle-teal-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="h-[40px] px-4 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-medium rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Save Supplier'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
