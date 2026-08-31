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

export function generateInvoiceNumber(db: any): string {
  const now = new Date();
  const datePart = now.getFullYear().toString().slice(-2) +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const row = db.prepare(`
    SELECT invoice_no FROM sales
    WHERE invoice_no LIKE ?
    ORDER BY invoice_no DESC LIMIT 1
  `).get(`INV-${datePart}-%`) as any;

  let nextSerial = 1;
  if (row) {
    const parts = row.invoice_no.split('-');
    if (parts.length === 3) {
      nextSerial = parseInt(parts[2], 10) + 1;
    }
  }

  const serialStr = nextSerial.toString().padStart(4, '0');
  const prefix = 'INV-';
  return `${prefix}${datePart}-${serialStr}`;
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

export function calculateShiftSummary(db: any, shift: any) {
  const shiftStart = shift.opened_at;
  const shiftEnd = shift.closed_at || new Date().toISOString();
  const userId = shift.user_id;

  // User details
  const userRow = db.prepare('SELECT name, username FROM users WHERE id = ?').get(userId) as any;

  // 1. Sales during shift
  const sales = db.prepare(`
    SELECT total_paisa, status FROM sales
    WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL AND status != 'held'
  `).all(shiftStart, shiftEnd) as any[];

  let totalSalesPaisa = 0;
  sales.forEach((s) => {
    totalSalesPaisa += s.total_paisa;
  });

  // 2. Payments breakdown during shift
  const payments = db.prepare(`
    SELECT method, direction, amount_paisa, type FROM payments
    WHERE created_at >= ? AND created_at <= ? AND deleted_at IS NULL
  `).all(shiftStart, shiftEnd) as any[];

  let cashSalesPaisa = 0;
  let bkashSalesPaisa = 0;
  let nagadSalesPaisa = 0;
  let cardSalesPaisa = 0;
  let cashRefundPaisa = 0;

  payments.forEach((p) => {
    if (p.direction === 'in') {
      if (p.method === 'cash') cashSalesPaisa += p.amount_paisa;
      else if (p.method === 'bkash') bkashSalesPaisa += p.amount_paisa;
      else if (p.method === 'nagad') nagadSalesPaisa += p.amount_paisa;
      else if (p.method === 'card') cardSalesPaisa += p.amount_paisa;
    } else if (p.direction === 'out' && p.type === 'refund' && p.method === 'cash') {
      cashRefundPaisa += p.amount_paisa;
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

  const netCashSalesPaisa = Math.max(0, cashSalesPaisa - cashRefundPaisa);
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
    total_cash_sales_paisa: cashSalesPaisa,
    total_bkash_sales_paisa: bkashSalesPaisa,
    total_nagad_sales_paisa: nagadSalesPaisa,
    total_card_sales_paisa: cardSalesPaisa,
    total_cash_refund_paisa: cashRefundPaisa,
    total_cash_in_paisa: totalCashInPaisa,
    total_cash_out_paisa: totalCashOutPaisa,
    cash_transactions: cashTxs,
    sales_count: sales.length,
    note: shift.note,
  };
}
