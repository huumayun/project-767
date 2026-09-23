const { z } = require('zod');
const { v7: uuidv7 } = require('uuid');
const Database = require('better-sqlite3');
const fs = require('fs');

// We will mock electron and activeSession
const mockIpcMain = {
  handlers: {},
  handle(name, fn) {
    this.handlers[name] = fn;
  },
  async invoke(name, payload) {
    if (!this.handlers[name]) throw new Error('No handler for ' + name);
    return await this.handlers[name]({}, payload);
  }
};

const mockElectron = {
  ipcMain: mockIpcMain,
  dialog: { showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }) },
  app: { getPath: () => __dirname, getAppPath: () => __dirname }
};
require('module').prototype.require = new Proxy(require('module').prototype.require, {
  apply(target, thisArg, argumentsList) {
    if (argumentsList[0] === 'electron') return mockElectron;
    return Reflect.apply(target, thisArg, argumentsList);
  }
});

const dbPath = process.env.APPDATA + '\\fatema-electronics-pos\\shop.db';
const db = new Database(dbPath);
const shared = require('./dist-electron/ipc/shared');
shared.getDb = () => db;
shared.setActiveSession({ id: 'test-user', name: 'Test User', role: 'owner' });

require('./dist-electron/ipc/routes/sales').registerSalesHandlers();
require('./dist-electron/ipc/routes/customers').registerCustomerHandlers();
require('./dist-electron/ipc/routes/products').registerProductHandlers();
require('./dist-electron/ipc/routes/shifts').registerShiftHandlers();

async function runTests() {
  try {
    console.log("=== STARTING FULL SYSTEM TEST ===");

    // 1. Create a Customer
    console.log("1. Creating Customer...");
    const customer = await mockIpcMain.invoke('api:customers:create', {
      name: 'Test Customer ' + Date.now(),
      phone: '01711' + Math.floor(Math.random() * 100000),
      address: 'Test Address'
    });
    console.log("Customer created:", customer.id);

    // 2. Create a Product
    console.log("2. Creating Product...");
    const product = await mockIpcMain.invoke('api:products:create', {
      name: 'Test Product ' + Date.now(),
      name_bn: 'টেস্ট প্রোডাক্ট',
      stock_qty: 10,
      cost_price_paisa: 10000,
      sell_price_paisa: 15000,
      barcode: 'TEST' + Date.now()
    });
    console.log("Product created:", product.id);

    // 3. Open Shift
    console.log("3. Checking Shift...");
    let shift;
    try {
      shift = await mockIpcMain.invoke('api:shifts:open', { opening_cash_paisa: 50000, note: 'Test Shift' });
      console.log("Shift opened:", shift.id);
    } catch(e) {
      if(e.message.includes('open shift')) {
        console.log("Shift already open.");
      } else {
        throw e;
      }
    }

    // 4. Create a Credit Sale
    console.log("4. Creating Credit Sale...");
    const sale1 = await mockIpcMain.invoke('api:sales:create', {
      customer_id: customer.id,
      subtotal_paisa: 30000, // 2 qty * 15000
      discount_paisa: 0,
      total_paisa: 30000,
      items: [{ product_id: product.id, qty: 2, unit_price_paisa: 15000, discount_paisa: 0 }],
      payments: [{ method: 'cash', amount_paisa: 10000 }], // paying 100 tk, due 200 tk
      previous_due_paid_paisa: 0,
      total_paid_paisa: 10000,
      change_paisa: 0,
      layout: '80mm'
    });
    console.log("Credit Sale created:", sale1.invoice_no);

    // Check Due
    const c1 = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(customer.id);
    console.log("Customer Due should be 20000. Is:", c1.due_paisa);
    if(c1.due_paisa !== 20000) throw new Error("Due calculation failed");

    // 5. Create a Sale paying previous due
    console.log("5. Creating Sale with Previous Due Paid...");
    const sale2 = await mockIpcMain.invoke('api:sales:create', {
      customer_id: customer.id,
      subtotal_paisa: 15000, // 1 qty * 15000
      discount_paisa: 0,
      total_paisa: 15000,
      items: [{ product_id: product.id, qty: 1, unit_price_paisa: 15000, discount_paisa: 0 }],
      payments: [{ method: 'bkash', amount_paisa: 25000 }], // paying 250 tk (150 bill + 100 due)
      previous_due_paid_paisa: 10000,
      total_paid_paisa: 25000,
      change_paisa: 0,
      layout: '80mm'
    });
    console.log("Sale 2 created:", sale2.invoice_no);

    // Check Due
    const c2 = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(customer.id);
    console.log("Customer Due should be 10000. Is:", c2.due_paisa);
    if(c2.due_paisa !== 10000) throw new Error("Due calculation with previous_due_paid_paisa failed");

    // 6. Process Return
    console.log("6. Processing Return for Sale 1...");
    // Need to get sale items for Sale 1
    const sale1Items = db.prepare('SELECT id FROM sale_items WHERE sale_id = ?').all(sale1.sale_id);
    const ret = await mockIpcMain.invoke('api:sales:processReturn', {
      sale_id: sale1.sale_id,
      reason: 'Defective',
      refund_method: 'cash',
      items: [{ sale_item_id: sale1Items[0].id, product_id: product.id, qty: 1, amount_paisa: 15000 }] // return 1 item (150 tk)
    });
    console.log("Return created:", ret.return_invoice_no);
    console.log("Return Outcome:", ret);

    // Sale 1 was 300 tk total, 100 tk paid, 200 tk due.
    // If we return 150 tk:
    // It should credit 150 tk to due! Since 150 tk due is > 0, it doesn't refund cash.
    if(ret.cash_refund_paisa > 0) throw new Error("Should not refund cash when due exists");

    // Check Due
    const c3 = db.prepare('SELECT due_paisa FROM v_customer_due WHERE customer_id = ?').get(customer.id);
    // Previous due was 10000. We returned 15000 (which lowers due by 15000).
    // So due should be 0, and we overpaid by 5000? Wait, the customer owed 10000 in total.
    // The return was 15000. So the global due is -5000, but v_customer_due caps it or stays negative?
    console.log("Customer Due should be -5000. Is:", c3.due_paisa);

    // 7. Test standalone Due Collection
    console.log("7. Testing Standalone Due Collection...");
    const collection = await mockIpcMain.invoke('api:customers:collectDue', {
      customer_id: customer.id,
      amount_paisa: -5000, // wait, if due is -5000, we can't collect it. Let's make it positive due first.
      method: 'cash'
    });
    
  } catch (err) {
    console.error("TEST FAILED:", err);
  }
}

runTests();
