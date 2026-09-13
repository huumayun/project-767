/**
 * TEMPORARY layout-preview harness — not part of the app.
 *
 * Stubs window.api so the real components render in a plain browser, which is
 * the only way to look at this UI without the packaged Electron build and a
 * live database. Not reachable from index.html, so it never enters the build.
 * Delete this file and pos-preview.html when finished.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 20 groups, each with 2 children, wired through parent_id the way the schema
// now stores them. 60 rows in total, which is what the till has to cope with.
const GROUPS: Array<[string, string, string]> = [
  ['Filters', 'Oil Filters', 'Air Filters'],
  ['Brake System', 'Brake Pads', 'Brake Discs'],
  ['Engine Oil', 'Synthetic', 'Mineral'],
  ['Ignition', 'Spark Plugs', 'Ignition Coils'],
  ['Suspension', 'Shock Absorbers', 'Bushings'],
  ['Transmission', 'Clutch Parts', 'Gear Oil'],
  ['Cooling System', 'Radiators', 'Coolant'],
  ['Electrical', 'Alternators', 'Starter Motors'],
  ['Belts & Chains', 'Timing Belts', 'Drive Chains'],
  ['Bearings', 'Wheel Bearings', 'Engine Bearings'],
  ['Lighting', 'Headlamps', 'Indicators'],
  ['Body Parts', 'Mirrors', 'Mudguards'],
  ['Fuel System', 'Fuel Pumps', 'Injectors'],
  ['Exhaust', 'Silencers', 'Manifolds'],
  ['Steering', 'Tie Rods', 'Ball Joints'],
  ['Wipers & Washers', 'Wiper Blades', 'Washer Pumps'],
  ['Batteries', 'Lead Acid', 'Maintenance Free'],
  ['Gaskets & Seals', 'Head Gaskets', 'Oil Seals'],
  ['Tools & Consumables', 'Hand Tools', 'Lubricants'],
  ['Tyres & Tubes', 'Tyres', 'Tubes'],
];

const CATEGORIES: Array<{ id: string; name: string; parent_id: string | null }> = [];
GROUPS.forEach(([parent, a, b], i) => {
  CATEGORIES.push({ id: `cat-${i}-0`, name: parent, parent_id: null });
  CATEGORIES.push({ id: `cat-${i}-1`, name: a, parent_id: `cat-${i}-0` });
  CATEGORIES.push({ id: `cat-${i}-2`, name: b, parent_id: `cat-${i}-0` });
});

const BRANDS = ['Bosch', 'Denso', 'NGK', 'SKF', 'TVS', 'Gates', 'Mahle', 'Exide', 'Castrol', 'Motul'];
const FITMENTS = ['Hero Splendor', 'Bajaj Pulsar 150', 'TVS Apache', 'Toyota Corolla', 'Suzuki Alto', 'Hiace Van', 'Mahindra Bolero'];
const SPECS = ['STD', 'HD', 'OE Spec', '4-pin', '12V', 'Front', 'Rear', 'Long Life'];

// 200 products, weighted onto the child categories the way real stock is.
const PRODUCTS = Array.from({ length: 200 }, (_, i) => {
  const g = i % GROUPS.length;
  const childIdx = i % 3 === 0 ? 0 : (i % 2) + 1; // some sit on the parent
  const cat = CATEGORIES.find((c) => c.id === `cat-${g}-${childIdx}`)!;
  const leaf = cat.name;
  const singular = leaf.endsWith('s') ? leaf.slice(0, -1) : leaf;
  const brand = BRANDS[i % BRANDS.length];
  const sell = 12000 + ((i * 7919) % 480000); // ৳120 – ৳4,920, plus a few big ones
  return {
    id: `p-${i}`,
    barcode: `89012${String(340000 + i * 7)}`,
    name: `${singular} — ${brand} ${SPECS[i % SPECS.length]} · ${FITMENTS[i % FITMENTS.length]}`,
    name_bn: null,
    category_id: cat.id,
    category_name: cat.name,
    brand,
    unit: i % 9 === 0 ? 'set' : 'pcs',
    cost_price_paisa: Math.round(sell * 0.72),
    sell_price_paisa: i % 23 === 0 ? sell + 900000 : sell, // a few ৳10k+ lines
    stock_qty: i % 13 === 0 ? 0 : (i % 17) + 1,
    low_stock_threshold: 5,
    is_serial_tracked: 0,
  };
});

// The picker was built for thousands; give it thousands.
const FIRST = ['Karim', 'Rahim', 'Shahin', 'Jashim', 'Nasir', 'Babul', 'Rubel', 'Faruk', 'Sohel', 'Mizan'];
const KIND = ['Auto Workshop', 'Motors', 'Garage', 'Service Centre', 'Auto Parts', 'Engineering Works', 'Car Care'];
const CUSTOMERS = Array.from({ length: 1200 }, (_, i) => ({
  id: `c-${i}`,
  name: `${FIRST[i % FIRST.length]} ${KIND[i % KIND.length]}${i > 69 ? ` ${Math.floor(i / 70) + 1}` : ''}`,
  phone: `01${(7 + (i % 3))}${String(10000000 + i * 137).slice(0, 2)}-${String(100000 + ((i * 977) % 900000))}`,
  due_paisa: i % 4 === 0 ? (i % 9) * 55000 : 0,
}));

const heldItems = (from: number, count: number) =>
  PRODUCTS.slice(from, from + count).map((p) => ({
    product_id: p.id,
    name: p.name,
    qty: (p.stock_qty % 3) + 1,
    unit_price_paisa: p.sell_price_paisa,
    available_stock: p.stock_qty,
    unit: p.unit,
  }));

const HELD = [
  { id: 'h-1', invoice_no: 'HOLD-0012', created_at: new Date().toISOString(),
    detail: { customerName: CUSTOMERS[0].name, cartData: heldItems(0, 14) } },
  { id: 'h-2', invoice_no: 'HOLD-0013', created_at: new Date().toISOString(),
    detail: { cartData: heldItems(30, 4) } },
  { id: 'h-3', invoice_no: 'HOLD-0014', created_at: new Date().toISOString(),
    detail: { customerName: CUSTOMERS[7].name, cartData: heldItems(50, 22) } },
];

(window as any).api = {
  ping: () => Promise.resolve('pong'),
  auth: {
    login: () => Promise.resolve({ success: true, session: { id: 'u-1', name: 'Rafiq Uddin', username: 'rafiq', role: 'owner' } }),
    pinLogin: () => Promise.resolve({ success: true, session: { id: 'u-1', name: 'Rafiq Uddin', username: 'rafiq', role: 'owner' } }),
    getSession: () => Promise.resolve({ id: 'u-1', name: 'Rafiq Uddin', username: 'rafiq', role: 'owner' }),
    logout: () => Promise.resolve(true),
  },
  shifts: {
    getCurrent: () => Promise.resolve({
      shift_id: 'mock-shift-1',
      user_id: 'u-1',
      user_name: 'Rafiq Uddin',
      device_id: 'DEV-01',
      status: 'open',
      opened_at: new Date().toISOString(),
      opening_cash_paisa: 100000,
      expected_cash_paisa: 1450000,
      total_sales_paisa: 1350000,
      total_cash_sales_paisa: 1350000,
      total_bkash_sales_paisa: 0,
      total_nagad_sales_paisa: 0,
      total_card_sales_paisa: 0,
      total_cash_refund_paisa: 0,
      total_cash_in_paisa: 0,
      total_cash_out_paisa: 0,
      cash_transactions: [],
      sales_count: 5,
    }),
    getLastClosedFloat: () => Promise.resolve({ float_paisa: 100000 }),
    open: (p: any) => Promise.resolve({
      shift_id: 'mock-shift-1',
      user_id: 'u-1',
      user_name: 'Rafiq Uddin',
      device_id: 'DEV-01',
      status: 'open',
      opened_at: new Date().toISOString(),
      opening_cash_paisa: p.opening_cash_paisa || 0,
      expected_cash_paisa: p.opening_cash_paisa || 0,
      total_sales_paisa: 0,
      total_cash_sales_paisa: 0,
      total_bkash_sales_paisa: 0,
      total_nagad_sales_paisa: 0,
      total_card_sales_paisa: 0,
      total_cash_refund_paisa: 0,
      total_cash_in_paisa: 0,
      total_cash_out_paisa: 0,
      cash_transactions: [],
      sales_count: 0,
    }),
    addCashTx: () => Promise.resolve({ success: true }),
    getSummary: () => Promise.resolve({} as any),
    close: (p: any) => Promise.resolve({
      shift_id: 'mock-shift-1',
      user_id: 'u-1',
      user_name: 'Rafiq Uddin',
      device_id: 'DEV-01',
      status: 'closed',
      opened_at: new Date().toISOString(),
      closed_at: new Date().toISOString(),
      opening_cash_paisa: 100000,
      expected_cash_paisa: 100000,
      actual_cash_paisa: p.actual_cash_paisa,
      cash_difference_paisa: p.actual_cash_paisa - 100000,
      total_sales_paisa: 0,
      total_cash_sales_paisa: 0,
      total_bkash_sales_paisa: 0,
      total_nagad_sales_paisa: 0,
      total_card_sales_paisa: 0,
      total_cash_refund_paisa: 0,
      total_cash_in_paisa: 0,
      total_cash_out_paisa: 0,
      cash_transactions: [],
      sales_count: 0,
    }),
    getHistory: () => Promise.resolve([]),
  },
  wizard: { checkStatus: () => Promise.resolve({ isFirstRun: false }) },
  products: { list: () => Promise.resolve(PRODUCTS) },
  categories: { list: () => Promise.resolve(CATEGORIES), create: () => Promise.resolve(null) },
  customers: {
    list: () => Promise.resolve(CUSTOMERS),
    // Mirrors the real handler: it returns all four fields.
    getDueSummary: () => {
      const withDue = CUSTOMERS.filter((c) => c.due_paisa > 0);
      return Promise.resolve({
        total_due_paisa: withDue.reduce((n, c) => n + c.due_paisa, 0),
        total_customers_count: CUSTOMERS.length,
        customers_with_due_count: withDue.length,
        top_due_customers: [...withDue].sort((x, y) => y.due_paisa - x.due_paisa).slice(0, 5),
      });
    },
  },
  sales: {
    getHeldSales: () => Promise.resolve(HELD),
    deleteHeldSale: () => Promise.resolve(true),
    holdSale: () => Promise.resolve({ id: 'h-9', invoiceNo: 'HOLD-0099' }),
    getByInvoice: () => Promise.resolve(null),
  },
  suppliers: {
    list: () => Promise.resolve([
      { id: "s-1", name: "Dhaka Auto Importers", contact_person: "Jamal (manager)", payment_terms_days: 30, phone: "01711-220044", address: "Bangshal, Dhaka", total_payable_paisa: 1875000 },
      { id: "s-2", name: "Chittagong Parts House", phone: "01811-556677", address: "Agrabad, Chattogram", total_payable_paisa: 0 },
      { id: "s-3", name: "Bosch Authorised Dealer", phone: "01911-889900", address: "Tejgaon, Dhaka", total_payable_paisa: 640000 },
    ]),
    create: () => Promise.resolve({ id: "s-9" }),
    payDue: (d: any) => Promise.resolve({ success: true, paymentId: "pay-1", remainingPayablePaisa: 0 }),
    update: (d: any) => Promise.resolve({ success: true }),
    remove: (id: string) => Promise.resolve({ success: true }),
    getLedger: (id: string) => {
      if (id !== "s-1") {
        return Promise.resolve({ supplier: {}, opening_balance_paisa: 0, rows: [], closing_balance_paisa: 0 });
      }
      const rows = [
        { id: "pu-a", kind: "purchase", created_at: "2026-07-04T09:10:00.000Z", label: "Purchase CHAL-8801", note: "Filters, belts, plugs", debit_paisa: 1240000, credit_paisa: 400000, transport_paisa: 45000, balance_paisa: 1140000 },
        { id: "pay-a", kind: "payment", created_at: "2026-07-19T11:00:00.000Z", label: "Payment (bkash)", note: null, debit_paisa: 0, credit_paisa: 300000, transport_paisa: 0, balance_paisa: 840000 },
        { id: "pu-b", kind: "purchase", created_at: "2026-08-02T08:30:00.000Z", label: "Purchase CHAL-8877", note: null, debit_paisa: 1095000, credit_paisa: 0, transport_paisa: 60000, balance_paisa: 1935000 },
        { id: "pay-b", kind: "payment", created_at: "2026-08-14T16:45:00.000Z", label: "Payment (cash)", note: null, debit_paisa: 0, credit_paisa: 360000, transport_paisa: 0, balance_paisa: 1575000 },
        { id: "pu-c", kind: "purchase", created_at: "2026-08-24T10:05:00.000Z", label: "Purchase CHAL-8892", note: "Brake shoes", debit_paisa: 300000, credit_paisa: 0, transport_paisa: 0, balance_paisa: 1875000 },
      ];
      return Promise.resolve({ supplier: {}, opening_balance_paisa: 300000, rows, closing_balance_paisa: 1875000 });
    },
  },
  purchases: {
    list: () => Promise.resolve([
      { id: "pu-1", supplier_name: "Dhaka Auto Importers", ref_invoice: "INV-2291", total_paisa: 1875000, paid_paisa: 0, transport_paisa: 60000, note: "Filters + belts", created_at: new Date().toISOString() },
      { id: "pu-2", supplier_name: "Bosch Authorised Dealer", ref_invoice: "BD-7741", total_paisa: 940000, paid_paisa: 300000, note: "Brake pads", created_at: new Date().toISOString() },
    ]),
    create: () => Promise.resolve({ id: "pu-9" }),
  },
  settings: { get: () => Promise.resolve({}), update: () => Promise.resolve(true) },
};

// eslint-disable-next-line no-console
console.log('[preview]', CATEGORIES.length, 'categories,', PRODUCTS.length, 'products,', CUSTOMERS.length, 'customers');

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
