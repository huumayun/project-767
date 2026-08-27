import Database from 'better-sqlite3';

export interface Migration {
  id: string;
  name: string;
  up: (db: Database.Database) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    id: '001_initial_schema',
    name: 'Initial Schema Migration for Mechanical Shop POS',
    up: (db: Database.Database) => {
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
      `);

      // 2. Users Table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('owner', 'staff')),
          password_hash TEXT NOT NULL,
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
          name TEXT NOT NULL UNIQUE,
          device_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
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

      // 7. Customers Table (NO STORED total_due)
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
          deleted_at TEXT
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
          direction TEXT NOT NULL CHECK(direction IN ('in', 'out')),
          method TEXT NOT NULL CHECK(method IN ('cash', 'bkash', 'nagad', 'card')),
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
      `);

      // 10. Stock Transactions Ledger
      db.exec(`
        CREATE TABLE IF NOT EXISTS stock_transactions (
          id TEXT PRIMARY KEY,
          product_id TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('purchase', 'sale', 'return_in', 'return_out', 'adjustment', 'initial')),
          qty_delta INTEGER NOT NULL,
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
          last_pulled_at TEXT
        );
      `);

      // VIEWS
      // v_customer_due: derived total sales minus total payments in
      db.exec(`
        CREATE VIEW IF NOT EXISTS v_customer_due AS
        SELECT 
          c.id AS customer_id,
          c.name,
          c.phone,
          COALESCE(sales_total.sum_sales, 0) AS total_sales_paisa,
          COALESCE(payments_total.sum_payments, 0) AS total_paid_paisa,
          (COALESCE(sales_total.sum_sales, 0) - COALESCE(payments_total.sum_payments, 0)) AS due_paisa
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

      // v_daily_sales: daily aggregated metrics
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

      // v_product_profit: calculate profit per product
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

      // v_stock_valuation: stock quantity and total asset value
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
  },
  {
    id: '002_fix_overtender_cash_change',
    name: 'Adjust overtendered cash payment rows to net cash received',
    up: (db: Database.Database) => {
      // Find all completed sales where sum of 'in' payments exceeds sale total_paisa
      const overpaidSales = db.prepare(`
        SELECT s.id, s.total_paisa, SUM(p.amount_paisa) as total_in
        FROM sales s
        JOIN payments p ON p.sale_id = s.id AND p.direction = 'in' AND p.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
        GROUP BY s.id
        HAVING total_in > s.total_paisa
      `).all() as { id: string; total_paisa: number; total_in: number }[];

      for (const sale of overpaidSales) {
        const excessPaisa = sale.total_in - sale.total_paisa;
        const cashPayment = db.prepare(`
          SELECT id, amount_paisa FROM payments
          WHERE sale_id = ? AND direction = 'in' AND method = 'cash' AND deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        `).get(sale.id) as { id: string; amount_paisa: number } | undefined;

        if (cashPayment) {
          const newAmount = Math.max(0, cashPayment.amount_paisa - excessPaisa);
          db.prepare('UPDATE payments SET amount_paisa = ? WHERE id = ?').run(newAmount, cashPayment.id);
        }
      }
    }
  },
  {
    id: '003_vendor_accounting',
    name: 'Cost snapshot on sale items, landed cost on purchases, supplier detail fields',
    up: (db: Database.Database) => {
      const hasColumn = (table: string, column: string) =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
          (c) => c.name === column
        );

      // Profit was read from products.cost_price_paisa, which every purchase
      // overwrites — so a price rise silently rewrote the profit on sales that
      // had already happened. Cost is now snapshotted on the line at sale time.
      // Left nullable on purpose: rows written before this migration have no
      // truthful value, and inventing one would fake the history. Reporting
      // falls back to the product's current cost when it is NULL.
      if (!hasColumn('sale_items', 'unit_cost_paisa')) {
        db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost_paisa INTEGER');
      }

      // Delivery/transport charged on a purchase invoice. Kept as its own
      // column so it can be reported on, and apportioned across the items so
      // stock carries its true landed cost.
      if (!hasColumn('purchases', 'transport_paisa')) {
        db.exec('ALTER TABLE purchases ADD COLUMN transport_paisa INTEGER NOT NULL DEFAULT 0');
      }

      if (!hasColumn('suppliers', 'contact_person')) {
        db.exec('ALTER TABLE suppliers ADD COLUMN contact_person TEXT');
      }
      if (!hasColumn('suppliers', 'opening_balance_paisa')) {
        db.exec('ALTER TABLE suppliers ADD COLUMN opening_balance_paisa INTEGER NOT NULL DEFAULT 0');
      }
      if (!hasColumn('suppliers', 'payment_terms_days')) {
        db.exec('ALTER TABLE suppliers ADD COLUMN payment_terms_days INTEGER');
      }
      if (!hasColumn('suppliers', 'note')) {
        db.exec('ALTER TABLE suppliers ADD COLUMN note TEXT');
      }

      // payments only had customer_id; a supplier payment has nowhere truthful
      // to live without its own column (customer_id carries an FK to customers).
      if (!hasColumn('payments', 'supplier_id')) {
        db.exec('ALTER TABLE payments ADD COLUMN supplier_id TEXT');
      }

      db.exec(
        'CREATE INDEX IF NOT EXISTS idx_payments_supplier ON payments(supplier_id, direction, type)'
      );
    }
  },
  {
    id: '004_transport_payee',
    name: 'Record whether a purchase transport charge was billed by the vendor',
    up: (db: Database.Database) => {
      const hasColumn = (table: string, column: string) =>
        (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some(
          (c) => c.name === column
        );

      // Transport is always part of the landed cost of the goods, but it is
      // not always owed to the vendor: a delivery charge printed on their
      // challan is, a pickup van the shop hires itself is not. Treating the
      // second kind as vendor money inflates the payable and leaves the
      // ledger short by exactly the fare. Default 1 keeps the rows written
      // before this migration reading the way they were entered.
      if (!hasColumn('purchases', 'transport_on_invoice')) {
        db.exec(
          'ALTER TABLE purchases ADD COLUMN transport_on_invoice INTEGER NOT NULL DEFAULT 1'
        );
      }
    }
  }
];

export function runMigrations(db: Database.Database) {
  // Ensure migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM migrations').all() as { id: string }[];
  const appliedSet = new Set(appliedRows.map(r => r.id));

  const insertMigration = db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)');

  db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (!appliedSet.has(migration.id)) {
        console.log(`Applying DB migration: ${migration.id} - ${migration.name}`);
        migration.up(db);
        insertMigration.run(migration.id, new Date().toISOString());
      }
    }
  })();
}
