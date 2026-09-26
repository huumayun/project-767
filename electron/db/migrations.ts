import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { encryptSecret, decryptSecret } from '../services/safeStore';

export interface Migration {
  id: string;
  name: string;
  up: (db: Database.Database) => void;
  /*
   * Rebuilding a table that others point at needs foreign keys switched off
   * first, and SQLite ignores that pragma inside a transaction. Such a
   * migration runs on its own instead: keys off, its own transaction, keys back
   * on - the procedure SQLite's own docs prescribe.
   */
  ownTransaction?: boolean;
}

/**
 * Baseline schema. Every statement here is idempotent, so it is applied on every
 * startup rather than once. Databases created before newer tables were folded into
 * the squashed 001 already have '001_initial_schema' recorded, so gating this behind
 * the migrations table would leave them permanently missing those tables.
 */
export function applyBaseSchema(db: Database.Database) {
  // System Migrations Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  // 1. Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO settings (key, value, updated_at) 
    VALUES ('inventory_valuation_method', 'fifo', datetime('now'));
  `);

  // 2. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'staff')),
      password_hash TEXT NOT NULL,
      pin_code TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);

  // 3. Categories Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );
  `);

  // 4. Products Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      barcode TEXT UNIQUE,
      name TEXT NOT NULL,
      name_bn TEXT,
      category_id TEXT,
      brand TEXT,
      unit TEXT NOT NULL DEFAULT 'pcs',
      cost_price_paisa INTEGER NOT NULL DEFAULT 0,
      sell_price_paisa INTEGER NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER NOT NULL DEFAULT 5,
      is_serial_tracked INTEGER NOT NULL DEFAULT 0,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
  `);

  // 5. Suppliers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      contact_person TEXT,
      opening_balance_paisa INTEGER NOT NULL DEFAULT 0,
      payment_terms_days INTEGER,
      note TEXT,
      total_payable_paisa INTEGER NOT NULL DEFAULT 0,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);

  // 6. Purchases & Purchase Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,
      supplier_id TEXT,
      invoice_ref TEXT,
      total_paisa INTEGER NOT NULL DEFAULT 0,
      paid_paisa INTEGER NOT NULL DEFAULT 0,
      transport_paisa INTEGER NOT NULL DEFAULT 0,
      transport_on_invoice INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_cost_paisa INTEGER NOT NULL,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (purchase_id) REFERENCES purchases(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // 7. Customers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      note TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
        initial_due_paisa INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  `);

  // 8. Sales & Sale Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoice_no TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('completed', 'held', 'refunded', 'partial_refund')),
      customer_id TEXT,
      subtotal_paisa INTEGER NOT NULL DEFAULT 0,
      discount_paisa INTEGER NOT NULL DEFAULT 0,
      total_paisa INTEGER NOT NULL DEFAULT 0,
      previous_due_paid_paisa INTEGER NOT NULL DEFAULT 0,
      user_id TEXT NOT NULL,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sales_invoice_no ON sales(invoice_no);
    CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales(customer_id);

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      unit_price_paisa INTEGER NOT NULL,
      unit_cost_paisa INTEGER,
      discount_paisa INTEGER NOT NULL DEFAULT 0,
      serial_number_id TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  // 9. Payments Ledger Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      sale_id TEXT,
      customer_id TEXT,
      supplier_id TEXT,
      purchase_id TEXT,
      direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
      method TEXT NOT NULL CHECK(method IN ('cash', 'bkash', 'nagad', 'card', 'other')),
      amount_paisa INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('sale_payment', 'due_collection', 'refund', 'supplier_payment')),
      user_id TEXT NOT NULL,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
    CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id, direction, type);
  `);

  // 10. Stock Transactions Ledger
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('purchase', 'sale', 'return_in', 'return_out', 'adjustment', 'initial')),
      qty_delta INTEGER NOT NULL,
      unit_cost_paisa INTEGER,
      ref_table TEXT,
      ref_id TEXT,
      reason TEXT,
      user_id TEXT NOT NULL,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_stock_tx_product ON stock_transactions(product_id);
  `);

  // 11. Serial Numbers Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS serial_numbers (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      serial TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('in_stock', 'sold', 'returned', 'warranty_out')),
      sale_item_id TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      UNIQUE(product_id, serial),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
    );
  `);

  // 12. Returns & Return Items Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      sale_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      sale_item_id TEXT NOT NULL,
      qty INTEGER NOT NULL,
      amount_paisa INTEGER NOT NULL,
      device_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (return_id) REFERENCES returns(id),
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id)
    );
  `);

  // 13. Audit Log Table (Append-Only)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      detail_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // 14. Sync State Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_state (
      table_name TEXT PRIMARY KEY,
      last_pushed_at TEXT,
      last_pushed_id TEXT,
      last_pulled_at TEXT
    );
  `);

  // 15. Shifts and Shift Transactions
  db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_cash_paisa INTEGER NOT NULL DEFAULT 0,
      expected_cash_paisa INTEGER NOT NULL DEFAULT 0,
      actual_cash_paisa INTEGER,
      cash_difference_paisa INTEGER,
      closing_cash_withdrawn_paisa INTEGER NOT NULL DEFAULT 0,
      closing_float_left_paisa INTEGER NOT NULL DEFAULT 0,
      total_sales_paisa INTEGER NOT NULL DEFAULT 0,
      total_cash_sales_paisa INTEGER NOT NULL DEFAULT 0,
      total_bkash_sales_paisa INTEGER NOT NULL DEFAULT 0,
      total_nagad_sales_paisa INTEGER NOT NULL DEFAULT 0,
      total_card_sales_paisa INTEGER NOT NULL DEFAULT 0,
      total_cash_in_paisa INTEGER NOT NULL DEFAULT 0,
      total_cash_out_paisa INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shifts_user_status ON shifts(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_shifts_device ON shifts(device_id);

    CREATE TABLE IF NOT EXISTS shift_cash_transactions (
      id TEXT PRIMARY KEY,
      shift_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount_paisa INTEGER NOT NULL,
      reason TEXT NOT NULL,
      user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shift_cash_tx_shift ON shift_cash_transactions(shift_id);
  `);

  // 16. Inventory Batches
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      initial_qty INTEGER NOT NULL,
      remaining_qty INTEGER NOT NULL,
      cost_price_paisa INTEGER NOT NULL,
      received_at TEXT NOT NULL,
      ref_table TEXT,
      ref_id TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_batches_product_id ON inventory_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_batches_remaining ON inventory_batches(remaining_qty);
    CREATE INDEX IF NOT EXISTS idx_inventory_batches_received_at ON inventory_batches(received_at);

    CREATE TABLE IF NOT EXISTS sale_item_batches (
      id TEXT PRIMARY KEY,
      sale_item_id TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      qty_consumed INTEGER NOT NULL,
      cost_price_paisa INTEGER NOT NULL,
      FOREIGN KEY (sale_item_id) REFERENCES sale_items(id),
      FOREIGN KEY (batch_id) REFERENCES inventory_batches(id)
    );
  `);

  // VIEWS
  db.exec(`
    CREATE VIEW IF NOT EXISTS v_customer_due AS
    SELECT 
      c.id AS customer_id,
      c.name,
      c.phone,
      COALESCE(sales_total.sum_sales, 0) AS total_sales_paisa,
      COALESCE(payments_total.sum_payments, 0) AS total_paid_paisa,
      (c.initial_due_paisa + COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa
    FROM customers c
    LEFT JOIN (
      SELECT customer_id, SUM(total_paisa) AS sum_sales 
      FROM sales 
      WHERE deleted_at IS NULL AND customer_id IS NOT NULL AND status != 'held'
      GROUP BY customer_id
    ) sales_total ON c.id = sales_total.customer_id
    LEFT JOIN (
      SELECT customer_id, SUM(amount_paisa) AS sum_payments 
      FROM payments 
      WHERE deleted_at IS NULL AND customer_id IS NOT NULL AND direction = 'in'
      GROUP BY customer_id
    ) payments_total ON c.id = payments_total.customer_id
    WHERE c.deleted_at IS NULL;
  `);

  db.exec(`
    CREATE VIEW IF NOT EXISTS v_daily_sales AS
    SELECT 
      date(created_at) AS sale_date,
      COUNT(id) AS total_orders,
      SUM(subtotal_paisa) AS subtotal_paisa,
      SUM(discount_paisa) AS discount_paisa,
      SUM(total_paisa) AS total_sales_paisa
    FROM sales
    WHERE deleted_at IS NULL AND status = 'completed'
    GROUP BY date(created_at);
  `);

  db.exec(`
    CREATE VIEW IF NOT EXISTS v_product_profit AS
    SELECT 
      p.id AS product_id,
      p.name AS product_name,
      p.cost_price_paisa,
      p.sell_price_paisa,
      COALESCE(SUM(si.qty), 0) AS total_qty_sold,
      COALESCE(SUM(si.unit_price_paisa * si.qty - si.discount_paisa), 0) AS revenue_paisa,
      COALESCE(SUM(p.cost_price_paisa * si.qty), 0) AS total_cost_paisa,
      COALESCE(SUM(si.unit_price_paisa * si.qty - si.discount_paisa) - SUM(p.cost_price_paisa * si.qty), 0) AS profit_paisa
    FROM products p
    LEFT JOIN sale_items si ON p.id = si.product_id AND si.deleted_at IS NULL
    LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed' AND s.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
    GROUP BY p.id;
  `);

  db.exec(`
    CREATE VIEW IF NOT EXISTS v_stock_valuation AS
    SELECT 
      p.id AS product_id,
      p.name AS product_name,
      p.stock_qty,
      p.cost_price_paisa,
      p.sell_price_paisa,
      (p.stock_qty * p.cost_price_paisa) AS total_cost_value_paisa,
      (p.stock_qty * p.sell_price_paisa) AS total_sell_value_paisa
    FROM products p
    WHERE p.deleted_at IS NULL;
  `);
}

export const MIGRATIONS: Migration[] = [

  {
    id: '010_initial_due_view',
    name: 'Update v_customer_due to include initial_due_paisa',
    up: (db: Database.Database) => {
      db.exec(`
        DROP VIEW IF EXISTS v_customer_due;
        CREATE VIEW v_customer_due AS
        SELECT 
          c.id AS customer_id,
          c.name,
          c.phone,
          COALESCE(sales_total.sum_sales, 0) AS total_sales_paisa,
          COALESCE(payments_total.sum_payments, 0) AS total_paid_paisa,
          (c.initial_due_paisa + COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa
        FROM customers c
        LEFT JOIN (
          SELECT s.customer_id, 
                 SUM(s.total_paisa - COALESCE((
                   SELECT SUM(ri.amount_paisa) 
                   FROM returns r 
                   JOIN return_items ri ON r.id = ri.return_id 
                   WHERE r.sale_id = s.id
                 ), 0)) AS sum_sales 
          FROM sales s
          WHERE s.deleted_at IS NULL AND s.customer_id IS NOT NULL AND s.status != 'held'
          GROUP BY s.customer_id
        ) sales_total ON c.id = sales_total.customer_id
        LEFT JOIN (
          SELECT p.customer_id, 
                 SUM(CASE WHEN p.direction = 'in' THEN p.amount_paisa ELSE -p.amount_paisa END) AS sum_payments 
          FROM payments p
          WHERE p.deleted_at IS NULL AND p.customer_id IS NOT NULL
          GROUP BY p.customer_id
        ) payments_total ON c.id = payments_total.customer_id
        WHERE c.deleted_at IS NULL;
      `);
    }
  },

  {
    id: '002_fix_v_customer_due',
    name: 'Fix v_customer_due to account for refunds and returns',
    up: (db: Database.Database) => {
      db.exec(`
        DROP VIEW IF EXISTS v_customer_due;
        CREATE VIEW v_customer_due AS
        SELECT 
          c.id AS customer_id,
          c.name,
          c.phone,
          COALESCE(sales_total.sum_sales, 0) AS total_sales_paisa,
          COALESCE(payments_total.sum_payments, 0) AS total_paid_paisa,
          (COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa
        FROM customers c
        LEFT JOIN (
          SELECT s.customer_id, 
                 SUM(s.total_paisa - COALESCE((
                   SELECT SUM(ri.amount_paisa) 
                   FROM returns r 
                   JOIN return_items ri ON r.id = ri.return_id 
                   WHERE r.sale_id = s.id
                 ), 0)) AS sum_sales 
          FROM sales s
          WHERE s.deleted_at IS NULL AND s.customer_id IS NOT NULL AND s.status != 'held'
          GROUP BY s.customer_id
        ) sales_total ON c.id = sales_total.customer_id
        LEFT JOIN (
          SELECT p.customer_id, 
                 SUM(CASE WHEN p.direction = 'in' THEN p.amount_paisa ELSE -p.amount_paisa END) AS sum_payments 
          FROM payments p
          WHERE p.deleted_at IS NULL AND p.customer_id IS NOT NULL
          GROUP BY p.customer_id
        ) payments_total ON c.id = payments_total.customer_id
        WHERE c.deleted_at IS NULL;
      `);
    }
  },
  {
    id: '003_create_missing_fifo_batches',
    name: 'Create missing FIFO batches for initial or unbatched stock',
    up: (db: Database.Database) => {
      db.exec(`
        INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
        SELECT 
          lower(hex(randomblob(16))),
          p.id,
          (p.stock_qty - COALESCE(b.batched_qty, 0)),
          (p.stock_qty - COALESCE(b.batched_qty, 0)),
          p.cost_price_paisa,
          p.created_at,
          'products',
          p.id
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(remaining_qty) as batched_qty 
          FROM inventory_batches 
          GROUP BY product_id
        ) b ON p.id = b.product_id
        WHERE p.deleted_at IS NULL AND (p.stock_qty - COALESCE(b.batched_qty, 0)) > 0;
      `);
    }
  },
  {
    id: '004_backfill_purchase_payments',
    name: 'Record cash already paid on purchases as payment rows',
    up: (db: Database.Database) => {
      // Cash handed over at purchase time was only ever written to
      // purchases.paid_paisa. No cash report reads that column, so the money
      // left the drawer without any ledger seeing it. Purchases now write a
      // payment row; these are the ones recorded before that change.
      //
      // The supplier ledger takes its credits from payment rows only, so
      // without this backfill every historic purchase would read as unpaid.
      const payer = db.prepare(`
        SELECT id FROM users
        WHERE deleted_at IS NULL
        ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END, created_at ASC
        LIMIT 1
      `).get() as { id: string } | undefined;
      if (!payer) return;

      const deviceRow = db.prepare("SELECT value FROM settings WHERE key = 'device_id'").get() as { value?: string } | undefined;
      const deviceId = deviceRow?.value || 'MAIN';

      db.prepare(`
        INSERT INTO payments (
          id, supplier_id, direction, method, amount_paisa, type,
          user_id, device_id, created_at, updated_at
        )
        SELECT
          lower(hex(randomblob(16))),
          pu.supplier_id,
          'out',
          'cash',
          pu.paid_paisa,
          'supplier_payment',
          ?,
          ?,
          pu.created_at,
          pu.created_at
        FROM purchases pu
        WHERE pu.deleted_at IS NULL
          AND pu.paid_paisa > 0
          AND NOT EXISTS (
            SELECT 1 FROM payments pm
            WHERE pm.type = 'supplier_payment'
              AND pm.direction = 'out'
              AND pm.created_at = pu.created_at
              AND pm.amount_paisa = pu.paid_paisa
              AND (pm.supplier_id IS pu.supplier_id)
          );
      `).run(payer.id, deviceId);
    }
  },
  {
    id: '008_real_category_parents',
    name: 'Turn "Parent — Child" category names into a real hierarchy',
    ownTransaction: true,
    up: (db: Database.Database) => {
      /*
       * Subcategories were a naming convention: a child was a row called
       * "Batteries — Lead Acid". It read correctly and did nothing else -
       * renaming a parent left its children stranded under the old prefix, a
       * category whose own name held the separator was mistaken for a child,
       * and UNIQUE(name) meant two parents could never share a child name.
       *
       * The parent is a column now. Existing rows are converted: the prefix
       * becomes a real parent row, the child keeps only its leaf name.
       */
      const hasParent = (db.pragma('table_info(categories)') as { name: string }[])
        .some((c) => c.name === 'parent_id');

      const nameIsGloballyUnique = ((db.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'"
      ).get() as { sql: string } | undefined)?.sql || '').includes('name TEXT NOT NULL UNIQUE');

      if (nameIsGloballyUnique) {
        /*
         * The old UNIQUE is part of the column definition, so it lives in an
         * implicit index that cannot be dropped - the table has to be rebuilt.
         *
         * legacy_alter_table keeps RENAME from rewriting the foreign key in
         * products, which would otherwise be repointed at the temporary table
         * and left dangling once it is dropped. PRAGMA foreign_keys cannot help
         * here: it is ignored inside a transaction, and migrations run in one.
         */
        /*
         * Build the replacement first, then drop the original, then rename into
         * its place.
         *
         * Renaming the original out of the way instead - the obvious order -
         * makes SQLite repoint products.category_id at the temporary table, and
         * the reference is left dangling when that table goes. Renaming the new
         * table in has nothing pointing at it to rewrite, so products keeps
         * saying REFERENCES categories and finds this table when it is done.
         */
        db.exec(`
          CREATE TABLE categories_rebuilt (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT,
            device_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT,
            FOREIGN KEY (parent_id) REFERENCES categories(id)
          );

          INSERT INTO categories_rebuilt (id, name, parent_id, device_id, created_at, updated_at, deleted_at)
          SELECT id, name, ${hasParent ? 'parent_id' : 'NULL'}, device_id, created_at, updated_at, deleted_at
          FROM categories;

          DROP TABLE categories;
          ALTER TABLE categories_rebuilt RENAME TO categories;
        `);
      }

      /*
       * Unique per parent rather than across the whole table: "Front" can sit
       * under both Brake Pads and Mudguards, which a single global UNIQUE(name)
       * made impossible. IFNULL folds the top level into one bucket, since
       * SQLite counts every NULL as distinct and would otherwise allow two
       * top-level categories with the same name.
       *
       * Created here rather than in the baseline schema: the baseline runs
       * before the additive columns are reconciled, so on an older database
       * parent_id does not exist yet.
       */
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_name
          ON categories(IFNULL(parent_id, ''), name) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
      `);

      // --- convert the naming convention ---
      const SEPARATOR = ' \u2014 ';
      const rows = db
        .prepare("SELECT id, name FROM categories WHERE deleted_at IS NULL AND parent_id IS NULL")
        .all() as { id: string; name: string }[];

      const newId = () =>
        'cat-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

      const topLevel = new Map<string, string>();          // name -> id
      for (const row of rows) {
        if (!row.name.includes(SEPARATOR)) topLevel.set(row.name, row.id);
      }

      const now = new Date().toISOString();
      const insertParent = db.prepare(
        'INSERT INTO categories (id, name, parent_id, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)'
      );
      const promote = db.prepare('UPDATE categories SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?');
      const takenUnder = db.prepare(
        'SELECT id FROM categories WHERE IFNULL(parent_id, \'\') = ? AND name = ? AND deleted_at IS NULL'
      );

      for (const row of rows) {
        const at = row.name.indexOf(SEPARATOR);
        if (at === -1) continue;

        const parentName = row.name.slice(0, at).trim();
        const leafName = row.name.slice(at + SEPARATOR.length).trim();
        if (!parentName || !leafName) continue;

        let parentId = topLevel.get(parentName);
        if (!parentId) {
          parentId = newId();
          insertParent.run(parentId, parentName, now, now);
          topLevel.set(parentName, parentId);
        }

        // Two different prefixes can collapse onto the same leaf. Rather than
        // fail the whole migration, such a row keeps its full name and simply
        // stays where it is - visible, and fixable by hand.
        if (takenUnder.get(parentId!, leafName)) continue;

        promote.run(leafName, parentId!, now, row.id);
      }
    }
  },
  {
    id: '007_allow_other_payment_method',
    name: 'Allow a payment method of "other"',
    up: (db: Database.Database) => {
      /*
       * The till used to offer bKash, Nagad and Card as separate buttons. The
       * shop takes cash almost always and does not care which wallet the rest
       * arrived on, so those three are now one "Other payment method" - but a
       * CHECK constraint cannot be altered in SQLite, so the table is rebuilt.
       *
       * Nothing is reclassified: rows already recorded as bkash, nagad or card
       * keep those values, and the reports still show them.
       */
      const existing = (db.prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'payments'"
      ).get() as { sql: string } | undefined)?.sql || '';
      if (existing.includes("'other'")) return;

      /*
       * Views built on payments have to come down first: SQLite refuses to drop
       * a table a view still names, and the error it gives ("no such table")
       * points at the view rather than at the table being replaced.
       *
       * Their definitions are read back from sqlite_master rather than written
       * out here, so whatever an earlier migration left in place is what gets
       * restored - v_customer_due has already been rewritten once.
       */
      const dependentViews = (db.prepare(`
        SELECT name, sql FROM sqlite_master
        WHERE type = 'view' AND sql LIKE '%payments%'
      `).all() as { name: string; sql: string }[]);

      for (const view of dependentViews) {
        db.exec(`DROP VIEW IF EXISTS ${view.name};`);
      }

      // No PRAGMA foreign_keys here: it is a no-op inside a transaction, and
      // nothing references payments, so the rebuild needs no such escape.
      db.exec(`
        CREATE TABLE payments_rebuilt (
          id TEXT PRIMARY KEY,
          sale_id TEXT,
          customer_id TEXT,
          supplier_id TEXT,
          purchase_id TEXT,
          direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
          method TEXT NOT NULL CHECK(method IN ('cash', 'bkash', 'nagad', 'card', 'other')),
          amount_paisa INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('sale_payment', 'due_collection', 'refund', 'supplier_payment')),
          user_id TEXT NOT NULL,
          device_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          FOREIGN KEY (sale_id) REFERENCES sales(id),
          FOREIGN KEY (customer_id) REFERENCES customers(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );

        INSERT INTO payments_rebuilt
          (id, sale_id, customer_id, supplier_id, purchase_id, direction, method,
           amount_paisa, type, user_id, device_id, created_at, updated_at, deleted_at)
        SELECT id, sale_id, customer_id, supplier_id, purchase_id, direction, method,
               amount_paisa, type, user_id, device_id, created_at, updated_at, deleted_at
        FROM payments;

        DROP TABLE payments;
        ALTER TABLE payments_rebuilt RENAME TO payments;

        CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
        CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
        CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id, direction, type);
      `);

      for (const view of dependentViews) {
        if (view.sql) db.exec(view.sql + ';');
      }
    }
  },
  {
    id: '006_link_purchase_payments',
    name: 'Point existing supplier payments back at their purchase',
    up: (db: Database.Database) => {
      // payments.purchase_id is new, so rows written before it have to be
      // matched the only way they can be: a purchase writes its payment inside
      // the same transaction with the identical created_at stamp. Amount and
      // supplier must agree too, and anything ambiguous is left unlinked rather
      // than guessed at - an unlinked row simply blocks that bill from being
      // voided, which is safer than reversing the wrong payment.
      const candidates = db.prepare(`
        SELECT pm.id AS payment_id, pu.id AS purchase_id
        FROM payments pm
        JOIN purchases pu
          ON pu.created_at = pm.created_at
         AND pu.paid_paisa = pm.amount_paisa
         AND IFNULL(pu.supplier_id, '') = IFNULL(pm.supplier_id, '')
        WHERE pm.purchase_id IS NULL
          AND pm.direction = 'out'
          AND pm.type = 'supplier_payment'
          AND pm.deleted_at IS NULL
      `).all() as { payment_id: string; purchase_id: string }[];

      const seenPayment = new Map<string, number>();
      const seenPurchase = new Map<string, number>();
      for (const row of candidates) {
        seenPayment.set(row.payment_id, (seenPayment.get(row.payment_id) || 0) + 1);
        seenPurchase.set(row.purchase_id, (seenPurchase.get(row.purchase_id) || 0) + 1);
      }

      const link = db.prepare('UPDATE payments SET purchase_id = ? WHERE id = ?');
      for (const row of candidates) {
        if (seenPayment.get(row.payment_id) !== 1) continue;
        if (seenPurchase.get(row.purchase_id) !== 1) continue;
        link.run(row.purchase_id, row.payment_id);
      }
    }
  },
  {
    id: '005_hash_existing_pins',
    name: 'Hash login PINs that were stored as typed',
    up: (db: Database.Database) => {
      // PINs were kept in plain text, so every backup - including the copies
      // uploaded to Drive - carried working credentials for every account, and
      // the owner's PIN was visible in the users list. Anything that is not
      // already a bcrypt hash is rewritten as one here.
      const rows = db.prepare(
        "SELECT id, pin_code FROM users WHERE pin_code IS NOT NULL AND pin_code != ''"
      ).all() as { id: string; pin_code: string }[];

      const update = db.prepare('UPDATE users SET pin_code = ? WHERE id = ?');
      for (const row of rows) {
        if (/^\$2[aby]\$/.test(row.pin_code)) continue; // already hashed
        update.run(bcrypt.hashSync(row.pin_code, bcrypt.genSaltSync(10)), row.id);
      }
    }
  },
  {
    id: '009_drop_a5_invoice_paper',
    name: 'Move any shop set to A5 onto A4',
    up: (db: Database.Database) => {
      /*
       * A5 is no longer a paper the app knows about. A shop that had chosen it
       * would fall back to the 80mm default - silently swapping a full sheet
       * for a till roll, which is not a change anyone would want made for them
       * without being told. A4 is the nearer of the two.
       */
      db.prepare(
        "UPDATE settings SET value = 'a4', updated_at = ? WHERE key = 'default_invoice_layout' AND value = 'a5'"
      ).run(new Date().toISOString());
    }
  },
  {
    id: '010_rebatch_csv_imported_stock',
    name: 'Give unbatched stock a FIFO batch again',
    up: (db: Database.Database) => {
      /*
       * A repeat of 003, needed because the hole it patched stayed open.
       *
       * CSV import wrote opening stock to products.stock_qty and a stock
       * transaction, but never the inventory_batch that the single-product form
       * writes. 003 backfilled whatever existed when it ran; every import after
       * that put the same drift straight back. The import now creates the batch
       * itself, and this clears what the shops have accumulated meanwhile.
       *
       * Costed at the product's current cost price - the only figure anything
       * recorded for these units, and the one the valuation was already falling
       * back to. Products whose batches already add up are untouched, so this is
       * safe to run against a database that has no drift at all.
       */
      db.exec(`
        INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
        SELECT
          lower(hex(randomblob(16))),
          p.id,
          (p.stock_qty - COALESCE(b.batched_qty, 0)),
          (p.stock_qty - COALESCE(b.batched_qty, 0)),
          p.cost_price_paisa,
          p.created_at,
          'products',
          p.id
        FROM products p
        LEFT JOIN (
          SELECT product_id, SUM(remaining_qty) as batched_qty
          FROM inventory_batches
          GROUP BY product_id
        ) b ON p.id = b.product_id
        WHERE p.deleted_at IS NULL AND (p.stock_qty - COALESCE(b.batched_qty, 0)) > 0;
      `);
    }
  },
  {
    id: '011_encrypt_gdrive_refresh_token',
    name: 'Encrypt the Google Drive refresh token at rest',
    up: (db: Database.Database) => {
      /*
       * The Drive token was written exactly as Google returned it, while the
       * Supabase key beside it went through safeStorage. So a credential giving
       * standing access to the shop's Drive sat in plain text in shop.db - and
       * shop.db is uploaded to that same Drive, meaning every backup carried the
       * key to the account holding it. Anyone reading one backup could reach all
       * of them.
       *
       * A value that already decrypts is left alone, so this does no harm on a
       * database that has been through it, or on one connected after the fix.
       */
      const row = db
        .prepare("SELECT value FROM settings WHERE key = 'gdrive_refresh_token'")
        .get() as { value?: string } | undefined;
      if (!row?.value) return;

      if (decryptSecret(row.value)) return; // already encrypted

      const encrypted = encryptSecret(row.value);
      // encryptSecret returns '' only for empty input, but a write of '' here
      // would silently disconnect a shop's Drive rather than protect it.
      if (!encrypted) return;

      db.prepare("UPDATE settings SET value = ?, updated_at = ? WHERE key = 'gdrive_refresh_token'")
        .run(encrypted, new Date().toISOString());
    }
  },
  {
    id: '012_restore_initial_due_view',
    name: 'Restore v_customer_due to include initial_due_paisa after it was overwritten',
    up: (db: Database.Database) => {
      db.exec(`
        DROP VIEW IF EXISTS v_customer_due;
        CREATE VIEW v_customer_due AS
        SELECT 
          c.id AS customer_id,
          c.name,
          c.phone,
          COALESCE(sales_total.sum_sales, 0) AS total_sales_paisa,
          COALESCE(payments_total.sum_payments, 0) AS total_paid_paisa,
          (c.initial_due_paisa + COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa
        FROM customers c
        LEFT JOIN (
          SELECT s.customer_id, 
                 SUM(s.total_paisa - COALESCE((
                   SELECT SUM(ri.amount_paisa) 
                   FROM returns r 
                   JOIN return_items ri ON r.id = ri.return_id 
                   WHERE r.sale_id = s.id
                 ), 0)) AS sum_sales 
          FROM sales s
          WHERE s.deleted_at IS NULL AND s.customer_id IS NOT NULL AND s.status != 'held'
          GROUP BY s.customer_id
        ) sales_total ON c.id = sales_total.customer_id
        LEFT JOIN (
          SELECT p.customer_id, 
                 SUM(CASE WHEN p.direction = 'in' THEN p.amount_paisa ELSE -p.amount_paisa END) AS sum_payments 
          FROM payments p
          WHERE p.deleted_at IS NULL AND p.customer_id IS NOT NULL
          GROUP BY p.customer_id
        ) payments_total ON c.id = payments_total.customer_id
        WHERE c.deleted_at IS NULL;
      `);
    }
  }
];

/**
 * Columns added to already-existing tables as the schema grew. CREATE TABLE IF NOT
 * EXISTS cannot add these to a table that predates them, so they are reconciled
 * separately. Definitions must match the baseline schema above, and any default
 * must be a constant (SQLite restriction on ALTER TABLE ADD COLUMN).
 */
const ADDITIVE_COLUMNS: Record<string, Record<string, string>> = {
  users: {
      pin_code: 'TEXT',
    },
    customers: {
      initial_due_paisa: 'INTEGER NOT NULL DEFAULT 0',
    },
  sales: {
    previous_due_paid_paisa: 'INTEGER NOT NULL DEFAULT 0',
  },
  suppliers: {
    contact_person: 'TEXT',
    opening_balance_paisa: 'INTEGER NOT NULL DEFAULT 0',
    payment_terms_days: 'INTEGER',
    note: 'TEXT',
  },
  categories: {
    parent_id: 'TEXT',
  },
  purchases: {
    transport_paisa: 'INTEGER NOT NULL DEFAULT 0',
    transport_on_invoice: 'INTEGER NOT NULL DEFAULT 1',
  },
  payments: {
    supplier_id: 'TEXT',
    // Without this, the cash paid on a bill cannot be found again from the bill,
    // so a mistyped purchase could not be reversed without guessing which row
    // belonged to it.
    purchase_id: 'TEXT',
  },
  sale_items: {
    unit_cost_paisa: 'INTEGER',
  },
  stock_transactions: {
    unit_cost_paisa: 'INTEGER',
  },
  sync_state: {
    last_pushed_id: 'TEXT',
  },
  returns: {
    // Printed credit note number so a return can be reprinted like a sale invoice.
    return_invoice_no: 'TEXT',
    // Refund method recorded per-return so the credit note can print it.
    refund_method: 'TEXT',
  },
};

function reconcileColumns(db: Database.Database) {
  for (const [table, columns] of Object.entries(ADDITIVE_COLUMNS)) {
    const existing = new Set(
      (db.pragma(`table_info(${table})`) as { name: string }[]).map(c => c.name)
    );
    for (const [column, definition] of Object.entries(columns)) {
      if (!existing.has(column)) {
        console.log(`Adding missing column: ${table}.${column}`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      }
    }
  }
}

export function runMigrations(db: Database.Database) {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  // Bring the schema up to the current baseline before running versioned
  // migrations, so an older database gains any tables/columns those migrations
  // assume are already present.
  db.transaction(() => {
    applyBaseSchema(db);
    reconcileColumns(db);
  })();

  const appliedRows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
  const appliedSet = new Set(appliedRows.map(r => r.id));

  const insertMigration = db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)');

  const pending = MIGRATIONS.filter((m) => !appliedSet.has(m.id));

  // Everything that can share a transaction does, so a failure rolls the whole
  // batch back.
  db.transaction(() => {
    for (const migration of pending) {
      if (migration.ownTransaction) continue;
      console.log(`Applying DB migration: ${migration.id} - ${migration.name}`);
      migration.up(db);
      insertMigration.run(migration.id, new Date().toISOString());
    }
  })();

  for (const migration of pending) {
    if (!migration.ownTransaction) continue;
    console.log(`Applying DB migration: ${migration.id} - ${migration.name}`);
    db.pragma('foreign_keys = OFF');
    try {
      db.exec('BEGIN');
      try {
        migration.up(db);
        insertMigration.run(migration.id, new Date().toISOString());
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      // Nothing may be left dangling by a table rebuild.
      const violations = db.pragma('foreign_key_check') as unknown[];
      if (violations.length > 0) {
        throw new Error(
          `Migration ${migration.id} left ${violations.length} foreign key violation(s); database unchanged is not possible at this point.`
        );
      }
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }
}
