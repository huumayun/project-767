import { Category } from '../types/ipc';

/**
 * Subcategories without a schema change.
 *
 * `categories` is a flat table — {id, name}, no parent_id — so the parent is
 * carried in the name: "Batteries — Lead Acid". This module is the single place
 * that convention is understood, so if a parent_id column is ever added only
 * these functions need to change.
 *
 * Caveat worth knowing: it is a convention, not a constraint. Renaming a parent
 * does not move its children, and a category whose own name contains the
 * separator would be read as a child.
 */
export const SEPARATOR = ' — ';

export interface CategoryNode {
  parentName: string;
  /** The top-level category itself, when one exists with exactly that name. */
  self: Category | null;
  children: Array<{ category: Category; leafName: string }>;
}

/** "Batteries — Lead Acid" -> { parent: "Batteries", leaf: "Lead Acid" } */
export function splitCategoryName(name: string): { parent: string | null; leaf: string } {
  const i = name.indexOf(SEPARATOR);
  if (i === -1) return { parent: null, leaf: name };
  return {
    parent: name.slice(0, i).trim(),
    leaf: name.slice(i + SEPARATOR.length).trim(),
  };
}

/** Categories that are not children of anything — candidates to be a parent. */
export function topLevelCategories(categories: Category[]): Category[] {
  return categories
    .filter((c) => splitCategoryName(c.name).parent === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Groups a flat list into parents with their children, alphabetically. */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const groups = new Map<string, CategoryNode>();

  const nodeFor = (parentName: string): CategoryNode => {
    let n = groups.get(parentName);
    if (!n) {
      n = { parentName, self: null, children: [] };
      groups.set(parentName, n);
    }
    return n;
  };

  for (const c of categories) {
    const { parent, leaf } = splitCategoryName(c.name);
    if (parent === null) {
      nodeFor(leaf).self = c;
    } else {
      nodeFor(parent).children.push({ category: c, leafName: leaf });
    }
  }

  const out = [...groups.values()];
  out.sort((a, b) => a.parentName.localeCompare(b.parentName));
  out.forEach((n) => n.children.sort((a, b) => a.leafName.localeCompare(b.leafName)));
  return out;
}

/** Composes the stored name for a new category. */
export function composeCategoryName(parent: string | null, leaf: string): string {
  const l = leaf.trim();
  const p = (parent || '').trim();
  return p ? `${p}${SEPARATOR}${l}` : l;
}
