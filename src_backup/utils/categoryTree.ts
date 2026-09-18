import { Category } from '../types/ipc';

/**
 * Two-level categories, built from `categories.parent_id`.
 *
 * This used to carry the parent in the name — "Batteries — Lead Acid" — because
 * the table had no parent column. That read correctly and did nothing else:
 * renaming a parent left its children stranded under the old prefix, a category
 * whose own name held the separator was mistaken for a child, and a global
 * UNIQUE(name) meant two parents could never share a child name.
 *
 * The column exists now. The separator is kept only for display, where a child
 * has to be shown with the parent it belongs to.
 */
export const SEPARATOR = ' — ';

export interface CategoryNode {
  /** The top-level category. */
  parent: Category;
  parentName: string;
  children: Category[];
}

/** Categories with no parent — the ones that can take children. */
export function topLevelCategories(categories: Category[]): Category[] {
  return categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Groups a flat list into parents with their children, alphabetically. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const byId = new Map(categories.map((c) => [c.id, c]));

  const nodes = new Map<string, CategoryNode>();
  for (const category of categories) {
    if (category.parent_id) continue;
    nodes.set(category.id, { parent: category, parentName: category.name, children: [] });
  }

  for (const category of categories) {
    if (!category.parent_id) continue;
    const node = nodes.get(category.parent_id);
    // A child whose parent is missing — deleted, or not in this list — would
    // otherwise vanish from the page while its products stayed on the shelf.
    if (node) {
      node.children.push(category);
    } else if (!byId.has(category.parent_id)) {
      nodes.set(category.id, { parent: category, parentName: category.name, children: [] });
    }
  }

  const out = [...nodes.values()];
  out.sort((a, b) => a.parentName.localeCompare(b.parentName));
  out.forEach((n) => n.children.sort((a, b) => a.name.localeCompare(b.name)));
  return out;
}

/** "Brake System — Brake Pads", for anywhere a child is shown out of context. */
export function categoryPath(category: Category, categories: Category[]): string {
  if (!category.parent_id) return category.name;
  const parent = categories.find((c) => c.id === category.parent_id);
  return parent ? `${parent.name}${SEPARATOR}${category.name}` : category.name;
}

/** Every category as a flat, sorted list of {id, label} for a dropdown. */
export function categoryOptions(categories: Category[]): Array<{ id: string; label: string; isChild: boolean }> {
  return buildCategoryTree(categories).flatMap((node) => [
    { id: node.parent.id, label: node.parentName, isChild: false },
    ...node.children.map((child) => ({ id: child.id, label: child.name, isChild: true })),
  ]);
}

/**
 * A category and everything filed beneath it.
 *
 * Picking a parent has to mean "and its children too". Stock is filed on the
 * leaf — a shop puts its oil filters under Filters › Oil Filters, never on
 * Filters itself — so matching `category_id` against the parent alone selects
 * the one category that is deliberately empty.
 */
export function categoryWithDescendantIds(categoryId: string, categories: Category[]): string[] {
  return [categoryId, ...categories.filter((c) => c.parent_id === categoryId).map((c) => c.id)];
}

/**
 * Products per category, counting a parent's children towards the parent.
 *
 * The direct count is kept alongside the rolled-up one: a child row shows what
 * it holds, while a parent row shows what selecting it would actually list.
 */
export function productCategoryCounts(
  products: Array<{ category_id?: string | null }>,
  categories: Category[]
): { direct: Record<string, number>; rollup: Record<string, number> } {
  const direct: Record<string, number> = {};
  for (const product of products) {
    const key = product.category_id || '';
    direct[key] = (direct[key] || 0) + 1;
  }

  const rollup: Record<string, number> = { ...direct };
  for (const category of categories) {
    if (!category.parent_id) continue;
    rollup[category.parent_id] = (rollup[category.parent_id] || 0) + (direct[category.id] || 0);
  }
  return { direct, rollup };
}
