/*
 * The app shipped bilingual, with every string written twice and a toggle in
 * the sidebar. The shop runs in English only, so the second copy was dead
 * weight that drifted out of sync with the first - several screens had a
 * Bengali label the English side had already renamed.
 *
 * One flat dictionary now. Components import it directly rather than
 * indexing it by a language that can only have one value.
 */
export const translations = {
  // Navigation
  navDashboard: 'Dashboard',
  navPos: 'POS Terminal',
  navSales: 'Transactions',
  navCustomers: 'Customers',
  navProducts: 'Products',
  navCategories: 'Categories',
  navSuppliers: 'Suppliers',
  navReports: 'Reports',
  navShifts: 'Shift History',
  navUsers: 'Staff & Users',
  navSettings: 'Settings',
  navAudit: 'Audit Log',
  secOperations: 'Counter',
  secCatalog: 'Stock',
  secReports: 'Records',
  secAdmin: 'Admin',
  
  // Auth & Roles
  activeRole: 'Active Role',
  ownerRole: 'Owner',
  staffRole: 'Staff',
  ownerDesc: 'Full Control (Cost, Profit, Reports, Management)',
  staffDesc: 'Cashier Mode (Cost price & profits hidden)',
  logout: 'Logout',
  login: 'Login',
  loginTitle: 'Terminal Login',
  usernameLabel: 'Username',
  passwordLabel: 'Password',
  loginButton: 'Sign In to Terminal',

  // Dashboard
  todaySales: "Today's Sales",
  todayDue: 'Due Generated Today',
  totalCustomers: 'Total Customers',
  dueCustomers: 'Customers with Due',
  lowStockAlerts: 'Low Stock Warnings',
  quickActions: 'Quick Actions',
  newSale: 'New Sale (POS)',
  addStock: 'Stock In / Purchase',
  addCustomer: 'New Customer',
  viewReports: 'Financial Reports',
  recentTransactions: 'Recent Transactions',

  // POS
  searchPlaceholder: 'Scan Barcode or Search (F2)...',
  cartEmpty: 'Cart is empty. Scan barcode or select items.',
  quickCash: 'Quick Cash (F4)',
  holdCart: 'Hold Cart (F9)',
  completeSale: 'Checkout (F8)',
  clearCart: 'Clear Cart (Esc)',
  cashPayment: 'Cash',
  duePayment: 'Due / Credit',
  cardPayment: 'Bank / Card',
  bKashPayment: 'Mobile / bKash',
  subtotal: 'Subtotal',
  discount: 'Discount',
  totalPayable: 'Total Payable',
  paidAmount: 'Paid Amount',
  changeReturn: 'Change Return',
  dueBalance: 'Remaining Due',
  printReceipt: 'Print Receipt',
  printPreview: 'Invoice Preview',

  // Customers
  sendWhatsAppReminder: 'WhatsApp Reminder',
  dueReminderText: 'Dear customer, you have an outstanding due balance of ৳{amount} at our shop. Please settle at your earliest convenience. Thank you.',
};
