import React, { useState } from 'react';
import { Customer, CustomerDueAdjustmentResult } from '../../types/ipc';
import {
  SlidersHorizontal,
  X,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  Calendar,
  FileText,
  CheckCircle2,
  Printer,
  Check,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { printCustomerDueAdjustment } from '../../utils/receiptGenerator';

interface CustomerDueAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  onSuccess: (result: CustomerDueAdjustmentResult) => void;
}

export const CustomerDueAdjustmentModal: React.FC<CustomerDueAdjustmentModalProps> = ({
  isOpen,
  onClose,
  customer,
  onSuccess,
}) => {
  const toast = useToast();
  const [type, setType] = useState<'add' | 'deduct'>('add');
  const [amountTaka, setAmountTaka] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('পুরোনো খাতার বকেয়া যোগ');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [receiptData, setReceiptData] = useState<CustomerDueAdjustmentResult | null>(null);

  if (!isOpen) return null;

  const currentDuePaisa = customer.due_paisa || 0;
  const numAmount = parseFloat(amountTaka) || 0;
  const amountPaisa = Math.round(numAmount * 100);

  const newDuePaisa =
    type === 'add'
      ? currentDuePaisa + amountPaisa
      : Math.max(0, currentDuePaisa - amountPaisa);

  const quickNotes = [
    'পুরোনো খাতার বকেয়া যোগ',
    'পূর্বের হিসাব সমন্বয়',
    'হিসাবের ভুল সংশোধন',
    'বিশেষ ছাড় / বাকি মওকুফ',
  ];

  const handlePrintSlip = async (result: CustomerDueAdjustmentResult) => {
    try {
      await printCustomerDueAdjustment({
        adjustmentId: result.id,
        customer,
        type,
        amountPaisa: Math.abs(result.adjustment_paisa),
        previousDuePaisa: result.previous_due_paisa,
        newDuePaisa: result.new_due_paisa,
        note: note.trim(),
        date: date || undefined,
      });
    } catch (err: any) {
      console.error('Failed to print receipt:', err);
      toast.error('রশিদ প্রিন্ট করতে সমস্যা হয়েছে।');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountPaisa <= 0) {
      setError('দয়া করে টাকার পরিমাণ ০ এর বেশি দিন (Please enter an amount greater than 0).');
      return;
    }

    if (type === 'deduct' && amountPaisa > currentDuePaisa) {
      setError(
        `কমানোর পরিমাণ বর্তমান বাকির চেয়ে বেশি হতে পারে না (বর্তমান বাকি: ৳ ${(
          currentDuePaisa / 100
        ).toFixed(2)})।`
      );
      return;
    }

    if (!note.trim()) {
      setError('বাকি সমন্বয়ের কারণ / নোট দেওয়া আবশ্যক (Note / Reason is required).');
      return;
    }

    if (!window.api) return;

    setLoading(true);
    setError(null);
    try {
      const res = await window.api.customers.adjustDue({
        customer_id: customer.id,
        amount_taka: numAmount,
        type,
        note: note.trim(),
        date: date || undefined,
      });

      if (res.success) {
        toast.success(
          type === 'add'
            ? `৳ ${(amountPaisa / 100).toFixed(2)} বাকি সফলভাবে যোগ করা হয়েছে।`
            : `৳ ${(amountPaisa / 100).toFixed(2)} বাকি সফলভাবে কমানো হয়েছে।`
        );
        setReceiptData(res);

        if (autoPrint) {
          handlePrintSlip(res);
        }
      }
    } catch (err: any) {
      setError(err.message || 'বাকি সমন্বয় ব্যর্থ হয়েছে (Adjustment failed).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 space-y-4 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">
                {receiptData ? 'Due Adjustment Receipt' : 'Adjust Customer Due'}
              </h3>
              <p className="text-xs text-jungle-teal-600 font-medium">
                {customer.name} {customer.phone ? `(${customer.phone})` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (receiptData) {
                onSuccess(receiptData);
              }
              onClose();
            }}
            className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!receiptData ? (
          /* 1. Adjustment Form */
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Current Due Banner */}
            <div className="bg-jungle-teal-100/60 border border-jungle-teal-200 rounded-xl p-3 flex items-center justify-between">
              <span className="font-semibold text-jungle-teal-800">Current Outstanding Due (বর্তমান বাকি):</span>
              <span className="font-mono text-sm font-bold text-amber-800">
                ৳ {(currentDuePaisa / 100).toFixed(2)}
              </span>
            </div>

            {/* Adjustment Type Switcher */}
            <div>
              <label className="block text-jungle-teal-800 font-semibold mb-1.5">Adjustment Type (সমন্বয়ের ধরন):</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setType('add');
                    if (note.includes('মওকুফ') || note.includes('কমানো') || note.includes('সংশোধন')) {
                      setNote('পুরোনো খাতার বকেয়া যোগ');
                    }
                  }}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                    type === 'add'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                      : 'bg-jungle-teal-50 border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Due (+ বাকি যোগ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setType('deduct');
                    if (note.includes('যোগ')) {
                      setNote('হিসাবের ভুল সংশোধন');
                    }
                  }}
                  className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                    type === 'deduct'
                      ? 'bg-muted-teal-700 text-white border-muted-teal-800 shadow-xs'
                      : 'bg-jungle-teal-50 border-jungle-teal-200 text-jungle-teal-700 hover:bg-jungle-teal-100'
                  }`}
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>Deduct (- বাকি কমানো)</span>
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <label className="block text-jungle-teal-800 font-semibold mb-1">
                Adjustment Amount (সমন্বয় পরিমাণ ৳) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-jungle-teal-500">৳</span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  autoFocus
                  placeholder="0.00"
                  value={amountTaka}
                  onChange={(e) => setAmountTaka(e.target.value)}
                  className="w-full bg-white border border-jungle-teal-300 rounded-xl pl-8 pr-3 py-2 text-base font-mono font-bold text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:ring-2 focus:ring-azure-mist-500/20"
                />
              </div>
            </div>

            {/* Live Calculation Formula Card */}
            <div className="bg-azure-mist-50/70 border border-azure-mist-200 rounded-xl p-3.5 space-y-2">
              <div className="text-[11px] font-semibold text-azure-mist-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-azure-mist-700" />
                <span>Calculation Preview (হিসাব পূর্বরূপ):</span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-jungle-teal-800 border-b border-azure-mist-200/60 pb-1.5">
                <span>Previous Due (পূর্বের বাকি):</span>
                <span className="font-bold">৳ {(currentDuePaisa / 100).toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono border-b border-azure-mist-200/60 pb-1.5">
                <span className={type === 'add' ? 'text-amber-800 font-semibold' : 'text-muted-teal-800 font-semibold'}>
                  {type === 'add' ? '(+) Added Amount (নতুন যোগ):' : '(-) Deducted Amount (কমানো):'}
                </span>
                <span className={`font-bold ${type === 'add' ? 'text-amber-800' : 'text-muted-teal-800'}`}>
                  {type === 'add' ? '+' : '-'} ৳ {(amountPaisa / 100).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm font-mono pt-1">
                <span className="font-bold text-jungle-teal-900">New Total Due (নতুন মোট বাকি):</span>
                <span className="font-extrabold text-base text-amber-800">
                  ৳ {(newDuePaisa / 100).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-jungle-teal-800 font-semibold mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-jungle-teal-600" />
                <span>Effective Date (তারিখ):</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono text-xs focus:outline-hidden focus:border-azure-mist-600"
              />
            </div>

            {/* Reason / Note */}
            <div>
              <label className="block text-jungle-teal-800 font-semibold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-jungle-teal-600" />
                <span>Reason / Note (বাকি সমন্বয় কারণ বা নোট) *</span>
              </label>
              <input
                type="text"
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. পুরোনো খাতার বকেয়া হিসাব যোগ করা হলো"
                className="w-full bg-white border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 text-xs focus:outline-hidden focus:border-azure-mist-600"
              />
              {/* Quick chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {quickNotes.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setNote(chip)}
                    className={`text-[10px] px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                      note === chip
                        ? 'bg-azure-mist-700 text-white border-azure-mist-800 font-semibold'
                        : 'bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 border-jungle-teal-200'
                    }`}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Direct Auto-print toggle */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoPrintCheckbox"
                checked={autoPrint}
                onChange={(e) => setAutoPrint(e.target.checked)}
                className="rounded border-jungle-teal-300 text-azure-mist-700 focus:ring-azure-mist-500 w-4 h-4 cursor-pointer"
              />
              <label htmlFor="autoPrintCheckbox" className="text-xs text-jungle-teal-700 font-medium cursor-pointer">
                সমন্বয় সম্পন্ন হওয়ার সাথে সাথে রসিদ প্রিন্ট প্রিভিউ ওপেন করুন
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-jungle-teal-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold transition-colors"
              >
                Cancel (বাতিল)
              </button>
              <button
                type="submit"
                disabled={loading || amountPaisa <= 0}
                className="px-5 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? 'Saving...' : 'Confirm Adjustment (সমন্বয় সম্পন্ন করুন)'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* 2. Success & Printable Slip Confirmation View (Just like POS Bill) */
          <div className="space-y-4 text-xs font-sans">
            <div className="p-4 bg-white border border-jungle-teal-200 rounded-2xl space-y-3 text-jungle-teal-900 shadow-xs">
              <div className="text-center border-b border-jungle-teal-200 pb-3">
                <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto mb-1.5 animate-in zoom-in" />
                <h4 className="font-extrabold text-sm text-jungle-teal-950">
                  {type === 'add' ? 'Due Addition Receipt' : 'Due Deduction Receipt'}
                </h4>
                <p className="text-[11px] text-jungle-teal-600 font-medium">
                  {type === 'add' ? 'বাকি বৃদ্ধি রশিদ' : 'বাকি হ্রাস / সমন্বয় রশিদ'}
                </p>
                <p className="text-[10px] text-jungle-teal-500 font-mono mt-0.5">
                  Ref: ADJ-{receiptData.id.slice(0, 8).toUpperCase()}
                </p>
              </div>

              <div className="space-y-1.5 text-xs font-mono pt-1">
                <div className="flex justify-between font-sans">
                  <span className="text-jungle-teal-600">Customer (গ্রাহক):</span>
                  <span className="font-bold text-jungle-teal-950">{customer.name}</span>
                </div>
                {customer.phone && (
                  <div className="flex justify-between font-sans">
                    <span className="text-jungle-teal-600">Phone (ফোন):</span>
                    <span className="font-mono">{customer.phone}</span>
                  </div>
                )}
                <div className="flex justify-between font-sans">
                  <span className="text-jungle-teal-600">Date (তারিখ):</span>
                  <span>{date || new Date().toISOString().split('T')[0]}</span>
                </div>
                <div className="flex justify-between font-sans">
                  <span className="text-jungle-teal-600">Type (ধরন):</span>
                  <span className={`font-bold ${type === 'add' ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {type === 'add' ? '(+) Added Due / বাকি বৃদ্ধি' : '(-) Deducted Due / বাকি হ্রাস'}
                  </span>
                </div>

                <div className="divider border-t border-jungle-teal-100 my-1.5"></div>

                <div className="flex justify-between font-sans">
                  <span className="text-jungle-teal-600">Previous Due (পূর্বের বাকি):</span>
                  <span className="font-mono">৳ {(receiptData.previous_due_paisa / 100).toFixed(2)}</span>
                </div>

                <div className="flex justify-between font-sans text-sm font-bold">
                  <span className={type === 'add' ? 'text-amber-800' : 'text-emerald-700'}>
                    {type === 'add' ? '(+) Added Amount (যোগকৃত):' : '(-) Deducted Amount (কমানো):'}
                  </span>
                  <span className={`font-mono ${type === 'add' ? 'text-amber-800' : 'text-emerald-700'}`}>
                    {type === 'add' ? '+' : '-'} ৳ {(Math.abs(receiptData.adjustment_paisa) / 100).toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between font-sans p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl mt-1.5">
                  <span className="font-bold text-jungle-teal-950">New Total Due (বর্তমান মোট বাকি):</span>
                  <span className="font-mono font-extrabold text-base text-amber-900">
                    ৳ {(receiptData.new_due_paisa / 100).toFixed(2)}
                  </span>
                </div>

                {note && (
                  <div className="p-2 bg-jungle-teal-50 border border-jungle-teal-200 rounded-lg text-[11px] text-jungle-teal-800 font-sans mt-2">
                    <span className="font-semibold text-jungle-teal-900">Note:</span> {note}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-jungle-teal-200">
              <button
                type="button"
                onClick={() => {
                  onSuccess(receiptData);
                  onClose();
                }}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold text-xs transition-colors"
              >
                Close (সম্পন্ন)
              </button>

              <button
                type="button"
                onClick={() => handlePrintSlip(receiptData)}
                className="px-5 py-2.5 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt (রশিদ প্রিন্ট)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
