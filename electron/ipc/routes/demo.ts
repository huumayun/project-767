import { ipcMain, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { requireRole, logAudit } from '../shared';

/*
 * Sample data, for developing and demonstrating the app - never for a shop.
 *
 * This used to be offered everywhere, to everyone: a button in Settings with no
 * confirmation, and a box in the setup wizard that came ticked. A new shop that
 * clicked through setup opened for business with ten fake parts, three fake
 * workshop customers and two fake suppliers already in its books, and they
 * turned up in every report from then on. Seeding a shop that was already
 * trading was worse: INSERT OR REPLACE overwrote rows by id, and every run added
 * another set of stock batches on top of the last, doubling what the FIFO
 * valuation believed was on the shelf.
 *
 * So: development builds only, and only into an empty shop. Erasing business
 * data (routes/data.ts) is the way back to empty.
 */

type DemoProduct = {
  barcode: string;
  name: string;
  category: 'engine' | 'brake' | 'electrical';
  brand: string;
  unit: string;
  cost: number;
  sell: number;
  stock: number;
  threshold: number;
};

const DEMO_PRODUCTS: DemoProduct[] = [
  { barcode: '8901001', name: 'Piston Ring Set Standard', category: 'engine', brand: 'Mahle', unit: 'set', cost: 120000, sell: 175000, stock: 25, threshold: 5 },
  { barcode: '8901002', name: 'Spark Plug BP6EY Iridium', category: 'electrical', brand: 'NGK', unit: 'pcs', cost: 18000, sell: 28000, stock: 60, threshold: 10 },
  { barcode: '8901003', name: 'Front Brake Pad Heavy Duty', category: 'brake', brand: 'Bosch', unit: 'set', cost: 85000, sell: 135000, stock: 20, threshold: 4 },
  { barcode: '8901004', name: 'Clutch Plate 190mm', category: 'engine', brand: 'Exedy', unit: 'pcs', cost: 240000, sell: 350000, stock: 12, threshold: 3 },
  { barcode: '8901005', name: 'Engine Oil 20W-50 4L', category: 'electrical', brand: 'Castrol', unit: 'box', cost: 165000, sell: 220000, stock: 30, threshold: 6 },
  { barcode: '8901006', name: 'Wheel Ball Bearing 6204-2RS', category: 'brake', brand: 'SKF', unit: 'pcs', cost: 32000, sell: 55000, stock: 45, threshold: 8 },
  { barcode: '8901007', name: 'Oil Filter Spin-On', category: 'electrical', brand: 'Denso', unit: 'pcs', cost: 25000, sell: 42000, stock: 40, threshold: 8 },
  { barcode: '8901008', name: 'Timing Belt 123 Teeth', category: 'engine', brand: 'Gates', unit: 'pcs', cost: 95000, sell: 155000, stock: 15, threshold: 3 },
  { barcode: '8901009', name: 'Full Cylinder Head Gasket', category: 'engine', brand: 'Payen', unit: 'pcs', cost: 110000, sell: 180000, stock: 18, threshold: 4 },
  { barcode: '8901010', name: 'Fuel Injector Nozzle Assembly', category: 'electrical', brand: 'Bosch', unit: 'set', cost: 380000, sell: 540000, stock: 8, threshold: 2 },
];

export function sampleDataAvailable(): boolean {
  return !app.isPackaged;
}

export function registerDemoHandlers() {
  ipcMain.handle('api:demo:seed', async () => {
    if (!sampleDataAvailable()) {
      throw new Error('Sample data is not available in the installed app.');
    }

    const db = getDb();
    // Callable before setup finishes, so the wizard can offer it; after that,
    // the owner only.
    const setupDone = db.prepare("SELECT value FROM settings WHERE key = 'first_run_completed'").get() as any;
    if (setupDone?.value === '1') requireRole(['owner']);

    const existing = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM products)   AS products,
        (SELECT COUNT(*) FROM categories) AS categories,
        (SELECT COUNT(*) FROM customers)  AS customers,
        (SELECT COUNT(*) FROM suppliers)  AS suppliers,
        (SELECT COUNT(*) FROM sales)      AS sales,
        (SELECT COUNT(*) FROM purchases)  AS purchases
    `).get() as Record<string, number>;
    if (Object.values(existing).some((n) => n > 0)) {
      throw new Error(
        'Sample data can only be loaded into an empty shop, and this one already has records. ' +
          'Erase the business data first if this is a test database.'
      );
    }

    // stock_transactions.user_id must name a real user; before setup nobody is
    // logged in, so the stock is booked to the owner the install created.
    const owner = db
      .prepare("SELECT id FROM users WHERE role = 'owner' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1")
      .get() as { id: string } | undefined;
    if (!owner) throw new Error('No owner account exists to record the sample stock against.');

    const now = new Date().toISOString();
    const categoryIds = { engine: uuidv7(), brake: uuidv7(), electrical: uuidv7() };

    db.transaction(() => {
      const insertCategory = db.prepare('INSERT INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)');
      insertCategory.run(categoryIds.engine, 'Engine & Transmission', now, now);
      insertCategory.run(categoryIds.brake, 'Brake & Suspension', now, now);
      insertCategory.run(categoryIds.electrical, 'Electrical & Filters', now, now);

      const insertProduct = db.prepare(`
        INSERT INTO products (id, barcode, name, category_id, brand, unit, cost_price_paisa, sell_price_paisa,
                              stock_qty, low_stock_threshold, is_serial_tracked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);
      // Opening stock the way the product form writes it: a batch for FIFO, and
      // a stock transaction so Stock History shows where the units came from.
      const insertBatch = db.prepare(`
        INSERT INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'products', ?)
      `);
      const insertStockTx = db.prepare(`
        INSERT INTO stock_transactions (id, product_id, type, qty_delta, ref_table, ref_id, reason, user_id, created_at, updated_at, unit_cost_paisa)
        VALUES (?, ?, 'initial', ?, 'products', ?, 'Sample data', ?, ?, ?, ?)
      `);

      for (const p of DEMO_PRODUCTS) {
        const id = uuidv7();
        insertProduct.run(id, p.barcode, p.name, categoryIds[p.category], p.brand, p.unit, p.cost, p.sell, p.stock, p.threshold, now, now);
        insertBatch.run(id, p.stock, p.stock, p.cost, now, id);
        insertStockTx.run(uuidv7(), id, p.stock, id, owner.id, now, now, p.cost);
      }

      const insertCustomer = db.prepare(
        'INSERT INTO customers (id, name, phone, address, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      insertCustomer.run(uuidv7(), 'Master Kamal Auto Workshop', '01712-345678', 'Tejgaon Industrial Area, Dhaka', 'Sample customer', now, now);
      insertCustomer.run(uuidv7(), 'Rasel CNG Garage', '01819-876543', 'Mirpur-10, Dhaka', 'Sample customer', now, now);
      insertCustomer.run(uuidv7(), 'Faruk Bike Care Point', '01911-223344', 'Nawabpur, Old Dhaka', 'Sample customer', now, now);

      const insertSupplier = db.prepare(
        'INSERT INTO suppliers (id, name, phone, address, total_payable_paisa, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)'
      );
      insertSupplier.run(uuidv7(), 'Dhaka Motor Spares Importer', '01700-112233', 'Banglamotor, Dhaka', now, now);
      insertSupplier.run(uuidv7(), 'Chittagong Bearing & Belts Ltd.', '01800-445566', 'Jubilee Road, Chattogram', now, now);
    })();

    logAudit('DEMO_DATA_SEEDED', 'system', undefined, { products: DEMO_PRODUCTS.length, customers: 3, suppliers: 2 });
    return { success: true, count: DEMO_PRODUCTS.length };
  });
}
