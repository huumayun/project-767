import React, { useEffect, useRef, useState } from 'react';
import { Layers, X, Check, CornerDownRight, Trash2, AlertCircle } from 'lucide-react';
import { SEPARATOR } from '../../utils/categoryTree';

export type CategoryFormMode =
  | { kind: 'group' }
  | { kind: 'child'; parentId: string; parentName: string }
  | {
      kind: 'edit';
      id: string;
      currentName: string;
      /** The parent it sits under, or null at the top level. */
      parentId: string | null;
      parentName: string | null;
    };

interface CategoryFormModalProps {
  mode: CategoryFormMode;
  /** Products filed directly under the category being edited. */
  productCount?: number;
  /** How many of those still hold stock — deletion is refused while > 0. */
  stockCount?: number;
  busy?: boolean;
  onSubmit: (leafName: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  mode,
  productCount = 0,
  stockCount = 0,
  busy = false,
  onSubmit,
  onDelete,
  onClose,
}) => {
  // The stored name is the leaf now; the parent is a column, not a prefix.
  const [name, setName] = useState(mode.kind === 'edit' ? mode.currentName : '');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const parentName =
    mode.kind === 'child' ? mode.parentName : mode.kind === 'edit' ? mode.parentName : null;

  const title =
    mode.kind === 'group'
      ? 'New category group'
      : mode.kind === 'child'
      ? 'New subcategory'
      : 'Edit category';

  const trimmed = name.trim();
  const preview = parentName ? `${parentName}${SEPARATOR}${trimmed}` : trimmed;
  const hasDash = trimmed.includes('—');
  const canSave = trimmed.length > 0 && !hasDash && !busy;
  const blocked = stockCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl w-full max-w-md shadow-2xl text-jungle-teal-900 font-sans overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-jungle-teal-200">
          <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-ui-lg font-semibold">{title}</h3>
            {parentName && (
              <p className="text-ui-xs text-jungle-teal-600 flex items-center gap-1 truncate">
                <CornerDownRight className="w-3 h-3 shrink-0" />
                under {parentName}
              </p>
            )}
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSubmit(trimmed);
          }}
          className="px-5 py-4 space-y-3"
        >
          <label className="block">
            <span className="text-ui-2xs font-semibold uppercase tracking-wider text-jungle-teal-600">
              {mode.kind === 'group' ? 'Group name' : 'Name'}
            </span>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && onClose()}
              placeholder={mode.kind === 'group' ? 'e.g. Brake System' : 'e.g. Brake Pads'}
              className="mt-1 w-full h-11 px-3 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl text-ui-base placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
            />
          </label>

          {hasDash && (
            <p className="text-ui-xs text-amber-800 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Leave the dash out — the parent is added for you.
            </p>
          )}

          {parentName && trimmed && !hasDash && (
            <p className="font-mono text-ui-2xs text-jungle-teal-500">saves as “{preview}”</p>
          )}

          {mode.kind === 'edit' && productCount > 0 && (
            <p className="text-ui-xs text-jungle-teal-600">
              {productCount} product{productCount === 1 ? '' : 's'} filed here
              {stockCount > 0 ? `, ${stockCount} still in stock` : ', none in stock'}.
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            {mode.kind === 'edit' && onDelete && !confirmingDelete && (
              <button
                type="button"
                disabled={blocked || busy}
                onClick={() => setConfirmingDelete(true)}
                title={
                  blocked
                    ? `Cannot delete: ${stockCount} product${stockCount === 1 ? '' : 's'} still in stock`
                    : 'Delete this category'
                }
                className="h-[40px] px-3 rounded-xl flex items-center gap-1.5 text-ui-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}

            {mode.kind === 'edit' && onDelete && confirmingDelete && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  className="h-[40px] px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-ui-sm font-medium transition-colors disabled:opacity-40"
                >
                  Confirm delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="h-[40px] px-2.5 rounded-xl text-ui-sm text-jungle-teal-600 hover:bg-jungle-teal-100 transition-colors"
                >
                  Keep
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="ml-auto h-[40px] px-4 rounded-xl text-ui-sm font-medium text-jungle-teal-700 hover:bg-jungle-teal-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="h-[40px] px-4 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-medium rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors disabled:opacity-40"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{busy ? 'Saving…' : mode.kind === 'edit' ? 'Save' : 'Add'}</span>
            </button>
          </div>

          {blocked && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-3 py-2 text-ui-xs">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>
                This category holds stock, so it cannot be deleted. Sell or move those{' '}
                {stockCount} product{stockCount === 1 ? '' : 's'} first — otherwise the stock would
                still exist with no way to browse to it.
              </span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
