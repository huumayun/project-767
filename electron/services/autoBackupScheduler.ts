import { createDatabaseBackup, listBackups } from './backupManager';
import { getDb } from '../db';

export const AUTO_BACKUP_INTERVAL_HOURS = 12;
const AUTO_BACKUP_THRESHOLD_MS = AUTO_BACKUP_INTERVAL_HOURS * 60 * 60 * 1000; // 12 hours
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // Check every 10 minutes

let schedulerTimer: NodeJS.Timeout | null = null;
let isBackupRunning = false;

export function getLastBackupTimestamp(): { timestamp: number; iso: string | null } {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'last_gdrive_backup_at'").get() as { value?: string } | undefined;
    let latestTime = 0;
    let latestIso: string | null = null;

    if (row?.value) {
      const t = new Date(row.value).getTime();
      if (!isNaN(t) && t > latestTime) {
        latestTime = t;
        latestIso = row.value;
      }
    }

    const backups = listBackups();
    if (backups.length > 0 && backups[0].createdAt) {
      const t = new Date(backups[0].createdAt).getTime();
      if (!isNaN(t) && t > latestTime) {
        latestTime = t;
        latestIso = backups[0].createdAt;
      }
    }

    return { timestamp: latestTime, iso: latestIso };
  } catch (err) {
    console.warn('Error reading last backup timestamp:', err);
    return { timestamp: 0, iso: null };
  }
}

export async function checkAndRunAutoBackup(): Promise<{ executed: boolean; reason?: string }> {
  if (isBackupRunning) {
    return { executed: false, reason: 'Backup already in progress' };
  }

  const { timestamp, iso } = getLastBackupTimestamp();
  const now = Date.now();
  const elapsed = now - timestamp;

  // If no backup has ever occurred (timestamp === 0) or elapsed >= 12 hours
  if (timestamp === 0 || elapsed >= AUTO_BACKUP_THRESHOLD_MS) {
    isBackupRunning = true;
    try {
      const hoursAgo = timestamp > 0 ? (elapsed / (3600 * 1000)).toFixed(1) : 'never';
      console.log(`[AutoBackup] Triggering automated 12-hour backup. Last backup: ${iso || 'none'} (${hoursAgo} hours ago).`);
      createDatabaseBackup(undefined, true);
      return { executed: true };
    } catch (err) {
      console.error('[AutoBackup] Automated backup failed:', err);
      return { executed: false, reason: String(err) };
    } finally {
      isBackupRunning = false;
    }
  }

  return { executed: false, reason: `Last backup was ${(elapsed / (3600 * 1000)).toFixed(1)} hours ago` };
}

export function startAutoBackupScheduler() {
  if (schedulerTimer) return;

  // Run initial check 10 seconds after app startup
  setTimeout(() => {
    checkAndRunAutoBackup().catch((err) => console.error('[AutoBackup] Initial startup check failed:', err));
  }, 10000);

  // Periodic check every 10 minutes
  schedulerTimer = setInterval(() => {
    checkAndRunAutoBackup().catch((err) => console.error('[AutoBackup] Scheduled check failed:', err));
  }, CHECK_INTERVAL_MS);

  console.log('[AutoBackup] 12-hour auto-backup scheduler active (checks every 10 min).');
}

export function stopAutoBackupScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
