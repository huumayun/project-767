import { contextBridge, ipcRenderer } from 'electron';

// Expose safe, structured API to renderer process
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('api:ping'),
  auth: {
    login: (args: { username: string; password: string }) => ipcRenderer.invoke('api:auth:login', args),
    logout: () => ipcRenderer.invoke('api:auth:logout'),
    getSession: () => ipcRenderer.invoke('api:auth:getSession'),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('api:shell:openExternal', url),
  },
  categories: {
    list: () => ipcRenderer.invoke('api:categories:list'),
    create: (name: string) => ipcRenderer.invoke('api:categories:create', name),
    update: (id: string, name: string) => ipcRenderer.invoke('api:categories:update', id, name),
    remove: (id: string) => ipcRenderer.invoke('api:categories:delete', id),
  },
  products: {
    list: (filters?: { category_id?: string; search?: string; low_stock?: boolean }) =>
      ipcRenderer.invoke('api:products:list', filters),
    getByBarcode: (barcode: string) => ipcRenderer.invoke('api:products:getByBarcode', barcode),
    getById: (id: string) => ipcRenderer.invoke('api:products:getById', id),
    create: (data: any) => ipcRenderer.invoke('api:products:create', data),
    update: (data: any) => ipcRenderer.invoke('api:products:update', data),
    delete: (id: string) => ipcRenderer.invoke('api:products:delete', id),
    stockIn: (data: { product_id: string; qty: number; reason?: string }) =>
      ipcRenderer.invoke('api:products:stockIn', data),
    stockAdjustment: (data: { product_id: string; qty_delta: number; reason: string }) =>
      ipcRenderer.invoke('api:products:stockAdjustment', data),
    bulkImport: (payload: { mode: 'dry_run' | 'commit'; rows: any[] }) =>
      ipcRenderer.invoke('api:products:bulkImport', payload),
  },
  suppliers: {
    list: () => ipcRenderer.invoke('api:suppliers:list'),
    create: (data: {
      name: string;
      phone?: string | null;
      address?: string | null;
      contact_person?: string | null;
      opening_balance_taka?: number;
      payment_terms_days?: number | null;
      note?: string | null;
    }) => ipcRenderer.invoke('api:suppliers:create', data),
    update: (data: {
      id: string;
      name: string;
      phone?: string | null;
      address?: string | null;
      contact_person?: string | null;
      opening_balance_taka?: number;
      payment_terms_days?: number | null;
      note?: string | null;
    }) => ipcRenderer.invoke('api:suppliers:update', data),
    remove: (id: string) => ipcRenderer.invoke('api:suppliers:delete', id),
    payDue: (data: {
      supplier_id: string;
      amount_taka: number;
      method?: 'cash' | 'bkash' | 'nagad' | 'card';
      note?: string | null;
    }) => ipcRenderer.invoke('api:suppliers:payDue', data),
    getLedger: (id: string) => ipcRenderer.invoke('api:suppliers:getLedger', id),
  },
  purchases: {
    create: (data: any) => ipcRenderer.invoke('api:purchases:create', data),
    list: () => ipcRenderer.invoke('api:purchases:list'),
  },
  stockTransactions: {
    list: (productId: string) => ipcRenderer.invoke('api:stockTransactions:list', productId),
  },
  sales: {
    create: (payload: any) => ipcRenderer.invoke('api:sales:create', payload),
    getByInvoice: (invoiceNo: string) => ipcRenderer.invoke('api:sales:getByInvoice', invoiceNo),
    list: (limit?: number) => ipcRenderer.invoke('api:sales:list', limit),
    holdSale: (data: any) => ipcRenderer.invoke('api:sales:holdSale', data),
    getHeldSales: () => ipcRenderer.invoke('api:sales:getHeldSales'),
    deleteHeldSale: (id: string) => ipcRenderer.invoke('api:sales:deleteHeldSale', id),
    processReturn: (payload: any) => ipcRenderer.invoke('api:sales:processReturn', payload),
    generatePdf: (args: { invoice_no: string; layout?: '80mm' | 'a5' }) =>
      ipcRenderer.invoke('api:sales:generatePdf', args),
  },
  customers: {
    list: (search?: string) => ipcRenderer.invoke('api:customers:list', search),
    getById: (id: string) => ipcRenderer.invoke('api:customers:getById', id),
    create: (data: { name: string; phone?: string | null; address?: string | null; note?: string | null }) =>
      ipcRenderer.invoke('api:customers:create', data),
    update: (data: { id: string; name: string; phone?: string | null; address?: string | null; note?: string | null }) =>
      ipcRenderer.invoke('api:customers:update', data),
    delete: (id: string) => ipcRenderer.invoke('api:customers:delete', id),
    getHistory: (customerId: string) => ipcRenderer.invoke('api:customers:getHistory', customerId),
    collectDue: (payload: any) => ipcRenderer.invoke('api:customers:collectDue', payload),
    getDueSummary: () => ipcRenderer.invoke('api:customers:getDueSummary'),
  },
  reports: {
    getSalesReport: (args: { startDate: string; endDate: string }) =>
      ipcRenderer.invoke('api:reports:getSalesReport', args),
    getProfitReport: (args: { startDate: string; endDate: string }) =>
      ipcRenderer.invoke('api:reports:getProfitReport', args),
    getBestSelling: (limit?: number) => ipcRenderer.invoke('api:reports:getBestSelling', limit),
    getStockValuation: () => ipcRenderer.invoke('api:reports:getStockValuation'),
  },
  users: {
    list: () => ipcRenderer.invoke('api:users:list'),
    create: (data: any) => ipcRenderer.invoke('api:users:create', data),
    update: (data: any) => ipcRenderer.invoke('api:users:update', data),
    changePassword: (data: any) => ipcRenderer.invoke('api:users:changePassword', data),
  },
  settings: {
    get: () => ipcRenderer.invoke('api:settings:get'),
    update: (data: any) => ipcRenderer.invoke('api:settings:update', data),
  },
  audit: {
    list: (limit?: number) => ipcRenderer.invoke('api:audit:list', limit),
  },
  sync: {
    getStatus: () => ipcRenderer.invoke('api:sync:getStatus'),
    triggerNow: () => ipcRenderer.invoke('api:sync:triggerNow'),
    configure: (config: any) => ipcRenderer.invoke('api:sync:configure', config),
  },
  backup: {
    list: () => ipcRenderer.invoke('api:backup:list'),
    createManual: (targetPath?: string) => ipcRenderer.invoke('api:backup:createManual', targetPath),
    restore: (backupFilePath: string) => ipcRenderer.invoke('api:backup:restore', backupFilePath),
  },
  wizard: {
    checkStatus: () => ipcRenderer.invoke('api:wizard:checkStatus'),
    completeFirstRun: (payload: any) => ipcRenderer.invoke('api:wizard:completeFirstRun', payload),
  },
  demo: {
    seed: () => ipcRenderer.invoke('api:demo:seed'),
    reset: () => ipcRenderer.invoke('api:demo:reset'),
  },
});

