import React, { useMemo, useState } from 'react';
import { Category } from '../../types/ipc';
import { Plus, Check, X, CornerDownRight } from 'lucide-react';
import { buildCategoryTree } from '../../utils/categoryTree';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (categoryId: string) => void;
  onAddCategory: (name: string, parentId?: string | null) => Promise<Category | null>;
}

/**
 * Group first, then subcategory.
 *
 * A single flat <select> meant scrolling 60 entries whose names all began with
 * the same prefix. Picking the group narrows the second list to a handful.
 *
 * Keyed on the parent's id rather than its name: the parent is a column now, so
 * renaming a group no longer detaches the products filed beneath it.
 */
export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  categories,
  value,
  onChange,
  onAddCategory,
}) => {
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);

  const selected = categories.find((c) => c.id === value) || null;
  const selectedGroupId = selected ? selected.parent_id || selected.id : '';

  const [groupId, setGroupId] = useState(selectedGroupId);

  // Follow the value when it changes from outside — the product form fills it
  // in after loading.
  React.useEffect(() => {
    if (selectedGroupId) setGroupId(selectedGroupId);
    else if (!value) setGroupId('');
  }, [value, selectedGroupId]);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const node = tree.find((n) => n.parent.id === groupId) || null;

  const pickGroup = (id: string) => {
    setGroupId(id);
    setAdding(false);
    // Land on the group itself, so a product can be filed directly under it
    // without touching the second dropdown.
    onChange(id);
  };

  const handleCreate = async () => {
    const leaf = newName.trim();
    if (!leaf) return;
    setSaving(true);
    const created = await onAddCategory(leaf, groupId || null);
    setSaving(false);
    if (created) {
      if (!groupId) setGroupId(created.id);
      onChange(created.id);
      setNewName('');
      setAdding(false);
    }
  };

  const selectClass =
    'w-full bg-white border border-jungle-teal-200 rounded-xl px-3 h-[40px] text-sm font-medium text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-500 focus:ring-1 focus:ring-azure-mist-500 shadow-2xs transition-all disabled:opacity-50 disabled:bg-jungle-teal-50 cursor-pointer';

  const groupName = node?.parentName || '';

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
          <Plus className="w-3 h-3" /> {groupName ? `New under ${groupName}` : 'New group'}
        </button>
      </div>

      {adding ? (
        <div className="flex items-center gap-1.5">
          {groupId && <CornerDownRight className="w-3.5 h-3.5 text-jungle-teal-400 shrink-0" />}
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
            placeholder={groupId ? 'Subcategory name' : 'New group name'}
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
          <select value={groupId} onChange={(e) => pickGroup(e.target.value)} className={selectClass}>
            <option value="">— No category —</option>
            {tree.map((n) => (
              <option key={n.parent.id} value={n.parent.id}>
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
            {node && <option value={node.parent.id}>Directly in {node.parentName}</option>}
            {node?.children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {selected && (
        <p className="mt-1 font-mono text-ui-2xs text-jungle-teal-500 truncate">
          filed as “{selected.parent_id && node ? `${node.parentName} · ${selected.name}` : selected.name}”
        </p>
      )}
    </div>
  );
};
