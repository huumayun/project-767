import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { runMigrations } from './migrations';
import bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'shop.db');

  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  console.log(`Connecting SQLite DB at: ${dbPath}`);
  dbInstance = new Database(dbPath);

  // Enable WAL mode and Foreign Keys
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  // A copy of what the last build left behind, taken before this one alters it.
  backupBeforeUpgrade(dbInstance, userDataPath);

  // Run schema migrations
  runMigrations(dbInstance);

  // Seed default settings and owner user if missing
  seedInitialDefaults(dbInstance);

  // Only after the schema is up to date - settings may not exist before it.
  recordAppVersion(dbInstance);

  return dbInstance;
}

/** Backups kept before an upgrade. Older ones past this are deleted. */
const KEEP_PRE_UPDATE_BACKUPS = 5;

/**
 * Copies the database before a new build touches its schema.
 *
 * Migrations run on the customer's machine, against data nobody here has seen.
 * They are written to be safe and they are tested, but a migration that goes
 * wrong on a real shop's database is unrecoverable without a copy taken
 * beforehand - and by the time anyone notices, the shop has already traded on
 * the damaged file.
 *
 * Keyed on the app version rather than on pending migration ids, because a
 * release also changes the schema through applyBaseSchema and reconcileColumns,
 * which keep no record of themselves. Any new version is treated as reason
 * enough; the same version opening the file again is not.
 *
 * VACUUM INTO rather than a file copy: it writes one consistent file with the
 * WAL already folded in. Copying shop.db alone leaves recent transactions
 * behind in shop.db-wal, so the backup silently loses the last work done.
 */
function backupBeforeUpgrade(db: Database.Database, userDataPath: string): void {
  let previousVersion: string | null = null;
  try {
    // A fresh install has no settings table yet, and nothing worth keeping.
    const hasSettings = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'")
      .get();
    if (!hasSettings) return;

    const row = db.prepare("SELECT value FROM settings WHERE key = 'last_app_version'").get() as
      | { value: string }
      | undefined;
    previousVersion = row?.value ?? null;
  } catch (err) {
    console.error('Could not read the recorded app version:', err);
    return;
  }

  const currentVersion = app.getVersion();
  if (previousVersion === currentVersion) return;

  // An empty database is not worth a backup - a first run, or one the owner
  // has just cleared.
  try {
    const anySale = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'").get();
    if (anySale) {
      const count = (db.prepare('SELECT COUNT(*) AS c FROM sales').get() as any).c as number;
      if (count === 0 && previousVersion === null) return;
    }
  } catch {
    /* If that cannot be answered, err towards taking the backup. */
  }

  const backupDir = path.join(userDataPath, 'backups');
  try {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const from = previousVersion ?? 'unknown';
    const target = path.join(backupDir, `pre-update-${from}-to-${currentVersion}-${stamp}.sqlite`);

    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    console.log(`Backed up before upgrading ${from} -> ${currentVersion}: ${target}`);

    // Keep the newest few. Left alone these accumulate one per release for the
    // life of the shop, on a till that may not have much disk.
    const older = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('pre-update-') && f.endsWith('.sqlite'))
      .sort()
      .reverse()
      .slice(KEEP_PRE_UPDATE_BACKUPS);
    for (const f of older) {
      try {
        fs.unlinkSync(path.join(backupDir, f));
      } catch {
        /* A backup that will not delete is not worth failing a launch over. */
      }
    }
  } catch (err) {
    // Deliberately not fatal. A shop that cannot open its till because a backup
    // failed is worse off than one running without today's copy.
    console.error('Pre-update backup failed; continuing:', err);
  }
}

/** Records which build last opened this database, so the next one can compare. */
function recordAppVersion(db: Database.Database): void {
  try {
    db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES ('last_app_version', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(app.getVersion(), new Date().toISOString());
  } catch (err) {
    console.error('Could not record the app version:', err);
  }
}


function seedInitialDefaults(db: Database.Database) {
  // Check settings
  const checkSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  
  const now = new Date().toISOString();
  insertSetting.run('shop_name', 'Mechanical Parts Shop', now);
  insertSetting.run('shop_address', 'Dhaka, Bangladesh', now);
  insertSetting.run('invoice_footer', 'Thank you for your business!', now);
  insertSetting.run('idle_lock_minutes', '15', now);
  
  let deviceId = (checkSetting.get('device_id') as { value?: string } | undefined)?.value;
  if (!deviceId) {
    deviceId = `DEV-${uuidv7().slice(0, 8).toUpperCase()}`;
    insertSetting.run('device_id', deviceId, now);
  }

  // Ensure Default Owner and Staff exist
  const ownerUser = db.prepare('SELECT id FROM users WHERE username = ? AND deleted_at IS NULL').get('owner');
  if (!ownerUser) {
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync('owner123', salt);
    const ownerId = uuidv7();
    db.prepare(`
      INSERT INTO users (id, name, username, role, password_hash, is_active, device_id, created_at, updated_at)
      VALUES (?, ?, ?, 'owner', ?, 1, ?, ?, ?)
    `).run(ownerId, 'Default Owner', 'owner', passwordHash, deviceId, now, now);
    console.log('Seeded the owner account. The setup wizard will require a new password before use.');
  }

  // No default staff account. It was recreated on every start with a password
  // published in the console, so it was a permanently known way in that no
  // amount of changing it could close. The owner creates staff logins with real
  // passwords from the Users screen.
}

