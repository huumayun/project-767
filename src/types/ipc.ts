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
  /** Whether a PIN is set. The PIN itself is hashed and never sent to the renderer. */
  has_pin?: number | boolean;
  device_id?: string | null;
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
  /** Non-cash taken on the merged "Other payment method" button. */
  total_other_sales_paisa?: number;
  /** Goods that came back, and the sales figure net of them. */
  total_returned_paisa?: number;
  net_sales_paisa?: number;
  /** What those goods cost, at the FIFO cost captured on each sale line. */
  total_cogs_paisa?: number;
  gross_profit_paisa?: number;
  /** Credit given during this shift, and how many bills carry it. */
  total_due_sales_paisa?: number;
  due_sales_count?: number;
  /** Old balances settled at the counter - money in, but not a sale. */
  total_cash_due_collected_paisa?: number;
  total_other_due_collected_paisa?: number;
  sale_transactions?: ShiftSaleRow[];
  total_cash_in_paisa: number;
  total_cash_out_paisa: number;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftSaleRow {
  id: string;
  invoice_no: string;
  total_paisa: number;
  paid_paisa: number;
  due_paisa: number;
  returned_paisa: number;
  status: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string;
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
  /** Non-cash taken on the merged "Other payment method" button. */
  total_other_sales_paisa?: number;
  /** Goods that came back, and the sales figure net of them. */
  total_returned_paisa?: number;
  net_sales_paisa?: number;
  /** What those goods cost, at the FIFO cost captured on each sale line. */
  total_cogs_paisa?: number;
  gross_profit_paisa?: number;
  /** Credit given during this shift, and how many bills carry it. */
  total_due_sales_paisa?: number;
  due_sales_count?: number;
  /** Old balances settled at the counter - money in, but not a sale. */
  total_cash_due_collected_paisa?: number;
  total_other_due_collected_paisa?: number;
  sale_transactions?: ShiftSaleRow[];
  total_cash_refund_paisa: number;
  /** Every note that left the drawer - refunds and vendor payments alike. */
  total_cash_paid_out_paisa?: number;
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
  /** null for a top-level category; two levels is the limit. */
  parent_id?: string | null;
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
  method: 'cash' | 'bkash' | 'nagad' | 'card' | 'other';
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
  layout?: '80mm' | 'a4';
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
  /**
   * Collected when the bill was cut. NOT the invoice's balance today: a baki
   * settled later is recorded against the customer, not the invoice, so this
   * figure never moves once the sale is made. For what a customer owes now,
   * use the Due & Payable report.
   */
  paid_at_sale_paisa?: number;
  /** total_paisa minus paid_at_sale_paisa, floored at zero. Same caveat. */
  due_at_sale_paisa?: number;
  refunded_paisa?: number;
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
  /**
   * `return` is a credit note (goods back, balance down) and `refund` is cash
   * handed over the counter (balance back up). Both are needed for the
   * statement to close on the same figure v_customer_due reports.
   */
  type: 'sale' | 'payment' | 'return' | 'refund';
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
  method: 'cash' | 'bkash' | 'nagad' | 'card' | 'other';
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
  /** Cash that actually left the drawer as refunds. */
  total_refunded_paisa: number;
  /** Value of goods returned, whether refunded in cash or credited to a due. */
  total_returned_paisa: number;
  net_sales_paisa: number;
  payments_breakdown: {
    cash_paisa: number;
    bkash_paisa: number;
    nagad_paisa: number;
    card_paisa: number;
    other_paisa?: number;
  };
  daily_trends: Array<{
    date: string;
    orders_count: number;
    sales_paisa: number;
    refunded_paisa?: number;
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
  /** Products whose stock_qty disagrees with their open batches. 0 when clean. */
  drift_product_count?: number;
  /** Units carrying stock that no batch accounts for, valued at product cost. */
  unbacked_units?: number;
}

export interface CustomerReceivable {
  id: string;
  name: string;
  phone?: string | null;
  total_sales_paisa: number;
  total_paid_paisa: number;
  due_paisa: number;
  /** Last non-held sale, so an owner can see how long a balance has sat. */
  last_sale_at?: string | null;
}

export interface SupplierPayable {
  id: string;
  name: string;
  phone?: string | null;
  contact_person?: string | null;
  payment_terms_days?: number | null;
  payable_paisa: number;
}

/**
 * Money owed to and by the shop.
 *
 * A balance, not a range: `as_of` is the moment it was read, and the report
 * takes no start/end date because "what was outstanding between two dates" has
 * no answer.
 */
export interface DueReportData {
  as_of: string;
  total_receivable_paisa: number;
  total_payable_paisa: number;
  /** Receivable minus payable. Positive means more is owed to the shop. */
  net_position_paisa: number;
  customers_with_due_count: number;
  total_customers_count: number;
  suppliers_with_payable_count: number;
  total_suppliers_count: number;
  receivables: CustomerReceivable[];
  payables: SupplierPayable[];
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
  invoice_shop_name?: string;
  invoice_contacts?: { name: string; phone: string }[];
  shop_address: string;
  shop_phone: string;
  /** Footer contacts. Empty means the line is left off the invoice entirely. */
  shop_web?: string;
  shop_email?: string;
  invoice_footer: string;
  device_id?: string;
  device_id_prefix?: string;
  idle_lock_minutes: string | number;
  default_invoice_layout: string;
  /** Print layout, resolved against per-paper defaults by the main process. */
  invoice_margin_mm?: number;
  invoice_font_pt?: number;
  invoice_show_address?: boolean;
  invoice_show_phone?: boolean;
  invoice_show_qr?: boolean;
  invoice_show_cashier?: boolean;
  invoice_show_name_bn?: boolean;
  invoice_show_footer?: boolean;
  /** PNG data URI, downscaled on import. Empty when no logo is set. */
  invoice_logo?: string;
  invoice_show_logo?: boolean;
  invoice_logo_height_mm?: number;
  invoice_title?: string;
  invoice_header_note?: string;
  invoice_terms?: string;
  invoice_show_signature?: boolean;
  /** A second signature line on the customer's side of the memo. */
  invoice_show_customer_signature?: boolean;

  enable_shifts?: boolean;
  /**
   * False at a counter with no printer: the till stops offering to print and
   * offers to save the invoice as a PDF instead.
   */
  has_printer?: boolean;
  /** Send receipts straight to receipt_printer_name instead of opening the dialog. */
  silent_print?: boolean;
  /** Windows device name of the receipt printer; blank means "ask every time". */
  receipt_printer_name?: string;
  /** Counts only - the codes are stored hashed and never leave the main process. */
  recovery_codes_total?: number;
  recovery_codes_remaining?: number;
  recovery_set_at?: string;
  barcode_scanner_mode?: 'speed' | 'prefix';
  barcode_scanner_prefix?: string;
  supabase_url?: string;
  supabase_anon_key?: string;
  supabase_shop_id?: string;
  shop_id?: string;
  local_backup_path?: string;
  first_run_completed?: string;
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
    verifyOwnerPassword: (args: { password: string }) => Promise<{ success: boolean; error?: string }>;
    pinLogin: (args: { pin: string }) => Promise<{ success: boolean; session?: UserSession; error?: string }>;
    logout: () => Promise<boolean>;
    getSession: () => Promise<UserSession | null>;
    recoveryAvailable: () => Promise<{ available: boolean; remaining: number; total: number }>;
    resetWithRecoveryCode: (args: { code: string; newPassword: string }) => Promise<{
      success: boolean;
      username?: string;
      codesRemaining?: number;
      error?: string;
    }>;
  };
  print: {
    /**
     * Prints page images at their exact paper size - the invoice PDF drawn by
     * src/utils/printPdf.ts - silently to the receipt printer when one is set.
     */
    pages: (args: {
      pages: { image: string; widthMm: number; heightMm: number }[];
      fileName?: string;
    }) => Promise<{ success: boolean; cancelled?: boolean }>;
    /** Opens the system print dialog for a standalone HTML document. */
    document: (args: { html: string; marginMm?: number }) => Promise<{ success: boolean; cancelled?: boolean }>;
    /** Writes the document to a PDF in Downloads and opens it. */
    toPdf: (args: { html: string; marginMm?: number; fileName?: string }) => Promise<{ success: boolean; filePath: string }>;
    /** Installed printers, for choosing which one receipts go to. */
    listPrinters: () => Promise<{ name: string; displayName: string; isDefault: boolean; status: number }[]>;
    /** Asks where to save an invoice PDF, writes it, and opens it. */
    savePdf: (args: { pdfBase64: string; fileName?: string }) => Promise<{
      success: boolean;
      canceled?: boolean;
      filePath?: string;
      opened?: boolean;
    }>;
  };
  shell: {
    openExternal: (url: string) => Promise<boolean>;
  };
  categories: {
    list: () => Promise<Category[]>;
    create: (name: string, parentId?: string | null) => Promise<Category>;
    update: (
      id: string,
      name: string,
      parentId?: string | null
    ) => Promise<{ id: string; name: string; parent_id: string | null }>;
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
    /** Owner only. Refused once any of the goods have been sold. */
    void: (args: { purchase_id: string; reason: string }) => Promise<{ success: boolean }>;
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
      refund_method?: 'cash' | 'bkash' | 'nagad' | 'card' | 'other';
      items: Array<{ sale_item_id: string; product_id: string; qty: number; amount_paisa: number }>;
    }) => Promise<{
      success: boolean;
      returnId: string;
      return_invoice_no: string;
      total_refund_paisa: number;
      cash_refund_paisa: number;
      credited_to_due_paisa: number;
      status: string;
    }>;
    generatePdf: (args: { invoice_no: string; layout?: '80mm' | 'a4' }) => Promise<{ success: boolean; pdfBase64: string }>;
    getReturnByInvoice: (returnInvoiceNo: string) => Promise<any>;
    generateReturnPdf: (args: { return_invoice_no: string; layout?: '80mm' | 'a4' }) => Promise<{ success: boolean; pdfBase64: string }>;
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
    /** Outstanding balances as of now. Takes no date range - see DueReportData. */
    getDueReport: () => Promise<DueReportData>;
  };
  users: {
    list: () => Promise<UserRecord[]>;
    create: (data: { username: string; name: string; role: 'owner' | 'staff'; password: string; pin_code?: string }) => Promise<UserRecord>;
    /** Omit pin_code to keep the existing PIN; pass clear_pin to remove it. */
    update: (data: { id: string; name: string; role: 'owner' | 'staff'; is_active: boolean; pin_code?: string; clear_pin?: boolean }) => Promise<{ success: boolean }>;
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
    /** A sample invoice rendered by the real generator, for the Settings preview. */
    previewInvoice: (overrides?: Record<string, any>) =>
      Promise<{ pdfBase64: string; paper: '80mm' | 'a4'; isRoll: boolean }>;
    get: () => Promise<ShopSettings>;
    update: (data: Partial<ShopSettings>) => Promise<{ success: boolean }>;
    generateRecoveryCodes: () => Promise<{ codes: string[] }>;
    exportRecoveryCodes: (codes: string[]) => Promise<{ success: boolean; canceled?: boolean; filePath?: string }>;
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
    /** Always written into the backups folder chosen in Settings. */
    createManual: () => Promise<BackupFileInfo>;
    restore: (filePath: string) => Promise<{ success: boolean }>;
    selectFolder: () => Promise<string | null>;
    selectFile: () => Promise<string | null>;
    getFileInfo: (filePath: string) => Promise<{ name: string; size: number; date: string }>;
    restoreLocalFile: (filePath: string) => Promise<{ success: boolean }>;
  };
  gdrive: {
    /** isConfigured is false when this build shipped without OAuth credentials. */
    status: () => Promise<{ isConnected: boolean; isConfigured?: boolean }>;
    getAuthUrl: () => Promise<{ success: boolean; autoHandled?: boolean; error?: string }>;
    authorize: (code: string) => Promise<{ success: boolean }>;
    disconnect: () => Promise<{ success: boolean }>;
    restoreLatest: () => Promise<{ success: boolean }>;
  };
  wizard: {
    checkStatus: () => Promise<{ isFirstRun: boolean; shopName: string }>;
    completeFirstRun: (payload: {
      shop_name: string;
      shop_address?: string | null;
      shop_phone?: string | null;
      device_id_prefix?: string;
      default_invoice_layout?: '80mm' | 'a4';
      owner_username?: string | null;
      owner_password?: string | null;
    }) => Promise<{ success: boolean; recoveryCodes?: string[] | null }>;
  };
  /** Development builds only, and only into an empty shop. */
  demo: {
    seed: () => Promise<{ success: boolean; count: number }>;
  };
  data: {
    /** What erasing would remove right now. */
    counts: () => Promise<BusinessDataCounts & { cloudSyncConfigured: boolean }>;
    /** Owner password + the word ERASE; writes a full backup before deleting anything. */
    erase: (args: { password: string; confirmText: string }) => Promise<{
      success: boolean;
      erased: BusinessDataCounts;
      backupFile: string;
      backupPath: string;
    }>;
  };
  app: {
    info: () => Promise<{ version: string; isPackaged: boolean; sampleDataAvailable: boolean }>;
  };
}

export interface BusinessDataCounts {
  sales: number;
  purchases: number;
  products: number;
  customers: number;
  suppliers: number;
  shifts: number;
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
