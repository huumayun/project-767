import React, { useMemo, useState } from 'react';
import { Category } from '../../types/ipc';
import { Plus, Check, X, CornerDownRight } from 'lucide-react';
import {
  buildCategoryTree,
  splitCategoryName,
  composeCategoryName,
  SEPARATOR,
} from '../../utils/categoryTree';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  onAddCategory: (name: string) => Promise<Category | null>;
}

/**
 * Group first, then subcategory.
 *
 * A single flat <select> meant scrolling 60 entries whose names all begin with
 * the same prefix. Picking the group narrows the second list to a handful.
 */
export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  categories,
  value,
  onChange,
  onAddCategory,
}) => {
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const selected = categories.find((c) => c.id === value) || null;
  const selectedGroup = selected ? splitCategoryName(selected.name).parent ?? splitCategoryName(selected.name).leaf : '';

  const [group, setGroup] = useState(selectedGroup);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const node = tree.find((n) => n.parentName === group) || null;

  const pickGroup = (name: string) => {
    setGroup(name);
    setAdding(false);
    if (!name) {
      onChange('');
      return;
    }
    // Land on the group itself when it exists, so a product can be filed
    // directly under it without touching the second dropdown.
    const n = tree.find((t) => t.parentName === name);
    onChange(n?.self?.id || '');
  };

  const handleCreate = async () => {
    const leaf = newName.trim();
    if (!leaf) return;
    setSaving(true);
    const created = await onAddCategory(composeCategoryName(group || null, leaf));
    setSaving(false);
    if (created) {
      if (!group) setGroup(leaf);
      onChange(created.id);
      setNewName('');
      setAdding(false);
    }
  };

  const selectClass =
    'w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 h-[40px] text-ui-sm text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 disabled:opacity-50';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="block text-jungle-teal-700 font-semibold">Category</label>
        <button
          type="button"
          onClick={() => {
            setAdding((a) => !a);
            setNewName('');
          }}
          className="text-ui-2xs text-azure-mist-800 hover:underline flex items-center gap-0.5 font-semibold"
        >
          <Plus className="w-3 h-3" /> {group ? `New under ${group}` : 'New group'}
        </button>
      </div>

      {adding ? (
        <div className="flex items-center gap-1.5">
          {group && <CornerDownRight className="w-3.5 h-3.5 text-jungle-teal-400 shrink-0" />}
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreate();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setAdding(false);
              }
            }}
            placeholder={group ? 'Subcategory name' : 'New group name'}
            className="flex-1 min-w-0 bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-2.5 h-[40px] text-ui-sm text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving || !newName.trim()}
            title="Save"
            className="w-10 h-[40px] shrink-0 rounded-xl bg-azure-mist-700 hover:bg-azure-mist-800 text-white flex items-center justify-center transition-colors disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            title="Cancel"
            className="w-10 h-[40px] shrink-0 rounded-xl text-jungle-teal-500 hover:bg-jungle-teal-100 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <select value={group} onChange={(e) => pickGroup(e.target.value)} className={selectClass}>
            <option value="">— No category —</option>
            {tree.map((n) => (
              <option key={n.parentName} value={n.parentName}>
                {n.parentName}
              </option>
            ))}
          </select>

          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={!node}
            title={node ? undefined : 'Pick a group first'}
            className={selectClass}
          >
            {!node && <option value="">—</option>}
            {node?.self && <option value={node.self.id}>Directly in {node.parentName}</option>}
            {node && !node.self && <option value="">Pick a subcategory</option>}
            {node?.children.map((c) => (
              <option key={c.category.id} value={c.category.id}>
                {c.leafName}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected && (
        <p className="mt-1 font-mono text-ui-2xs text-jungle-teal-500 truncate">
          filed as “{selected.name}”
        </p>
      )}
      {!selected && group && (
        <p className="mt-1 text-ui-2xs text-amber-800">
          Pick a subcategory, or add one under {group}
          {SEPARATOR ? '' : ''}.
        </p>
      )}
    </div>
  );
};
