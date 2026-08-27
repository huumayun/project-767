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

  // Run schema migrations
  runMigrations(dbInstance);

  // Seed default settings and owner user if missing
  seedInitialDefaults(dbInstance);

  return dbInstance;
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
    console.log('Ensured default owner account (username: owner, password: owner123)');
  }

  const staffUser = db.prepare('SELECT id FROM users WHERE username = ? AND deleted_at IS NULL').get('staff');
  if (!staffUser) {
    const salt = bcrypt.genSaltSync(12);
    const staffHash = bcrypt.hashSync('staff123', salt);
    const staffId = uuidv7();
    db.prepare(`
      INSERT INTO users (id, name, username, role, password_hash, is_active, device_id, created_at, updated_at)
      VALUES (?, ?, ?, 'staff', ?, 1, ?, ?, ?)
    `).run(staffId, 'Default Staff', 'staff', staffHash, deviceId, now, now);
    console.log('Ensured default staff account (username: staff, password: staff123)');
  }
}

