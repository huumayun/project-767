import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getDb } from '../db';
import { logAudit } from '../ipc/shared';

export interface BackupFileInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  isAutomatic: boolean;
}

export function getBackupsDirectory(): string {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'local_backup_path'").get() as any;
    if (row && row.value) {
      const customPath = row.value;
      if (!fs.existsSync(customPath)) {
        fs.mkdirSync(customPath, { recursive: true });
      }
      return customPath;
    }
  } catch (e) {
    // If DB is not available yet, fallback
  }

  const userData = app.getPath('userData');
  const backupDir = path.join(userData, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Creates an atomic, online SQLite backup using the VACUUM INTO command.
 */
export function createDatabaseBackup(targetFilePath?: string, isAuto: boolean = false): BackupFileInfo {
  const db = getDb();
  const backupDir = getBackupsDirectory();
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
  const finalPath = targetFilePath || path.join(backupDir, `shop-backup-${dateStr}-${timeStr}${isAuto ? '-auto' : ''}.db`);

  if (fs.existsSync(finalPath)) {
    fs.unlinkSync(finalPath);
  }

  // SQLite atomic VACUUM INTO
  db.prepare('VACUUM INTO ?').run(finalPath);

  const stats = fs.statSync(finalPath);
  logAudit(isAuto ? 'AUTO_BACKUP_CREATED' : 'MANUAL_BACKUP_CREATED', 'backups', undefined, {
    path: finalPath,
    sizeBytes: stats.size,
  });

  if (isAuto) {
    cleanOldBackups(14);
  }

  // Trigger Google Drive upload asynchronously for BOTH auto and manual backups
  import('./googleDrive').then((gdrive) => {
    if (gdrive.isDriveConnected()) {
      gdrive.uploadToDrive(finalPath).catch(err => console.error('GDrive Upload error:', err));
    }
  }).catch(err => console.error('Failed to load Google Drive service', err));

  return {
    fileName: path.basename(finalPath),
    filePath: finalPath,
    sizeBytes: stats.size,
    createdAt: new Date().toISOString(),
    isAutomatic: isAuto,
  };
}

/**
 * Keeps only the last `retentionDays` automated backups and removes older files.
 */
export function cleanOldBackups(retentionDays: number = 14) {
  try {
    const backupDir = getBackupsDirectory();
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.endsWith('.db')) continue;
      const fullPath = path.join(backupDir, file);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        console.log(`Pruned old backup file: ${file}`);
      }
    }
  } catch (err) {
    console.error('Failed to prune old backups:', err);
  }
}

/**
 * Lists all available backup files in the userData/backups directory.
 */
export function listBackups(): BackupFileInfo[] {
  const backupDir = getBackupsDirectory();
  if (!fs.existsSync(backupDir)) return [];

  const files = fs.readdirSync(backupDir);
  const results: BackupFileInfo[] = [];

  for (const file of files) {
    if (!file.endsWith('.db')) continue;
    const fullPath = path.join(backupDir, file);
    try {
      const stat = fs.statSync(fullPath);
      results.push({
        fileName: file,
        filePath: fullPath,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        isAutomatic: file.includes('-auto'),
      });
    } catch {
      // skip unreadable
    }
  }

  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Restores database from a verified backup file after creating a pre-restore safety snapshot.
 */
export function restoreDatabase(backupFilePath: string): boolean {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file not found at: ${backupFilePath}`);
  }

  // 1. Create a safety snapshot of current DB before replacing
  const backupDir = getBackupsDirectory();
  const preRestorePath = path.join(backupDir, `pre-restore-snapshot-${Date.now()}.db`);
  try {
    createDatabaseBackup(preRestorePath, false);
  } catch (err) {
    console.warn('Pre-restore snapshot warning:', err);
  }

  const db = getDb();
  // Close existing WAL & connections
  db.close();

  const currentDbPath = path.join(app.getPath('userData'), 'shop.db');
  fs.copyFileSync(backupFilePath, currentDbPath);

  logAudit('RESTORE_DATABASE', 'backups', undefined, {
    restoredFrom: backupFilePath,
    preRestoreSnapshot: preRestorePath,
  });

  return true;
}
