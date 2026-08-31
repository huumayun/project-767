export interface UserSession {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'staff';
  has_pin?: boolean;
}

export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'staff';
  is_active: number | boolean;
  pin_code?: string | null;
  device_id?: string | null;
  total_sales_paisa?: number;
  created_at: string;
  updated_at: string;
}

export interface ShiftCashTransaction {
  id: string;
  shift_id: string;
  type: 'cash_in' | 'cash_out';
  amount_paisa: number;
  reason: string;
  user_id: string;
  device_id: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftRecord {
  id: string;
  user_id: string;
  device_id: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  opening_cash_paisa: number;
  expected_cash_paisa: number;
  actual_cash_paisa?: number | null;
  cash_difference_paisa?: number | null;
  closing_cash_withdrawn_paisa?: number | null;
  closing_float_left_paisa?: number | null;
  total_sales_paisa: number;
  total_cash_sales_paisa: number;
  total_bkash_sales_paisa: number;
  total_nagad_sales_paisa: number;
  total_card_sales_paisa: number;
  total_cash_in_paisa: number;
  total_cash_out_paisa: number;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftSummaryData {
  shift_id: string;
  user_id: string;
  user_name?: string;
  device_id: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string | null;
  opening_cash_paisa: number;
  expected_cash_paisa: number;
  actual_cash_paisa?: number | null;
  cash_difference_paisa?: number | null;
  closing_cash_withdrawn_paisa?: number | null;
  closing_float_left_paisa?: number | null;
  total_sales_paisa: number;
  total_cash_sales_paisa: number;
  total_bkash_sales_paisa: number;
  total_nagad_sales_paisa: number;
  total_card_sales_paisa: number;
  total_cash_refund_paisa: number;
  total_cash_in_paisa: number;
  total_cash_out_paisa: number;
  cash_transactions: ShiftCashTransaction[];
  sales_count: number;
  note?: string | null;
  user_breakdown?: Array<{
    user_id: string;
    user_name: string;
    sales_count: number;
    total_sales_paisa: number;
    cash_sales_paisa: number;
    cash_refund_paisa: number;
    cash_in_paisa: number;
    cash_out_paisa: number;
  }>;
}

export interface Category {
  id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  name_bn?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  brand?: string | null;
  unit: string;
  cost_price_paisa: number;
  sell_price_paisa: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_serial_tracked: boolean | number;
  created_at?: string;
  updated_at?: string;
  batches?: { remaining_qty: number; cost_price_paisa: number; received_at?: string }[];
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  contact_person?: string | null;
  opening_balance_paisa?: number;
  payment_terms_days?: number | null;
  note?: string | null;
  total_payable_paisa: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierLedgerRow {
  id: string;
  kind: "purchase" | "payment";
  created_at: string;
  label: string;
  note: string | null;
  debit_paisa: number;
  credit_paisa: number;
  transport_paisa: number;
  balance_paisa: number;
}

export interface SupplierLedger {
  supplier: Supplier;
  opening_balance_paisa: number;
  rows: SupplierLedgerRow[];
  closing_balance_paisa: number;
}

export interface PurchaseItemPayload {
  product_id: string;
  qty: number;
  unit_cost_taka: number;
}

export interface PurchasePayload {
  supplier_id?: string | null;
  invoice_ref?: string | null;
  paid_taka: number;
  /** Freight/carrying charge for the whole invoice. Spread across the lines by
   *  value in the main process, so stock carries its true landed cost. */
  transport_taka?: number;
  /** True when the vendor billed the fare on their challan; false when the
   *  shop paid it separately, in which case it never joins the payable. */
  transport_on_invoice?: boolean;
  note?: string | null;
  items: PurchaseItemPayload[];
}

export interface CartItem {
  product_id: string;
  barcode: string;
  name: string;
  name_bn?: string | null;
  unit: string;
  unit_price_paisa: number;
  cost_price_paisa?: number;
  qty: number;
  discount_paisa: number;
  available_stock: number;
  is_serial_tracked?: boolean;
  serial_number_id?: string | null;
}

export interface PaymentItem {
  method: 'cash' | 'bkash' | 'nagad' | 'card';
  amount_paisa: number;
  trx_id?: string;
}

export interface SalePayload {
  customer_id?: string | null;
  subtotal_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  items: Array<{
    product_id: string;
    qty: number;
    unit_price_paisa: number;
    discount_paisa?: number;
    serial_number_id?: string | null;
  }>;
  payments: PaymentItem[];
  total_paid_paisa: number;
  change_paisa?: number;
  layout?: '80mm' | 'a5';
}

export interface SaleRecord {
  id: string;
  invoice_no: string;
  status: 'completed' | 'held' | 'refunded' | 'partial_refund';
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  cashier_name?: string | null;
  subtotal_paisa: number;
  discount_paisa: number;
  total_paisa: number;
  user_id: string;
  created_at: string;
  updated_at: string;
  items?: any[];
  payments?: any[];
  returns?: any[];
}

export interface HeldSale {
  id: string;
  invoice_no: string;
  created_at: string;
  detail?: {
    cartData: CartItem[];
    customerName?: string;
    note?: string;
  };
}

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  note?: string | null;
  total_sales_paisa?: number;
  total_paid_paisa?: number;
  due_paisa?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerDueSummary {
  total_due_paisa: number;
  total_customers_count: number;
  customers_with_due_count: number;
  top_due_customers: Customer[];
}

export interface CustomerHistoryItem {
  id: string;
  type: 'sale' | 'payment';
  date: string;
  ref_no: string;
  description: string;
  method?: string | null;
  debit_paisa: number;
  credit_paisa: number;
  running_balance_paisa?: number;
}

export interface DueCollectionPayload {
  customer_id: string;
  amount_taka: number;
  method: 'cash' | 'bkash' | 'nagad' | 'card';
  trx_id?: string | null;
  note?: string | null;
}

export interface DueCollectionResult {
  success: boolean;
  payment_id: string;
  customer_name: string;
  amount_paisa: number;
  previous_due_paisa: number;
  remaining_due_paisa: number;
  date: string;
}

export interface SalesReportData {
  start_date: string;
  end_date: string;
  total_orders: number;
  subtotal_paisa: number;
  discount_paisa: number;
  gross_sales_paisa: number;
  refunds_count: number;
  total_refunded_paisa: number;
  net_sales_paisa: number;
  payments_breakdown: {
    cash_paisa: number;
    bkash_paisa: number;
    nagad_paisa: number;
    card_paisa: number;
  };
  daily_trends: Array<{
    date: string;
    orders_count: number;
    sales_paisa: number;
  }>;
}

export interface ProfitReportData {
  start_date: string;
  end_date: string;
  total_revenue_paisa: number;
  total_cogs_paisa: number;
  gross_profit_paisa: number;
  total_discounts_paisa: number;
  net_profit_paisa: number;
  profit_margin_percent: number;
  product_profits: Array<{
    product_id: string;
    product_name: string;
    barcode: string;
    qty_sold: number;
    revenue_paisa: number;
    cost_paisa: number;
    profit_paisa: number;
    margin_percent: number;
  }>;
}

export interface BestSellingProduct {
  product_id: string;
  product_name: string;
  barcode: string;
  category_name?: string | null;
  qty_sold: number;
  revenue_paisa: number;
}

export interface StockValuationData {
  total_products_count: number;
  total_stock_units: number;
  total_cost_valuation_paisa: number;
  total_retail_valuation_paisa: number;
  potential_gross_profit_paisa: number;
  potential_margin_percent: number;
}

export interface AuditLogRecord {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  detail_json?: string | null;
  created_at: string;
}

export type AuditLogEntry = AuditLogRecord;


export interface ShopSettings {
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  invoice_footer: string;
  device_id?: string;
  device_id_prefix?: string;
  idle_lock_minutes: string | number;
  default_invoice_layout: string;

  enable_shifts?: boolean;
  barcode_scanner_mode?: 'speed' | 'prefix';
  barcode_scanner_prefix?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_shop_id?: string;
  shop_id?: string;
}

export type SyncStatusType = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

export interface SyncStatusInfo {
  status: SyncStatusType;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  cloudConfigured: boolean;
}

export interface BackupFileInfo {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
  isAutomatic: boolean;
}

export interface IElectronApi {
  ping: () => Promise<{ status: string; timestamp: string }>;
  auth: {
    login: (args: { username: string; password: string }) => Promise<{ success: boolean; session?: UserSession; error?: string }>;
    pinLogin: (args: { pin: string }) => Promise<{ success: boolean; session?: UserSession; error?: string }>;
    logout: () => Promise<boolean>;
    getSession: () => Promise<UserSession | null>;
  };
  shell: {
    openExternal: (url: string) => Promise<boolean>;
  };
  categories: {
    list: () => Promise<Category[]>;
    create: (name: string) => Promise<Category>;
    update: (id: string, name: string) => Promise<{ id: string; name: string }>;
    remove: (id: string) => Promise<{ id: string; detachedProducts: number }>;
  };
  products: {
    list: (filters?: { category_id?: string; search?: string; low_stock?: boolean }) => Promise<Product[]>;
    getByBarcode: (barcode: string) => Promise<Product | null>;
    getById: (id: string) => Promise<Product | null>;
    create: (data: any) => Promise<Product>;
    update: (data: any) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    stockIn: (data: { product_id: string; qty: number; cost_price_paisa?: number; sell_price_paisa?: number; reason?: string }) => Promise<{ success: boolean; newStock: number }>;
    stockAdjustment: (data: { product_id: string; qty_delta: number; reason: string }) => Promise<{ success: boolean; newStock: number }>;
    getStockHistory: (productId: string) => Promise<any[]>;
    bulkImport: (payload: { mode: 'dry_run' | 'commit'; rows: any[] }) => Promise<{ success: boolean; totalRows?: number; validRowsCount?: number; imported?: number; errors: string[] }>;
  };
  suppliers: {
    update: (data: { id: string; name: string; phone?: string | null; address?: string | null; contact_person?: string | null; opening_balance_taka?: number; payment_terms_days?: number | null; note?: string | null }) => Promise<{ success: boolean }>;
    remove: (id: string) => Promise<{ success: boolean }>;
    payDue: (data: { supplier_id: string; amount_taka: number; method?: "cash" | "bkash" | "nagad" | "card"; note?: string | null }) => Promise<{ success: boolean; paymentId: string; remainingPayablePaisa: number }>;
    getLedger: (id: string) => Promise<SupplierLedger>;
    list: () => Promise<Supplier[]>;
    create: (data: { name: string; phone?: string | null; address?: string | null; contact_person?: string | null; opening_balance_taka?: number; payment_terms_days?: number | null; note?: string | null }) => Promise<Supplier>;
  };
  purchases: {
    create: (data: PurchasePayload) => Promise<{ success: boolean; purchaseId: string }>;
    list: () => Promise<any[]>;
  };
  stockTransactions: {
    list: (productId: string) => Promise<any[]>;
  };
  sales: {
    create: (payload: SalePayload) => Promise<{ success: boolean; sale_id: string; invoice_no: string; pdfBase64: string }>;
    getByInvoice: (invoiceNo: string) => Promise<SaleRecord | null>;
    list: (limit?: number) => Promise<SaleRecord[]>;
    holdSale: (data: { cartData: CartItem[]; customerName?: string; note?: string }) => Promise<{ id: string; invoiceNo: string }>;
    getHeldSales: () => Promise<HeldSale[]>;
    deleteHeldSale: (id: string) => Promise<boolean>;
    processReturn: (payload: {
      sale_id: string;
      reason: string;
      refund_method?: 'cash' | 'bkash' | 'nagad' | 'card';
      items: Array<{ sale_item_id: string; product_id: string; qty: number; amount_paisa: number }>;
    }) => Promise<{ success: boolean; returnId: string }>;
    generatePdf: (args: { invoice_no: string; layout?: '80mm' | 'a5' }) => Promise<{ success: boolean; pdfBase64: string }>;
  };
  customers: {
    list: (search?: string) => Promise<Customer[]>;
    getById: (id: string) => Promise<Customer | null>;
    create: (data: { name: string; phone?: string | null; address?: string | null; note?: string | null }) => Promise<Customer>;
    update: (data: { id: string; name: string; phone?: string | null; address?: string | null; note?: string | null }) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getHistory: (customerId: string) => Promise<CustomerHistoryItem[]>;
    collectDue: (payload: DueCollectionPayload) => Promise<DueCollectionResult>;
    getDueSummary: () => Promise<CustomerDueSummary>;
  };
  reports: {
    getSalesReport: (args: { startDate: string; endDate: string }) => Promise<SalesReportData>;
    getProfitReport: (args: { startDate: string; endDate: string }) => Promise<ProfitReportData>;
    getBestSelling: (args?: number | { startDate?: string; endDate?: string; limit?: number }) => Promise<BestSellingProduct[]>;
    getStockValuation: () => Promise<StockValuationData>;
  };
  users: {
    list: (filters?: { startDate?: string; endDate?: string }) => Promise<UserRecord[]>;
    create: (data: { username: string; name: string; role: 'owner' | 'staff'; password: string; pin_code?: string }) => Promise<UserRecord>;
    update: (data: { id: string; name: string; role: 'owner' | 'staff'; is_active: boolean; pin_code?: string }) => Promise<{ success: boolean }>;
    updatePin: (data: { userId: string; pin_code: string }) => Promise<{ success: boolean }>;
    changePassword: (data: { userId: string; newPassword: string }) => Promise<{ success: boolean }>;
  };
  shifts: {
    getCurrent: () => Promise<ShiftSummaryData | null>;
    hasAnyOpen: () => Promise<boolean>;
    getLastClosedFloat: () => Promise<{ float_paisa: number } | null>;
    open: (payload: { opening_cash_paisa: number; note?: string }) => Promise<ShiftSummaryData>;
    addCashTx: (payload: { shift_id: string; type: 'cash_in' | 'cash_out'; amount_paisa: number; reason: string }) => Promise<{ success: boolean }>;
    getSummary: (shiftId: string) => Promise<ShiftSummaryData>;
    close: (payload: { shift_id: string; actual_cash_paisa: number; cash_withdrawn_paisa?: number; float_left_paisa?: number; note?: string }) => Promise<ShiftSummaryData>;
    getHistory: (limit?: number) => Promise<ShiftSummaryData[]>;
  };
  settings: {
    get: () => Promise<ShopSettings>;
    update: (data: Partial<ShopSettings>) => Promise<{ success: boolean }>;
  };
  audit: {
    list: (limit?: number) => Promise<AuditLogRecord[]>;
  };
  sync: {
    getStatus: () => Promise<SyncStatusInfo>;
    triggerNow: () => Promise<SyncStatusInfo>;
    configure: (config: { supabaseUrl: string; supabaseAnonKey: string; shopId: string }) => Promise<{ success: boolean }>;
  };
  backup: {
    list: () => Promise<BackupFileInfo[]>;
    createManual: (targetPath?: string) => Promise<BackupFileInfo>;
    restore: (filePath: string) => Promise<{ success: boolean }>;
    selectFolder: () => Promise<string | null>;
    selectFile: () => Promise<string | null>;
    restoreLocalFile: (filePath: string) => Promise<{ success: boolean }>;
  };
  gdrive: {
    status: () => Promise<{ isConnected: boolean }>;
    getAuthUrl: () => Promise<{ success: boolean }>;
    authorize: (code: string) => Promise<{ success: boolean }>;
    disconnect: () => Promise<{ success: boolean }>;
  };
  wizard: {
    checkStatus: () => Promise<{ isFirstRun: boolean }>;
    completeFirstRun: (payload: {
      shop_name: string;
      shop_address?: string | null;
      shop_phone?: string | null;
      device_id_prefix?: string;
      default_invoice_layout?: '80mm' | 'a5';
      owner_password?: string | null;
    }) => Promise<{ success: boolean }>;
  };
  demo: {
    seed: () => Promise<{ success: boolean; count: number }>;
    reset: () => Promise<{ success: boolean }>;
  };
}

export interface BulkImportResult {
  success: boolean;
  validRowsCount?: number;
  errors: string[];
}

export type AppSettings = ShopSettings;

declare global {
  interface Window {
    api: IElectronApi;
  }
}
