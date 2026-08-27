import React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = 'Confirmation Required',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDanger = false,
  onConfirm,
  onCancel,
}) => {
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 animate-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl shrink-0 ${isDanger ? 'bg-rose-100 text-rose-600 border border-rose-200' : 'bg-azure-mist-100 text-azure-mist-700 border border-azure-mist-200'
              }`}
          >
            {isDanger ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-jungle-teal-900 mb-1.5">{title}</h3>
            <p className="text-xs text-jungle-teal-600 leading-relaxed">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-4 border-t border-jungle-teal-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-jungle-teal-700 bg-jungle-teal-100 hover:bg-jungle-teal-200 rounded-xl transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-all ${isDanger
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-azure-mist-700 hover:bg-azure-mist-800 shadow-azure-mist-700/20'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
