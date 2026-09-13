/*
 * Last-resort account recovery, run on the shop's own machine.
 *
 * The recovery code in the app covers the ordinary case. This covers the case
 * where that code is lost too: passwords are bcrypt hashes and there is no
 * server to ask, so without a tool like this a forgotten password would strand
 * a shop's entire history behind a login it can never pass.
 *
 * It grants nothing that physical access did not already grant - anyone who can
 * run this can equally copy or replace shop.db - so it is a supported door
 * rather than a new one. It deliberately lives outside the shipped app: it is
 * run from a terminal by whoever maintains the install, and is not reachable
 * from the running POS.
 *
 * Runs under Electron, not plain node: better-sqlite3 is built against
 * Electron's ABI by `electron-builder install-app-deps`, and Electron's
 * app.getPath('userData') resolves the same database the app itself opens
 * rather than guessing at a path.
 *
 *   npm run reset-owner                        list accounts, show db path
 *   npm run reset-owner -- --password "..."    reset the owner's password
 *   npm run reset-owner -- --user staff1 --password "..."
 *   npm run reset-owner -- --recovery          issue a fresh recovery code
 */

const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : args[i + 1] ?? true;
}

const wantPassword = flag('password');
const wantRecovery = args.includes('--recovery');
const targetUser = flag('user');
const dbOverride = flag('db');

function fail(message) {
  console.error(`\n  ${message}\n`);
  app.exit(1);
}

/*
 * Run as `electron <script>` the app name is "Electron", so getPath('userData')
 * points somewhere the app has never written. The two real locations are named
 * explicitly instead: electron-builder's productName for an installed copy, and
 * package.json's name for a dev build.
 */
function candidatePaths() {
  const roaming = app.getPath('appData');
  return [
    path.join(roaming, 'Mechanical Shop POS', 'shop.db'),
    path.join(roaming, 'mechanical-shop-pos', 'shop.db'),
    path.join(app.getPath('userData'), 'shop.db'),
  ];
}

app.whenReady().then(() => {
  let dbPath;

  if (dbOverride && typeof dbOverride === 'string') {
    dbPath = dbOverride;
  } else {
    const found = candidatePaths().filter((p) => fs.existsSync(p));
    if (found.length > 1) {
      console.log('\n  More than one database found:');
      found.forEach((p) => console.log(`    ${p}`));
      return fail('Pass the one you mean with --db "<path>".');
    }
    dbPath = found[0];
  }

  if (!dbPath || !fs.existsSync(dbPath)) {
    console.log('\n  Looked in:');
    candidatePaths().forEach((p) => console.log(`    ${p}`));
    return fail(
      'No database found.\n' +
      '  If the shop keeps it elsewhere, pass the path:\n' +
      '  npm run reset-owner -- --db "C:\\\\Users\\\\<user>\\\\AppData\\\\Roaming\\\\Mechanical Shop POS\\\\shop.db"'
    );
  }

  console.log(`\n  Database: ${dbPath}`);

  const Database = require('better-sqlite3');
  const bcrypt = require('bcryptjs');
  const db = new Database(dbPath);

  const users = db
    .prepare("SELECT username, name, role, is_active FROM users WHERE deleted_at IS NULL ORDER BY role DESC, created_at ASC")
    .all();

  const sheet = db.prepare("SELECT value FROM settings WHERE key = 'owner_recovery_codes'").get();
  const legacy = db.prepare("SELECT value FROM settings WHERE key = 'owner_recovery_hash'").get();

  let codeSummary = 'none';
  if (sheet && sheet.value) {
    try {
      const records = JSON.parse(sheet.value);
      const unused = records.filter((r) => !r.used_at).length;
      codeSummary = `${unused} unused of ${records.length}`;
    } catch {
      codeSummary = 'stored, but unreadable';
    }
  } else if (legacy && legacy.value) {
    codeSummary = '1 (older single-code format)';
  }

  console.log('\n  Accounts');
  for (const u of users) {
    const state = u.is_active ? '' : '  (disabled)';
    console.log(`    ${u.role.padEnd(6)}  ${u.username.padEnd(16)}  ${u.name}${state}`);
  }
  console.log(`\n  Recovery codes: ${codeSummary}`);

  const now = new Date().toISOString();
  let didWrite = false;

  if (wantPassword) {
    if (typeof wantPassword !== 'string' || wantPassword.length < 6) {
      db.close();
      return fail('--password needs at least 6 characters.');
    }

    // Same target the in-app recovery code resets: the oldest active owner,
    // unless a specific --user was named.
    const target = targetUser
      ? users.find((u) => u.username === targetUser)
      : users.find((u) => u.role === 'owner' && u.is_active);

    if (!target) {
      db.close();
      return fail(targetUser ? `No account named "${targetUser}".` : 'No active owner account found.');
    }

    const hash = bcrypt.hashSync(wantPassword, bcrypt.genSaltSync(12));
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE username = ?').run(hash, now, target.username);

    // Login lockouts are held in memory by the running app, so they clear when
    // it restarts - nothing to reset here.
    console.log(`\n  Password reset for "${target.username}" (${target.role}).`);
    didWrite = true;
  }

  if (wantRecovery) {
    // Same shape the app writes, so a sheet issued here works in the app and
    // vice versa: an array of {hash, used_at} under owner_recovery_codes.
    const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
    const COUNT = 5;

    const codes = Array.from({ length: COUNT }, () => {
      const bytes = require('crypto').randomBytes(16);
      const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
      return [0, 1, 2, 3].map((g) => chars.slice(g * 4, g * 4 + 4).join('')).join('-');
    });

    const records = codes.map((code) => ({
      hash: bcrypt.hashSync(code.replace(/-/g, ''), bcrypt.genSaltSync(12)),
      used_at: null,
    }));

    const upsert = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    );
    upsert.run('owner_recovery_codes', JSON.stringify(records), now);
    upsert.run('owner_recovery_set_at', now, now);
    // A leftover hash from the single-code format would stay valid forever.
    db.prepare("DELETE FROM settings WHERE key = 'owner_recovery_hash'").run();

    console.log('\n  New recovery codes - each works once:');
    codes.forEach((code, i) => console.log(`    ${i + 1}.  ${code}`));
    console.log('\n  Write them down now - they are not stored anywhere in readable form.');
    didWrite = true;
  }

  if (!didWrite) {
    console.log('\n  Nothing changed. Pass --password "..." or --recovery to make a change.');
  }

  db.close();
  console.log('');
  app.exit(0);
});
