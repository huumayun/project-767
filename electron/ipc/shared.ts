import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../db';

export interface MainSession {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'staff';
  has_pin?: boolean;
  loginTime: number;
}

export let activeSession: MainSession | null = null;

export function getDeviceId(db: any): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('device_id') as any;
  return row?.value || 'MAIN';
}

export function requireRole(allowedRoles: ('owner' | 'staff')[]) {
  if (!activeSession) {
    throw new Error('Unauthorized: Authentication required');
  }
  if (!allowedRoles.includes(activeSession.role)) {
    throw new Error(`Forbidden: Insufficient privileges for role ${activeSession.role}`);
  }
}

/**
 * Restoring a backup has to work before anyone can log in - a fresh install has
 * no owner to authenticate as. It must not stay open afterwards: these handlers
 * replace the whole database, so leaving them unguarded let anyone at the login
 * screen swap in a database of their own and come back as owner.
 *
 * First run is the same flag the wizard itself uses, checked in the main process
 * rather than assumed from where the call came from.
 */
/**
 * PINs are credentials and are stored hashed, like passwords. They used to sit
 * in the users table as typed, which put every PIN in plain sight in the users
 * list, in every backup, and in every copy uploaded to Drive - and a PIN grants
 * a full session, owner included.
 *
 * Cost 10 rather than the 12 used for passwords: a PIN is checked against each
 * user in turn (there is no username to look it up by), so the work is
 * multiplied by the number of staff and has to stay inside a counter-speed
 * response. Rate limiting, not hash cost, is what defends a 4-digit secret.
 */
const PIN_BCRYPT_ROUNDS = 10;

export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, bcrypt.genSaltSync(PIN_BCRYPT_ROUNDS));
}

/** A stored value that is not a bcrypt hash is a PIN from before they were hashed. */
export function isPinHashed(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && /^\$2[aby]\$/.test(stored);
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (!isPinHashed(stored)) return stored === pin;
  return bcrypt.compareSync(pin, stored);
}

export function findActiveUserByPin(db: any, pin: string): any | null {
  const candidates = db
    .prepare("SELECT * FROM users WHERE pin_code IS NOT NULL AND pin_code != '' AND is_active = 1 AND deleted_at IS NULL ORDER BY created_at ASC")
    .all() as any[];
  // Every candidate is checked even after a match so the time taken does not
  // reveal where in the list the PIN sits.
  let found: any = null;
  for (const user of candidates) {
    if (verifyPin(pin, user.pin_code) && !found) found = user;
  }
  return found;
}

/**
 * Any account holding this PIN, active or not.
 *
 * Login must ignore a deactivated account; *uniqueness* must not. A PIN freed
 * only because its owner was switched off is not free - switching them back on
 * is one checkbox, and nothing re-checks on the way. Handing it to a second
 * cashier in the meantime produced two live accounts on one PIN.
 */
function findAnyUserByPin(db: any, pin: string): any | null {
  const candidates = db
    .prepare("SELECT * FROM users WHERE pin_code IS NOT NULL AND pin_code != '' AND deleted_at IS NULL ORDER BY created_at ASC")
    .all() as any[];
  let found: any = null;
  // Every candidate is checked even after a match, as in findActiveUserByPin.
  for (const user of candidates) {
    if (verifyPin(pin, user.pin_code) && !found) found = user;
  }
  return found;
}

/**
 * Why this PIN cannot be used, phrased for the person typing it - or null.
 *
 * One sentence, built once, so the three places that assign a PIN cannot drift
 * into three different wordings. It names the holder the way the rest of the
 * app now does (name, then @username) rather than a bare login id, and it says
 * outright when the holder is switched off - otherwise refusing a PIN because
 * of an account that is not even active reads as a bug.
 */
export function pinTakenBy(db: any, pin: string, exceptUserId?: string): string | null {
  const match = findAnyUserByPin(db, pin);
  if (!match) return null;
  if (exceptUserId && match.id === exceptUserId) return null;

  const who = `${match.name} (@${match.username})`;
  return match.is_active
    ? `${who} already uses this PIN. Please pick a different one.`
    : `${who} already uses this PIN. That account is switched off, but the PIN stays reserved for it - pick a different one, or clear their PIN first.`;
}


/**
 * Passwords are bcrypt hashes and there is no server to mail a reset link to, so
 * an owner who forgets their password had no way back into their own shop - the
 * data sat on the counter unreachable. Recovery codes are the offline stand-in
 * for that reset link.
 *
 * A set rather than one code, for the same reason every 2FA system issues a
 * sheet of them: the owner prints them once and they get lost one at a time. A
 * code is consumed the moment it works, so a code read out over the phone stops
 * being a way in, while the rest of the sheet still opens the door.
 *
 * Crockford-style alphabet: no O/0, no I/1/L. These are read off paper months
 * later, often over the phone, and those are the pairs that get misread. 16
 * characters at 5 bits each is 80 bits per code, so the throttle in auth.ts is a
 * formality rather than the thing holding the door.
 *
 * Stored hashed, like every other credential, so a backup or a Drive copy never
 * carries a working one.
 */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_GROUPS = 4;
const RECOVERY_GROUP_LEN = 4;
export const RECOVERY_CODE_COUNT = 5;
export const RECOVERY_CODES_KEY = 'owner_recovery_codes';
export const RECOVERY_SET_AT_KEY = 'owner_recovery_set_at';
/** Pre-set format: a single hash. Read for compatibility, replaced on first reissue. */
export const RECOVERY_LEGACY_HASH_KEY = 'owner_recovery_hash';

export interface RecoveryCodeRecord {
  hash: string;
  used_at: string | null;
}

function generateOne(): string {
  const bytes = randomBytes(RECOVERY_GROUPS * RECOVERY_GROUP_LEN);
  const chars = Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]);
  const groups: string[] = [];
  for (let i = 0; i < RECOVERY_GROUPS; i++) {
    groups.push(chars.slice(i * RECOVERY_GROUP_LEN, (i + 1) * RECOVERY_GROUP_LEN).join(''));
  }
  return groups.join('-');
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, generateOne);
}

/** Dashes, spaces and case are how it was written down, not part of the secret. */
export function normalizeRecoveryCode(raw: string): string {
  return (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function upsertSetting(db: any, key: string, value: string, now: string) {
  db.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, now);
}

/**
 * Replaces the whole set. Returns the codes, which is the only time they exist
 * in the clear - after this the caller is the last thing holding them.
 */
export function storeRecoveryCodes(db: any, codes: string[]): string[] {
  const records: RecoveryCodeRecord[] = codes.map((code) => ({
    hash: bcrypt.hashSync(normalizeRecoveryCode(code), bcrypt.genSaltSync(12)),
    used_at: null,
  }));
  const now = new Date().toISOString();
  upsertSetting(db, RECOVERY_CODES_KEY, JSON.stringify(records), now);
  upsertSetting(db, RECOVERY_SET_AT_KEY, now, now);
  // A leftover single hash from the earlier format would otherwise stay valid
  // forever, outliving every sheet issued after it.
  db.prepare('DELETE FROM settings WHERE key = ?').run(RECOVERY_LEGACY_HASH_KEY);
  return codes;
}

export function readRecoveryCodes(db: any): RecoveryCodeRecord[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(RECOVERY_CODES_KEY) as any;
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) return parsed as RecoveryCodeRecord[];
    } catch {
      // A corrupt value must not read as "no codes set", which would quietly
      // tell an owner holding a valid sheet that they have none.
      throw new Error('The stored recovery codes could not be read. Use the offline reset tool.');
    }
  }

  const legacy = db.prepare('SELECT value FROM settings WHERE key = ?').get(RECOVERY_LEGACY_HASH_KEY) as any;
  if (legacy?.value) return [{ hash: legacy.value, used_at: null }];

  return [];
}

export interface RecoveryCodeStatus {
  total: number;
  used: number;
  remaining: number;
}

export function recoveryCodeStatus(db: any): RecoveryCodeStatus {
  const records = readRecoveryCodes(db);
  const used = records.filter((r) => !!r.used_at).length;
  return { total: records.length, used, remaining: records.length - used };
}

/**
 * Checks a code against every unused one and marks the match as spent.
 *
 * Every candidate is compared even after a hit, so the time taken does not
 * reveal where in the sheet the code sits - the same reason findActiveUserByPin
 * does not stop early.
 */
export function consumeRecoveryCode(db: any, raw: string): { ok: boolean; remaining: number } {
  const records = readRecoveryCodes(db);
  const normalized = normalizeRecoveryCode(raw);

  let matchIndex = -1;
  records.forEach((record, index) => {
    if (record.used_at) return;
    if (bcrypt.compareSync(normalized, record.hash) && matchIndex === -1) matchIndex = index;
  });

  if (matchIndex === -1) {
    const used = records.filter((r) => !!r.used_at).length;
    return { ok: false, remaining: records.length - used };
  }

  records[matchIndex].used_at = new Date().toISOString();
  upsertSetting(db, RECOVERY_CODES_KEY, JSON.stringify(records), new Date().toISOString());
  // Consuming one from a legacy single-hash set has to clear that key too,
  // since readRecoveryCodes would otherwise keep serving it as unused.
  db.prepare('DELETE FROM settings WHERE key = ?').run(RECOVERY_LEGACY_HASH_KEY);

  const used = records.filter((r) => !!r.used_at).length;
  return { ok: true, remaining: records.length - used };
}

/**
 * The account the codes reset. Oldest active owner rather than "any owner": a
 * shop that has added a second owner should still get a predictable answer, and
 * the first one is the account the install was set up with.
 */
export function recoveryOwner(db: any): any | null {
  return db
    .prepare("SELECT * FROM users WHERE role = 'owner' AND is_active = 1 AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1")
    .get() as any;
}

export function requireOwnerOrFirstRun() {
  if (activeSession?.role === 'owner') return;

  const db = getDb();
  const flag = db.prepare("SELECT value FROM settings WHERE key = 'first_run_completed'").get() as any;
  if (flag?.value === '1') {
    throw new Error('Forbidden: only the Owner can restore a backup once the shop is set up.');
  }
}

/**
 * Refuses a money movement while no shift is open.
 *
 * Every shift figure - cash sales, due collected, refunds, the expected drawer
 * count - is windowed between a shift's opened_at and closed_at. Money taken in
 * the gap between two shifts falls inside no window at all: the customer's
 * balance updates correctly and the sales report still sees it, but no Z-report
 * ever accounts for the cash, so the next count comes up with a surplus and
 * nothing on the paper to explain it.
 *
 * Silent where shifts are switched off in Settings, since then there is no
 * drawer to reconcile against.
 */
export function requireOpenShift(db: any, action = 'This') {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'enable_shifts'").get() as any;
  const shiftsEnabled = !row || row.value !== '0';
  if (!shiftsEnabled) return;

  const open = db.prepare("SELECT id FROM shifts WHERE status = 'open' LIMIT 1").get();
  if (!open) {
    throw new Error(
      `${action} moves cash, so a shift has to be open first — otherwise it lands in no shift report. Open a shift and try again.`
    );
  }
}

export function logAudit(action: string, entity: string, entityId?: string, detailJson?: any) {
  try {
    const db = getDb();
    const auditId = uuidv7();
    const userId = activeSession ? activeSession.id : null;
    db.prepare(`
      INSERT INTO audit_log (id, user_id, action, entity, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(auditId, userId, action, entity, entityId || null, detailJson ? JSON.stringify(detailJson) : null, new Date().toISOString());
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

export function setActiveSession(session: any) {
  activeSession = session;
}

/**
 * The next invoice number for today: INV-YYMMDD-0001, counting up per day.
 *
 * This reads the highest serial and adds one, which is only safe if the read and
 * the insert that follows it happen inside one transaction - see the retry in
 * sales:create. Called on its own it can hand the same number to two callers.
 *
 * The maximum is taken numerically rather than by sorting the text. Sorting
 * worked only while every serial was four digits: a shop that passed 9999 in a
 * day would find '10000' ordering below '9999', so the counter would jump back
 * and every sale after it would collide with one already written.
 */
export function generateInvoiceNumber(db: any): string {
  const now = new Date();
  const datePart = now.getFullYear().toString().slice(-2) +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const prefix = `INV-${datePart}-`;
  const row = db.prepare(`
    SELECT MAX(CAST(substr(invoice_no, ?) AS INTEGER)) AS max_serial
    FROM sales
    WHERE invoice_no LIKE ?
  `).get(prefix.length + 1, `${prefix}%`) as any;

  const nextSerial = (row?.max_serial || 0) + 1;
  return `${prefix}${nextSerial.toString().padStart(4, '0')}`;
}

/** True for the UNIQUE(invoice_no) collision that a racing sale produces. */
export function isInvoiceNumberCollision(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('UNIQUE constraint failed: sales.invoice_no');
}

/**
 * Generates a unique Return/Credit Note number in RTN-YYMMDD-NNNN format.
 * Mirrors generateInvoiceNumber but counts against the returns table.
 * Must be called inside the same transaction that writes the return row.
 */
export function generateReturnInvoiceNumber(db: any): string {
  const now = new Date();
  const datePart = now.getFullYear().toString().slice(-2) +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const prefix = `RTN-${datePart}-`;
  const row = db.prepare(`
    SELECT MAX(CAST(substr(return_invoice_no, ?) AS INTEGER)) AS max_serial
    FROM returns
    WHERE return_invoice_no LIKE ?
  `).get(prefix.length + 1, `${prefix}%`) as any;

  const nextSerial = (row?.max_serial || 0) + 1;
  return `${prefix}${nextSerial.toString().padStart(4, '0')}`;
}


/**
 * Spreads an invoice-level discount across the lines it was given on, by value,
 * so a line is worth what the customer actually paid for it. Returns paisa off
 * each line, keyed by sale_item id.
 *
 * Rounding is done once against the running total rather than per line, and the
 * remainder lands on the largest line, so the parts always add back up to the
 * discount exactly - the same approach purchases uses for transport.
 */
/**
 * The local calendar day a timestamp belongs to. Timestamps are stored as UTC,
 * and Bangladesh runs six hours ahead, so comparing a UTC instant against a
 * plain date string moves everything sold between midnight and 6am into the
 * previous day. The reports already group this way; anything that filters by
 * date needs to agree with them.
 */
/**
 * The same answer as localDateKey, as SQL, so a report can ask the database for
 * a date range instead of reading its whole history back and sieving it in JS.
 *
 * SQLite reads the trailing Z on the stored ISO-8601 stamps as UTC and
 * 'localtime' shifts to the machine's zone, which is exactly what
 * `new Date(...).getDate()` does - verified against both, on the boundary hours
 * where a UTC instant and a Dhaka date disagree.
 *
 * The COALESCE keeps the old fallback for a stamp SQLite cannot parse: such a
 * row used to be matched on its leading ten characters rather than dropped, and
 * a report should not start losing rows it used to count.
 */
export function localDaySql(column: string): string {
  return `COALESCE(date(${column}, 'localtime'), substr(${column}, 1, 10))`;
}

export function localDateKey(timestamp: string): string {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return String(timestamp).slice(0, 10);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function allocateSaleDiscount(
  lines: { id: string; grossPaisa: number }[],
  discountPaisa: number
): Record<string, number> {
  const alloc: Record<string, number> = {};
  for (const line of lines) alloc[line.id] = 0;
  if (discountPaisa <= 0 || lines.length === 0) return alloc;

  const grossTotal = lines.reduce((n, l) => n + l.grossPaisa, 0);
  if (grossTotal <= 0) return alloc;

  // A discount bigger than the goods would make lines worth less than nothing.
  const capped = Math.min(discountPaisa, grossTotal);

  let allocated = 0;
  let biggest = lines[0];
  for (const line of lines) {
    alloc[line.id] = Math.floor((capped * line.grossPaisa) / grossTotal);
    allocated += alloc[line.id];
    if (line.grossPaisa > biggest.grossPaisa) biggest = line;
  }
  alloc[biggest.id] += capped - allocated;

  return alloc;
}

export function processStockIn(db: any, productId: string, addQty: number, unitCostPaisa: number | null, reason: string, userId: string, deviceId: string, refTable: string, refId: string) {
  const now = new Date().toISOString();

  const product = db.prepare('SELECT stock_qty, cost_price_paisa FROM products WHERE id = ? AND deleted_at IS NULL').get(productId) as any;
  if (!product) throw new Error('Product not found');
  
  const incomingCost = unitCostPaisa !== null ? unitCostPaisa : product.cost_price_paisa;
  
  const newCost = incomingCost;
  db.prepare(`
    INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
    VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)
  `).run(productId, addQty, addQty, incomingCost, now, refTable, refId);

  db.prepare('UPDATE products SET stock_qty = stock_qty + ?, cost_price_paisa = ?, updated_at = ? WHERE id = ?')
    .run(addQty, newCost, now, productId);
    
  db.prepare(`
    INSERT INTO stock_transactions (
      id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, device_id, created_at, updated_at, unit_cost_paisa
    ) VALUES (?, ?, 'purchase', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv7(), productId, addQty, refTable, refId, reason, userId, deviceId, now, now, incomingCost);
  
  return product.stock_qty + addQty;
}

/**
 * Takes qty out of a product's FIFO batches, oldest first, and reports what it
 * cost. Used by anything that removes stock so that products.stock_qty and the
 * batch pool stay two views of one fact rather than two independent records.
 *
 * If the batches hold less than asked for, the shortfall is costed at the
 * product's current cost price and the caller is told - that only happens when
 * the two have already drifted apart.
 */
export function consumeFifoBatches(
  db: any,
  productId: string,
  qty: number,
  fallbackCostPaisa: number
): { totalCostPaisa: number; consumed: { batch_id: string; qty: number; cost_price_paisa: number }[]; shortfall: number } {
  const batches = db.prepare(
    'SELECT id, remaining_qty, cost_price_paisa FROM inventory_batches WHERE product_id = ? AND remaining_qty > 0 ORDER BY received_at ASC'
  ).all(productId) as any[];

  const take = db.prepare('UPDATE inventory_batches SET remaining_qty = remaining_qty - ? WHERE id = ?');
  const consumed: { batch_id: string; qty: number; cost_price_paisa: number }[] = [];
  let left = qty;
  let totalCostPaisa = 0;

  for (const batch of batches) {
    if (left <= 0) break;
    const takeQty = Math.min(batch.remaining_qty, left);
    left -= takeQty;
    totalCostPaisa += takeQty * batch.cost_price_paisa;
    take.run(takeQty, batch.id);
    consumed.push({ batch_id: batch.id, qty: takeQty, cost_price_paisa: batch.cost_price_paisa });
  }

  if (left > 0) totalCostPaisa += left * fallbackCostPaisa;
  return { totalCostPaisa, consumed, shortfall: left };
}

/** Products whose stock_qty disagrees with the sum of their open batches. */
export function findBatchDrift(db: any): { id: string; name: string; stock_qty: number; batch_qty: number }[] {
  return db.prepare(`
    SELECT p.id, p.name, p.stock_qty, COALESCE(b.q, 0) AS batch_qty
    FROM products p
    LEFT JOIN (
      SELECT product_id, SUM(remaining_qty) AS q FROM inventory_batches GROUP BY product_id
    ) b ON p.id = b.product_id
    WHERE p.deleted_at IS NULL AND p.stock_qty <> COALESCE(b.q, 0)
  `).all() as any[];
}

export function calculateShiftSummary(db: any, shift: any) {
  const shiftStart = shift.opened_at;
  const shiftEnd = shift.closed_at || new Date().toISOString();
  const userId = shift.user_id;

  // User details
  const userRow = db.prepare('SELECT name, username FROM users WHERE id = ?').get(userId) as any;

  // 1. Sales during the shift, each with what it collected and what it left owing
  const sales = db.prepare(`
    SELECT
      s.id,
      s.invoice_no,
      s.total_paisa,
      s.status,
      s.created_at,
      s.customer_id,
      COALESCE(s.previous_due_paid_paisa, 0) AS previous_due_paid_paisa,
      COALESCE(c.name, 'Walk-in') AS customer_name,
      COALESCE((
        SELECT SUM(pm.amount_paisa) FROM payments pm
        WHERE pm.sale_id = s.id AND pm.direction = 'in' AND pm.deleted_at IS NULL
      ), 0) AS paid_paisa,
      COALESCE((
        SELECT SUM(ri.amount_paisa) FROM return_items ri
        JOIN sale_items si2 ON si2.id = ri.sale_item_id
        JOIN returns r2 ON r2.id = ri.return_id
        WHERE si2.sale_id = s.id AND ri.deleted_at IS NULL AND r2.deleted_at IS NULL
      ), 0) AS returned_paisa
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.created_at >= ? AND s.created_at <= ? AND s.deleted_at IS NULL AND s.status != 'held'
    ORDER BY s.created_at ASC
  `).all(shiftStart, shiftEnd) as any[];

  let totalSalesPaisa = 0;
  let totalReturnedPaisa = 0;
  let dueSalesPaisa = 0;
  let dueSalesCount = 0;

  const saleRows = sales.map((row) => {
    const duePaisa = Math.max(0, row.total_paisa - row.paid_paisa);
    totalSalesPaisa += row.total_paisa;
    if (duePaisa > 0) {
      dueSalesPaisa += duePaisa;
      dueSalesCount += 1;
    }
    return { ...row, due_paisa: duePaisa };
  });

  /*
   * What the goods sold in this shift cost, billed against the FIFO cost
   * captured on each line at the time of sale - the same figure the profit
   * report uses, so a shift and a period report cannot disagree about margin.
   * Returned units are taken back out; they were not sold.
   */
  const cogsRow = db.prepare(`
    SELECT COALESCE(SUM(
      COALESCE(si.unit_cost_paisa, p.cost_price_paisa, 0) *
      (si.qty - COALESCE((SELECT SUM(ri.qty) FROM return_items ri WHERE ri.sale_item_id = si.id), 0))
    ), 0) AS cogs_paisa
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    LEFT JOIN products p ON p.id = si.product_id
    WHERE s.created_at >= ? AND s.created_at <= ?
      AND s.deleted_at IS NULL AND s.status != 'held' AND si.deleted_at IS NULL
  `).get(shiftStart, shiftEnd) as any;

  /*
   * Returns belong to the shift they were processed in, not the shift that made
   * the original sale.
   *
   * This used to sum each sale's return_items with no date filter, over sales
   * windowed by their own created_at - so a Monday bill returned on Tuesday put
   * the Returns line on Monday while Tuesday's drawer paid out the cash. Two
   * halves of one event, on two different reports: Monday's Z-report changed
   * after it had been closed and printed, and Tuesday came up short with
   * nothing on it to say why.
   *
   * Windowed on returns.created_at, the goods and the money land together.
   */
  const returnsRow = db.prepare(`
    SELECT COALESCE(SUM(ri.amount_paisa), 0) AS returned_paisa
    FROM returns r
    JOIN return_items ri ON ri.return_id = r.id
    WHERE r.created_at >= ? AND r.created_at <= ?
      AND r.deleted_at IS NULL AND ri.deleted_at IS NULL
  `).get(shiftStart, shiftEnd) as any;
  totalReturnedPaisa = returnsRow?.returned_paisa || 0;

  const totalCogsPaisa = cogsRow?.cogs_paisa || 0;
  const netSalesPaisa = totalSalesPaisa - totalReturnedPaisa;
  const grossProfitPaisa = netSalesPaisa - totalCogsPaisa;

  // 2. Payments breakdown during shift
  const payments = db.prepare(`
    SELECT method, direction, amount_paisa, type FROM payments
    WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL
  `).all(shiftStart, shiftEnd) as any[];

  let cashSalesPaisa = 0;
  /*
   * Cash from customers settling an old balance. It belongs in the drawer count
   * exactly as a sale does, but it is not a sale - counting it as one made the
   * shift's takings disagree with the day's sales whenever anyone paid off baki.
   */
  let cashDueCollectedPaisa = 0;
  let otherDueCollectedPaisa = 0;
  let bkashSalesPaisa = 0;
  let nagadSalesPaisa = 0;
  let cardSalesPaisa = 0;
  // Everything the till now records that is not cash. bKash/Nagad/Card above
  // stay for the rows taken before the buttons were merged.
  let otherSalesPaisa = 0;
  let cashRefundPaisa = 0;
  let cashPaidOutPaisa = 0;

  payments.forEach((p) => {
    if (p.direction === 'in') {
      const isDueCollection = p.type === 'due_collection';
      if (p.method === 'cash') {
        if (isDueCollection) cashDueCollectedPaisa += p.amount_paisa;
        else cashSalesPaisa += p.amount_paisa;
      } else if (isDueCollection) {
        otherDueCollectedPaisa += p.amount_paisa;
      } else if (p.method === 'bkash') bkashSalesPaisa += p.amount_paisa;
      else if (p.method === 'nagad') nagadSalesPaisa += p.amount_paisa;
      else if (p.method === 'card') cardSalesPaisa += p.amount_paisa;
      else otherSalesPaisa += p.amount_paisa;
    } else if (p.direction === 'out' && p.method === 'cash') {
      // Any cash that leaves the drawer has to come off the expected count.
      // However, the shop owner requested NOT to deduct supplier payments from 
      // the till cash, as they might not be paid from the actual cash drawer. 
      // We only deduct refunds and petty cash-out.
      if (p.type !== 'supplier_payment') {
        cashPaidOutPaisa += p.amount_paisa;
      }
      if (p.type === 'refund') cashRefundPaisa += p.amount_paisa;
    }
  });


  
  // Move previous_due_paid_paisa from sales totals to due collected totals
  sales.forEach((s) => {
    let duePaid = s.previous_due_paid_paisa;
    if (duePaid > 0) {
      if (cashSalesPaisa >= duePaid) {
        cashSalesPaisa -= duePaid;
        cashDueCollectedPaisa += duePaid;
      } else {
        duePaid -= cashSalesPaisa;
        cashDueCollectedPaisa += cashSalesPaisa;
        cashSalesPaisa = 0;
        
        if (bkashSalesPaisa >= duePaid) {
          bkashSalesPaisa -= duePaid;
          otherDueCollectedPaisa += duePaid;
        } else {
          duePaid -= bkashSalesPaisa;
          otherDueCollectedPaisa += bkashSalesPaisa;
          bkashSalesPaisa = 0;
          
          if (nagadSalesPaisa >= duePaid) {
            nagadSalesPaisa -= duePaid;
            otherDueCollectedPaisa += duePaid;
          } else {
            duePaid -= nagadSalesPaisa;
            otherDueCollectedPaisa += nagadSalesPaisa;
            nagadSalesPaisa = 0;
            
            if (cardSalesPaisa >= duePaid) {
              cardSalesPaisa -= duePaid;
              otherDueCollectedPaisa += duePaid;
            } else {
              duePaid -= cardSalesPaisa;
              otherDueCollectedPaisa += cardSalesPaisa;
              cardSalesPaisa = 0;
              
              if (otherSalesPaisa >= duePaid) {
                otherSalesPaisa -= duePaid;
                otherDueCollectedPaisa += duePaid;
              }
            }
          }
        }
      }
    }
  });
// 3. Shift Cash In / Out (Petty Cash)
  const cashTxs = db.prepare(`
    SELECT id, shift_id, type, amount_paisa, reason, user_id, device_id, created_at, updated_at
    FROM shift_cash_transactions
    WHERE shift_id = ?
    ORDER BY created_at ASC
  `).all(shift.id) as any[];

  let totalCashInPaisa = 0;
  let totalCashOutPaisa = 0;

  cashTxs.forEach((tx) => {
    if (tx.type === 'cash_in') totalCashInPaisa += tx.amount_paisa;
    else if (tx.type === 'cash_out') totalCashOutPaisa += tx.amount_paisa;
  });

  // Not clamped at zero: a drawer that has paid out more than it took in is a
  // real state the owner needs to see, and hiding it behind a floor of zero only
  // moved the discrepancy into the closing count.
  // Cash is cash: a balance settled at the counter fills the drawer just as a
  // sale does, so both go into what the till should hold at close.
  const cashInDrawerPaisa = cashSalesPaisa + cashDueCollectedPaisa;
  const netCashSalesPaisa = cashInDrawerPaisa - cashPaidOutPaisa;
  const expectedCashPaisa = shift.opening_cash_paisa + netCashSalesPaisa + totalCashInPaisa - totalCashOutPaisa;

  return {
    shift_id: shift.id,
    user_id: shift.user_id,
    user_name: userRow?.name || userRow?.username || 'Cashier',
    device_id: shift.device_id,
    status: shift.status,
    opened_at: shift.opened_at,
    closed_at: shift.closed_at,
    opening_cash_paisa: shift.opening_cash_paisa,
    expected_cash_paisa: expectedCashPaisa,
    actual_cash_paisa: shift.actual_cash_paisa ?? null,
    cash_difference_paisa: shift.cash_difference_paisa ?? null,
    closing_cash_withdrawn_paisa: shift.closing_cash_withdrawn_paisa ?? 0,
    closing_float_left_paisa: shift.closing_float_left_paisa ?? 0,
    total_sales_paisa: totalSalesPaisa,
    cash_due_collected_paisa: cashDueCollectedPaisa,
    other_due_collected_paisa: otherDueCollectedPaisa,
    total_cash_sales_paisa: cashSalesPaisa,
    total_bkash_sales_paisa: bkashSalesPaisa,
    total_nagad_sales_paisa: nagadSalesPaisa,
    total_card_sales_paisa: cardSalesPaisa,
    total_other_sales_paisa: otherSalesPaisa,
    total_returned_paisa: totalReturnedPaisa,
    net_sales_paisa: netSalesPaisa,
    total_cogs_paisa: totalCogsPaisa,
    gross_profit_paisa: grossProfitPaisa,
    total_due_sales_paisa: dueSalesPaisa,
    due_sales_count: dueSalesCount,
    total_cash_due_collected_paisa: cashDueCollectedPaisa,
    total_other_due_collected_paisa: otherDueCollectedPaisa,
    sale_transactions: saleRows,
    total_cash_refund_paisa: cashRefundPaisa,
    total_cash_paid_out_paisa: cashPaidOutPaisa,
    total_cash_in_paisa: totalCashInPaisa,
    total_cash_out_paisa: totalCashOutPaisa,
    cash_transactions: cashTxs,
    sales_count: sales.length,
    note: shift.note,
  };
}
