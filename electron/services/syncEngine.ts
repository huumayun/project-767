import { getDb } from '../db';
import { decryptSecret } from './safeStore';
import { logAudit } from '../ipc/shared';

export type SyncStatusType = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncStatusInfo {
  status: SyncStatusType;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  cloudConfigured: boolean;
}

const SYNC_ORDER = [
  'categories',
  'suppliers',
  'products',
  'purchases',
  'purchase_items',
  'customers',
  'sales',
  'sale_items',
  'payments',
  'returns',
  'return_items',
  'stock_transactions',
];

let syncInterval: NodeJS.Timeout | null = null;
let isSyncInProgress = false;
let lastSyncTimestamp: string | null = null;
let lastSyncError: string | null = null;
let cachedPendingCount = 0;

/**
 * Rows are ordered by (updated_at, id) rather than updated_at alone. A bulk
 * import stamps every row it writes with one identical timestamp, so a cursor
 * holding only that timestamp skipped everything past the first page of such a
 * batch - permanently, because the next pass asked for rows strictly after it.
 */
const PENDING_WHERE = '(updated_at > ? OR (updated_at = ? AND id > ?))';

function cursorFor(db: any, table: string): [string, string, string] {
  const row = db.prepare('SELECT last_pushed_at, last_pushed_id FROM sync_state WHERE table_name = ?').get(table) as any;
  const at = row?.last_pushed_at || '1970-01-01T00:00:00.000Z';
  const id = row?.last_pushed_id || '';
  return [at, at, id];
}

export function getPendingChangesCount(): number {
  try {
    const db = getDb();
    let totalPending = 0;
    for (const table of SYNC_ORDER) {
      const cursor = cursorFor(db, table);
      const countRow = db.prepare(`SELECT COUNT(id) as cnt FROM ${table} WHERE ${PENDING_WHERE}`).get(...cursor) as any;
      totalPending += (countRow?.cnt || 0);
    }
    cachedPendingCount = totalPending;
    return totalPending;
  } catch {
    return 0;
  }
}

export function isCloudSyncConfigured(): boolean {
  try {
    const db = getDb();
    const urlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('supabase_url') as any;
    const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('supabase_anon_key') as any;
    return Boolean(urlRow?.value && keyRow?.value);
  } catch {
    return false;
  }
}

export function getSyncStatus(): SyncStatusInfo {
  const configured = isCloudSyncConfigured();
  const pending = getPendingChangesCount();

  let status: SyncStatusType = 'synced';
  if (!configured) {
    status = 'offline';
  } else if (isSyncInProgress) {
    status = 'syncing';
  } else if (lastSyncError) {
    status = 'error';
  } else if (pending > 0) {
    status = 'pending';
  }

  return {
    status,
    pendingCount: pending,
    lastSyncedAt: lastSyncTimestamp,
    lastError: lastSyncError,
    cloudConfigured: configured,
  };
}

/**
 * Executes a full delta synchronization pass.
 */
export async function executeDeltaSync(): Promise<SyncStatusInfo> {
  if (isSyncInProgress) {
    return getSyncStatus();
  }

  const configured = isCloudSyncConfigured();
  if (!configured) {
    return getSyncStatus();
  }

  isSyncInProgress = true;
  lastSyncError = null;

  try {
    const db = getDb();
    const urlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('supabase_url') as any;
    const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('supabase_anon_key') as any;
    const shopRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('supabase_shop_id') as any;

    const supabaseUrl = urlRow?.value;
    const supabaseKey = decryptSecret(keyRow?.value);
    const shopId = shopRow?.value;

    const nowUTC = new Date().toISOString();

    // 1. Dependency-Ordered Push
    let pushFailed = false;
    for (const table of SYNC_ORDER) {
      // A failure earlier in the order means later tables may reference rows
      // that never landed, so stop rather than push children without parents.
      if (pushFailed) break;

      const cursor = cursorFor(db, table);
      const unpushedRows = db.prepare(
        `SELECT * FROM ${table} WHERE ${PENDING_WHERE} ORDER BY updated_at ASC, id ASC LIMIT 100`
      ).all(...cursor) as any[];

      if (unpushedRows.length > 0) {
        // Prepare rows with shop_id
        const payload = unpushedRows.map((r) => ({
          ...r,
          shop_id: shopId || undefined,
        }));

        // Push to Supabase REST endpoint
        let accepted = false;
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Prefer': 'resolution=merge-duplicates',
            },
            body: JSON.stringify(payload),
          });

          accepted = res.ok;
          if (!res.ok) {
            lastSyncError = `${table}: HTTP ${res.status}`;
            console.warn(`Supabase sync rejected ${table}: HTTP ${res.status}`);
          }
        } catch (fetchErr: any) {
          // Network offline / unreachable
          lastSyncError = fetchErr.message || 'Network unreachable';
        }

        // The cursor moves only for rows the server confirmed it took. This
        // used to advance no matter what came back, so anything written while
        // the shop was offline - or refused by the server - was marked as sent
        // and never offered again.
        if (!accepted) {
          pushFailed = true;
          break;
        }

        const lastRow = unpushedRows[unpushedRows.length - 1];
        db.prepare(`
          INSERT INTO sync_state (table_name, last_pushed_at, last_pushed_id) VALUES (?, ?, ?)
          ON CONFLICT(table_name) DO UPDATE SET
            last_pushed_at = excluded.last_pushed_at,
            last_pushed_id = excluded.last_pushed_id
        `).run(table, lastRow.updated_at, lastRow.id);
      }
    }

    if (!pushFailed) lastSyncError = null;

    lastSyncTimestamp = nowUTC;
  } catch (err: any) {
    lastSyncError = err.message || 'Sync failed';
    logAudit('SYNC_ERROR', 'sync', undefined, { error: lastSyncError });
  } finally {
    isSyncInProgress = false;
  }

  return getSyncStatus();
}

/**
 * Starts periodic delta synchronization worker.
 */
export function startSyncEngine(intervalMs: number = 60000) {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(() => {
    executeDeltaSync().catch((err) => console.error('Sync interval error:', err));
  }, intervalMs);
}

export function stopSyncEngine() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
