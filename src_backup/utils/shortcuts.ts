/**
 * Keyboard shortcuts for the till.
 *
 * Stored in localStorage rather than the shop settings table: bindings are a
 * per-machine preference (the counter PC and the back-office PC can reasonably
 * differ), and the settings table lives behind IPC in the main process.
 */

export type ShortcutId =
  | 'focusSearch'
  | 'focusDiscount'
  | 'exactCash'
  | 'checkout'
  | 'holdCart'
  | 'clearCart'
  | 'toggleHints';

export interface ShortcutDef {
  id: ShortcutId;
  label: string;
  description: string;
  defaultBinding: string;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  {
    id: 'focusSearch',
    label: 'Scan / search',
    description: 'Jump to the barcode box and select what is in it',
    defaultBinding: 'F2',
  },
  {
    id: 'focusDiscount',
    label: 'Discount',
    description: 'Jump to the discount field on the bill',
    defaultBinding: 'F3',
  },
  {
    id: 'exactCash',
    label: 'Exact cash',
    description: 'Fill the payable amount into the cash field',
    defaultBinding: 'F4',
  },
  {
    id: 'checkout',
    label: 'Complete sale',
    description: 'Take payment and finish the bill',
    defaultBinding: 'F8',
  },
  {
    id: 'holdCart',
    label: 'Hold bill',
    description: 'Park the current bill to come back to',
    defaultBinding: 'F9',
  },
  {
    id: 'clearCart',
    label: 'Clear bill',
    description: 'Empty the current bill',
    defaultBinding: 'Escape',
  },
  {
    id: 'toggleHints',
    label: 'Show shortcut hints',
    description: 'Show or hide the key badges on the till',
    defaultBinding: 'F11',
  },
];

export type ShortcutMap = Record<ShortcutId, string>;

export const SHORTCUTS_CHANGED_EVENT = 'pos:shortcuts-changed';

const STORAGE_KEY = 'pos.shortcuts.v1';

export const defaultShortcuts = (): ShortcutMap =>
  SHORTCUT_DEFS.reduce((acc, d) => {
    acc[d.id] = d.defaultBinding;
    return acc;
  }, {} as ShortcutMap);

let cache: ShortcutMap | null = null;

export function getShortcuts(): ShortcutMap {
  if (cache) return cache;
  const merged = defaultShortcuts();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<ShortcutMap>;
      for (const d of SHORTCUT_DEFS) {
        const v = saved[d.id];
        if (typeof v === 'string' && v.length > 0) merged[d.id] = v;
      }
    }
  } catch {
    // Private mode, cleared storage, corrupt JSON — fall back to defaults.
  }
  cache = merged;
  return cache;
}

function persist(next: ShortcutMap) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not fatal: the bindings still apply for this session.
  }
  window.dispatchEvent(new CustomEvent(SHORTCUTS_CHANGED_EVENT));
}

export function setShortcut(id: ShortcutId, binding: string) {
  const next = { ...getShortcuts() };
  // A key can only drive one action, so steal it from whoever held it.
  for (const key of Object.keys(next) as ShortcutId[]) {
    if (key !== id && next[key].toLowerCase() === binding.toLowerCase()) {
      next[key] = '';
    }
  }
  next[id] = binding;
  persist(next);
}

export function clearShortcut(id: ShortcutId) {
  persist({ ...getShortcuts(), [id]: '' });
}

export function resetShortcuts() {
  cache = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new CustomEvent(SHORTCUTS_CHANGED_EVENT));
}

/**
 * Turn a keypress into a binding string, or null if it is not allowed.
 *
 * Plain letters and digits are rejected on purpose: the till listens to every
 * keystroke to assemble barcode-scanner input, so binding a bare character
 * would swallow scans. Function keys, Escape, and Ctrl/Alt combinations are
 * safe because a scanner never emits them.
 */
export function eventToBinding(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const key = e.key;
  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return null;

  const prefix =
    (e.ctrlKey ? 'Ctrl+' : '') + (e.altKey ? 'Alt+' : '') + (e.shiftKey ? 'Shift+' : '');

  if (/^F([1-9]|1[0-2])$/.test(key)) return prefix + key;
  if (key === 'Escape') return prefix + 'Escape';
  if ((e.ctrlKey || e.altKey) && key.length === 1) return prefix + key.toUpperCase();
  return null;
}

export function matchesBinding(e: KeyboardEvent, binding: string): boolean {
  if (!binding) return false;
  const pressed = eventToBinding(e);
  return pressed !== null && pressed.toLowerCase() === binding.toLowerCase();
}

/** Short label for a key badge — "Escape" is too wide for a chip. */
export function bindingLabel(binding: string): string {
  if (!binding) return '—';
  return binding.replace(/Escape/i, 'Esc');
}
