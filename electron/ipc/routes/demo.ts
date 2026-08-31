import { ipcMain, dialog, app } from 'electron';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import { activeSession, setActiveSession, requireRole, getDeviceId, logAudit } from '../shared';

export function registerDemoHandlers() {
  
  ipcMain.handle('api:demo:seed', async () => {
      const db = getDb();
      const already = db.prepare("SELECT value FROM settings WHERE key = 'first_run_completed'").get() as any;
      if (already?.value === '1') {
        requireRole(['owner']);
      }
      const now = new Date().toISOString();
      const userId = activeSession?.id || null;
  
      db.transaction(() => {
        // 1. Categories
        const catEngineId = 'cat-engine-001';
        const catBrakeId = 'cat-brake-002';
        const catElecId = 'cat-elec-003';
  
        const insertCat = db.prepare(`
          INSERT OR IGNORE INTO categories (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)
        `);
        insertCat.run(catEngineId, 'Engine & Transmission', now, now);
        insertCat.run(catBrakeId, 'Brake & Suspension', now, now);
        insertCat.run(catElecId, 'Electrical & Filters', now, now);
  
        // 2. 10 Mechanical Products
        const demoProducts = [
          { id: 'p-001', barcode: '8901001', name: 'Piston Ring Set Standard', name_bn: '?????? ??? ???', cat: catEngineId, brand: 'Mahle', unit: 'set', cost: 120000, sell: 175000, stock: 25, thresh: 5 },
          { id: 'p-002', barcode: '8901002', name: 'Spark Plug BP6EY Iridium', name_bn: '??????? ????? ????????', cat: catElecId, brand: 'NGK', unit: 'pcs', cost: 18000, sell: 28000, stock: 60, thresh: 10 },
          { id: 'p-003', barcode: '8901003', name: 'Front Brake Pad Heavy Duty', name_bn: '?????? ????? ?????', cat: catBrakeId, brand: 'Bosch', unit: 'set', cost: 85000, sell: 135000, stock: 20, thresh: 4 },
          { id: 'p-004', barcode: '8901004', name: 'Clutch Plate 190mm', name_bn: '????? ?????', cat: catEngineId, brand: 'Exedy', unit: 'pcs', cost: 240000, sell: 350000, stock: 12, thresh: 3 },
          { id: 'p-005', barcode: '8901005', name: 'Engine Oil 20W-50 4L', name_bn: '???? ?????? ???? ? ?????', cat: catElecId, brand: 'Castrol', unit: 'box', cost: 165000, sell: 220000, stock: 30, thresh: 6 },
          { id: 'p-006', barcode: '8901006', name: 'Wheel Ball Bearing 6204-2RS', name_bn: '???? ???????', cat: catBrakeId, brand: 'SKF', unit: 'pcs', cost: 32000, sell: 55000, stock: 45, thresh: 8 },
          { id: 'p-007', barcode: '8901007', name: 'Oil Filter Spin-On', name_bn: '???? ???????', cat: catElecId, brand: 'Denso', unit: 'pcs', cost: 25000, sell: 42000, stock: 40, thresh: 8 },
          { id: 'p-008', barcode: '8901008', name: 'Timing Belt 123 Teeth', name_bn: '?????? ?????', cat: catEngineId, brand: 'Gates', unit: 'pcs', cost: 95000, sell: 155000, stock: 15, thresh: 3 },
          { id: 'p-009', barcode: '8901009', name: 'Full Cylinder Head Gasket', name_bn: '??? ????????', cat: catEngineId, brand: 'Payen', unit: 'pcs', cost: 110000, sell: 180000, stock: 18, thresh: 4 },
          { id: 'p-010', barcode: '8901010', name: 'Fuel Injector Nozzle Assembly', name_bn: '????? ???????? ????', cat: catElecId, brand: 'Bosch', unit: 'set', cost: 380000, sell: 540000, stock: 8, thresh: 2 },
        ];
  
        const insertProd = db.prepare(`
        INSERT OR REPLACE INTO products (id, barcode, name, name_bn, category_id, brand, unit, cost_price_paisa, sell_price_paisa, stock_qty, low_stock_threshold, is_serial_tracked, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `);

      const insertBatch = db.prepare(`
        INSERT OR REPLACE INTO inventory_batches (id, product_id, initial_qty, remaining_qty, cost_price_paisa, received_at, ref_table, ref_id)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'demo_seed', 'demo_seed')
      `);

      for (const p of demoProducts) {
        insertProd.run(p.id, p.barcode, p.name, p.name_bn, p.cat, p.brand, p.unit, p.cost, p.sell, p.stock, p.thresh, now, now);
        if (p.stock > 0) {
          insertBatch.run(p.id, p.stock, p.stock, p.cost, now);
        }
      }
  
        // 3. 3 Demo Customers
        const insertCust = db.prepare(`
          INSERT OR REPLACE INTO customers (id, name, phone, address, note, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertCust.run('cust-001', 'Master Kamal Auto Workshop', '01712-345678', 'Tejgaon Industrial Area, Dhaka', 'Regular monthly credit client', now, now);
        insertCust.run('cust-002', 'Rasel CNG Garage', '01819-876543', 'Mirpur-10, Dhaka', 'Settles due every Thursday', now, now);
        insertCust.run('cust-003', 'Faruk Bike Care Point', '01911-223344', 'Nawabpur, Old Dhaka', 'Quick repair shop', now, now);
  
        // 4. 2 Demo Suppliers
        const insertSup = db.prepare(`
          INSERT OR REPLACE INTO suppliers (id, name, phone, address, total_payable_paisa, created_at, updated_at)
          VALUES (?, ?, ?, ?, 0, ?, ?)
        `);
        insertSup.run('sup-001', 'Dhaka Motor Spares Importer', '01700-112233', 'Banglamotor, Dhaka', now, now);
        insertSup.run('sup-002', 'Chittagong Bearing & Belts Ltd.', '01800-445566', 'Jubilee Road, Chattogram', now, now);
      })();
  
      logAudit('DEMO_DATA_SEEDED', 'system', undefined, { productCount: 10, customerCount: 3 });
      return { success: true, count: 10 };
    });

  ipcMain.handle('api:demo:reset', async () => {
      requireRole(['owner']);
      const db = getDb();
      const now = new Date().toISOString();
  
      db.transaction(() => {
        db.prepare('DELETE FROM shift_cash_transactions').run();
        db.prepare('DELETE FROM shifts').run();
        db.prepare('DELETE FROM sale_item_batches').run();
        db.prepare('DELETE FROM inventory_batches').run();
        db.prepare('DELETE FROM serial_numbers').run();
        db.prepare('DELETE FROM return_items').run();
        db.prepare('DELETE FROM returns').run();
        db.prepare('DELETE FROM payments').run();
        db.prepare('DELETE FROM sale_items').run();
        db.prepare('DELETE FROM sales').run();
        db.prepare('DELETE FROM purchase_items').run();
        db.prepare('DELETE FROM purchases').run();
        db.prepare('DELETE FROM stock_transactions').run();
        db.prepare('DELETE FROM products').run();
        db.prepare('DELETE FROM categories').run();
        db.prepare('DELETE FROM customers').run();
        db.prepare('DELETE FROM suppliers').run();
        db.prepare('DELETE FROM sync_state').run();
      })();
  
      logAudit('DATABASE_CLEAN_RESET', 'system', undefined, { timestamp: now });
      return { success: true };
    });

}
