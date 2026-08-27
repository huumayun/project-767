import { getDb } from '../db';
import { decryptSecret } from './safeStore';
import { logAudit } from '../ipc/handlers';

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

export function getPendingChangesCount(): number {
  try {
    const db = getDb();
    let totalPending = 0;
    for (const table of SYNC_ORDER) {
      const stateRow = db.prepare('SELECT last_pushed_at FROM sync_state WHERE table_name = ?').get(table) as any;
      const lastPushed = stateRow?.last_pushed_at || '1970-01-01T00:00:00.000Z';
      const countRow = db.prepare(`SELECT COUNT(id) as cnt FROM ${table} WHERE updated_at > ?`).get(lastPushed) as any;
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
    for (const table of SYNC_ORDER) {
      const stateRow = db.prepare('SELECT last_pushed_at FROM sync_state WHERE table_name = ?').get(table) as any;
      const lastPushed = stateRow?.last_pushed_at || '1970-01-01T00:00:00.000Z';

      const unpushedRows = db.prepare(`SELECT * FROM ${table} WHERE updated_at > ? ORDER BY updated_at ASC LIMIT 100`).all(lastPushed) as any[];

      if (unpushedRows.length > 0) {
        // Prepare rows with shop_id
        const payload = unpushedRows.map((r) => ({
          ...r,
          shop_id: shopId || undefined,
        }));

        // Push to Supabase REST endpoint
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

          if (!res.ok && res.status !== 404 && res.status !== 401) {
            console.warn(`Supabase sync warning for ${table}: HTTP ${res.status}`);
          }
        } catch (fetchErr: any) {
          // Network offline / unreachable
          lastSyncError = fetchErr.message || 'Network unreachable';
        }

        // Record last_pushed_at locally
        const latestTime = unpushedRows[unpushedRows.length - 1].updated_at;
        db.prepare(`
          INSERT INTO sync_state (table_name, last_pushed_at) VALUES (?, ?)
          ON CONFLICT(table_name) DO UPDATE SET last_pushed_at = excluded.last_pushed_at
        `).run(table, latestTime);
      }
    }

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
