import React, { useMemo, useState } from 'react';
import { Category, Product } from '../../types/ipc';
import {
  Layers,
  Search,
  Plus,
  AlertCircle,
  Package,
  CornerDownRight,
  Pencil,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { CategoryFormModal, CategoryFormMode } from './CategoryFormModal';
import { buildCategoryTree, topLevelCategories } from '../../utils/categoryTree';

interface CategoriesViewProps {
  categories: Category[];
  products: Product[];
  onAddCategory: (name: string, parentId?: string | null) => Promise<Category | null>;
  onUpdateCategory: (id: string, name: string, parentId?: string | null) => Promise<boolean>;
  onDeleteCategory: (id: string) => Promise<boolean>;
  onOpenProducts: (categoryId: string) => void;
}

interface Stat {
  count: number;
  stock: number;
  low: number;
  value: number;
}

const EMPTY: Stat = { count: 0, stock: 0, low: 0, value: 0 };

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  products,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onOpenProducts,
}) => {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<CategoryFormMode | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const byCat: Record<string, Stat> = {};
    for (const p of products) {
      const key = p.category_id || '';
      const s = byCat[key] || (byCat[key] = { ...EMPTY });
      s.count += 1;
      s.stock += p.stock_qty;
      if (p.stock_qty <= (p.low_stock_threshold ?? 5)) s.low += 1;
      s.value += p.stock_qty * p.sell_price_paisa;
    }
    return byCat;
  }, [products]);

  // Products still holding stock, per category — this is what blocks deletion.
  const inStockCount = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const p of products) {
      if (p.stock_qty > 0) byCat[p.category_id || ''] = (byCat[p.category_id || ''] || 0) + 1;
    }
    return byCat;
  }, [products]);

  const parents = useMemo(() => topLevelCategories(categories), [categories]);
  const q = query.trim().toLowerCase();
  const tree = useMemo(
    () => buildCategoryTree(q ? categories.filter((c) => c.name.toLowerCase().includes(q)) : categories),
    [categories, q]
  );

  const uncategorised = stats['']?.count || 0;
  const statFor = (id?: string): Stat => (id && stats[id]) || EMPTY;

  const rollUp = (node: ReturnType<typeof buildCategoryTree>[number]): Stat =>
    [node.parent.id, ...node.children.map((c) => c.id)].reduce<Stat>(
      (acc, id) => {
        const s = statFor(id);
        return {
          count: acc.count + s.count,
          stock: acc.stock + s.stock,
          low: acc.low + s.low,
          value: acc.value + s.value,
        };
      },
      { ...EMPTY }
    );

  const openEdit = (c: Category) => {
    const parent = c.parent_id ? categories.find((p) => p.id === c.parent_id) : null;
    setModal({
      kind: 'edit',
      id: c.id,
      currentName: c.name,
      parentId: parent?.id ?? null,
      parentName: parent?.name ?? null,
    });
  };

  const handleSubmit = async (leaf: string) => {
    if (!modal) return;
    setBusy(true);
    try {
      if (modal.kind === 'edit') {
        if (leaf === modal.currentName) {
          setModal(null);
          return;
        }
        await onUpdateCategory(modal.id, leaf, modal.parentId);
        toast.success(`Renamed to “${leaf}”.`);
      } else {
        const parentId = modal.kind === 'child' ? modal.parentId : null;
        const parentName = modal.kind === 'child' ? modal.parentName : null;
        // The main process enforces this per parent; checking here keeps the
        // message immediate rather than arriving as a thrown error.
        const clash = categories.some(
          (c) => (c.parent_id || null) === parentId && c.name.toLowerCase() === leaf.toLowerCase()
        );
        if (clash) {
          toast.warning(parentName ? `“${leaf}” already exists under ${parentName}.` : `“${leaf}” already exists.`);
          return;
        }
        const created = await onAddCategory(leaf, parentId);
        if (!created) {
          toast.error('Could not add that category.');
          return;
        }
        toast.success(parentName ? `Added “${leaf}” under ${parentName}.` : `Group “${leaf}” added.`);
      }
      setModal(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save that category.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!modal || modal.kind !== 'edit') return;
    setBusy(true);
    try {
      await onDeleteCategory(modal.id);
      toast.success(`“${modal.currentName}” deleted.`);
      setModal(null);
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete that category.');
    } finally {
      setBusy(false);
    }
  };

  const chip = (s: Stat) => (
    <span
      className={`shrink-0 font-mono text-ui-2xs font-semibold rounded px-1.5 py-px border ${
        s.count === 0
          ? 'bg-jungle-teal-100 text-jungle-teal-500 border-jungle-teal-200'
          : 'bg-muted-teal-50 text-muted-teal-800 border-muted-teal-200'
      }`}
    >
      {s.count}
    </span>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4 text-jungle-teal-900 pb-2">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-4 shadow-xs">
        <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shrink-0">
          <Layers className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-ui-lg font-semibold">Categories</h2>
          <p className="text-ui-xs text-jungle-teal-600">
            {parents.length} groups · {categories.length} in total · {products.length} products
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: 'group' })}
          className="ml-auto h-[40px] px-4 bg-azure-mist-700 hover:bg-azure-mist-800 text-white font-medium rounded-xl text-ui-sm flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New group</span>
        </button>
      </div>

      {/* Filter */}
      <div className="relative">
        <Search className="w-4 h-4 text-jungle-teal-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter categories…"
          className="w-full h-[40px] pl-9 pr-3 bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl text-ui-sm placeholder:text-jungle-teal-500 focus:outline-hidden focus:border-azure-mist-600"
        />
      </div>

      {uncategorised > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl px-3.5 py-2.5 text-ui-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            <strong className="font-semibold">{uncategorised}</strong> products have no category — they
            only appear under “All products” on the till.
          </span>
        </div>
      )}

      {/* Groups */}
      <div className="grid grid-cols-1 min-[1150px]:grid-cols-2 gap-3 items-start">
        {tree.map((node) => {
          const total = rollUp(node);
          return (
            <div
              key={node.parentName}
              className="bg-white border border-jungle-teal-200 rounded-2xl shadow-xs overflow-hidden group/card"
            >
              {/* Parent */}
              <div className="px-3.5 py-3 border-b border-jungle-teal-200 bg-jungle-teal-100">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProducts(node.parent.id)}
                    className="flex-1 min-w-0 text-left text-ui-base font-semibold leading-tight break-words hover:text-azure-mist-800 transition-colors disabled:hover:text-jungle-teal-900"
                  >
                    {node.parentName}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(node.parent)}
                    title={`Edit ${node.parentName}`}
                    className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-jungle-teal-400 opacity-0 group-hover/card:opacity-100 hover:text-azure-mist-800 transition-opacity"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  {chip(total)}
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-ui-2xs font-mono text-jungle-teal-600">
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3 text-jungle-teal-400" />
                    {total.stock} in stock
                  </span>
                  {total.low > 0 && <span className="text-amber-800 font-semibold">{total.low} low</span>}
                  {node.children.length > 0 && (
                    <span className="text-jungle-teal-500">
                      {node.children.length} subcategor{node.children.length === 1 ? 'y' : 'ies'}
                    </span>
                  )}
                  <span className="ml-auto text-jungle-teal-900 font-semibold">
                    ৳ {(total.value / 100).toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Children */}
              {/* Children hang off a rule rather than sitting at the parent's own
                  indent, where a single small arrow was all that told them apart. */}
              {node.children.length > 0 && (
                <div className="bg-white pl-5 pr-1 py-1">
                  <div className="border-l-2 border-jungle-teal-200 divide-y divide-jungle-teal-100">
                  {node.children.map((category) => {
                    const leafName = category.name;
                    const s = statFor(category.id);
                    return (
                      <div
                        key={category.id}
                        className="pl-3 pr-2.5 py-2 flex items-center gap-2 hover:bg-azure-mist-50/60 transition-colors group/row"
                      >
                        <CornerDownRight className="w-3 h-3 text-jungle-teal-300 shrink-0" />
                        <button
                          type="button"
                          onClick={() => onOpenProducts(category.id)}
                          className="flex-1 min-w-0 text-left text-ui-sm truncate hover:text-azure-mist-800 transition-colors"
                        >
                          {leafName}
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(category)}
                          title={`Edit ${leafName}`}
                          className="shrink-0 w-6 h-6 rounded flex items-center justify-center text-jungle-teal-400 opacity-0 group-hover/row:opacity-100 hover:text-azure-mist-800 transition-opacity"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        {s.low > 0 && (
                          <span className="shrink-0 font-mono text-ui-2xs font-semibold text-amber-800">
                            {s.low} low
                          </span>
                        )}
                        <span className="shrink-0 font-mono text-ui-2xs text-jungle-teal-600">
                          {s.stock} in stock
                        </span>
                        {chip(s)}
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setModal({ kind: 'child', parentId: node.parent.id, parentName: node.parentName })}
                className="w-full px-3.5 py-2 border-t border-jungle-teal-100 flex items-center gap-1.5 text-ui-xs font-medium text-jungle-teal-600 hover:text-azure-mist-800 hover:bg-azure-mist-50/50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add subcategory</span>
              </button>
            </div>
          );
        })}
      </div>

      {tree.length === 0 && (
        <div className="text-center py-12 text-ui-sm text-jungle-teal-500">
          {q ? 'No category matches that filter.' : 'No categories yet — add a group above.'}
        </div>
      )}

      <p className="text-ui-2xs text-jungle-teal-500 pt-1 leading-relaxed">
        Subcategories are stored as “Parent — Child” names, because the categories table has no parent
        column. Renaming a group does not rename its subcategories.
      </p>

      {modal && (
        <CategoryFormModal
          mode={modal}
          busy={busy}
          productCount={modal.kind === 'edit' ? statFor(modal.id).count : 0}
          stockCount={modal.kind === 'edit' ? inStockCount[modal.id] || 0 : 0}
          onSubmit={handleSubmit}
          onDelete={modal.kind === 'edit' ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
};
