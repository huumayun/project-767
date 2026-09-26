import { contextBridge, ipcRenderer as electronIpcRenderer } from 'electron';

/**
 * The message a handler threw, without Electron's wrapping.
 *
 * ipcRenderer.invoke rejects with "Error invoking remote method
 * 'api:sales:create': Error: <the real message>". Every screen in this app
 * shows err.message straight to the shopkeeper, so a plainly worded refusal
 * like "open a shift first" arrived buried behind a channel name and two
 * "Error:" prefixes, reading as a crash rather than an instruction.
 */
function unwrapIpcError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const cleaned = raw
    .replace(/^Error invoking remote method '[^']*':\s*/, '')
    .replace(/^(Error:\s*)+/, '')
    .trim();
  return new Error(cleaned || 'Something went wrong.');
}

/*
 * Wrapped once here rather than at each of the ninety-odd call sites below.
 * `invoke` is the only member of ipcRenderer this bridge uses.
 */
const ipcRenderer = {
  invoke: async (channel: string, ...args: any[]) => {
    try {
      return await electronIpcRenderer.invoke(channel, ...args);
    } catch (err) {
      throw unwrapIpcError(err);
    }
  },
};

// Expose safe, structured API to renderer process
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('api:ping'),
  auth: {
    login: (args: { username: string; password: string }) => ipcRenderer.invoke('api:auth:login', args),
    verifyOwnerPassword: (args: { password: string }) => ipcRenderer.invoke('api:auth:verifyOwnerPassword', args),
    pinLogin: (args: { pin: string }) => ipcRenderer.invoke('api:auth:pinLogin', args),
    logout: () => ipcRenderer.invoke('api:auth:logout'),
    getSession: () => ipcRenderer.invoke('api:auth:getSession'),
    recoveryAvailable: () => ipcRenderer.invoke('api:auth:recoveryAvailable'),
    resetWithRecoveryCode: (args: { code: string; newPassword: string }) =>
      ipcRenderer.invoke('api:auth:resetWithRecoveryCode', args),
  },
  print: {
    document: (args: { html: string; marginMm?: number }) => ipcRenderer.invoke('api:print:document', args),
    pages: (args: { pages: { image: string; widthMm: number; heightMm: number }[]; fileName?: string }) =>
      ipcRenderer.invoke('api:print:pages', args),
    toPdf: (args: { html: string; marginMm?: number; fileName?: string }) =>
      ipcRenderer.invoke('api:print:toPdf', args),
    listPrinters: () => ipcRenderer.invoke('api:print:listPrinters'),
    savePdf: (args: { pdfBase64: string; fileName?: string }) => ipcRenderer.invoke('api:print:savePdf', args),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('api:shell:openExternal', url),
  },
  categories: {
    list: () => ipcRenderer.invoke('api:categories:list'),
    create: (name: string, parentId?: string | null) =>
      ipcRenderer.invoke('api:categories:create', name, parentId ?? null),
    update: (id: string, name: string, parentId?: string | null) =>
      ipcRenderer.invoke('api:categories:update', id, name, parentId),
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
    getStockHistory: (productId: string) => ipcRenderer.invoke('api:products:getStockHistory', productId),
    getBatchDrift: () => ipcRenderer.invoke('api:products:getBatchDrift'),
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
    void: (args: { purchase_id: string; reason: string }) =>
      ipcRenderer.invoke('api:purchases:void', args),
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
    generatePdf: (args: { invoice_no: string; layout?: '80mm' | 'a4' }) =>
      ipcRenderer.invoke('api:sales:generatePdf', args),
    getReturnByInvoice: (returnInvoiceNo: string) =>
      ipcRenderer.invoke('api:sales:getReturnByInvoice', returnInvoiceNo),
    generateReturnPdf: (args: { return_invoice_no: string; layout?: '80mm' | 'a4' }) =>
      ipcRenderer.invoke('api:sales:generateReturnPdf', args),
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
    bulkImport: (payload: any) => ipcRenderer.invoke('api:customers:bulkImport', payload),
  },
  reports: {
    getSalesReport: (args: { startDate: string; endDate: string }) =>
      ipcRenderer.invoke('api:reports:getSalesReport', args),
    getProfitReport: (args: { startDate: string; endDate: string }) =>
      ipcRenderer.invoke('api:reports:getProfitReport', args),
    getBestSelling: (args?: number | { startDate?: string; endDate?: string; limit?: number }) =>
      ipcRenderer.invoke('api:reports:getBestSelling', args),
    getStockValuation: () => ipcRenderer.invoke('api:reports:getStockValuation'),
    getDueReport: () => ipcRenderer.invoke('api:reports:getDueReport'),
  },
  users: {
    list: () => ipcRenderer.invoke('api:users:list'),
    create: (data: any) => ipcRenderer.invoke('api:users:create', data),
    update: (data: any) => ipcRenderer.invoke('api:users:update', data),
    updatePin: (data: any) => ipcRenderer.invoke('api:users:updatePin', data),
    changePassword: (data: any) => ipcRenderer.invoke('api:users:changePassword', data),
  },
  shifts: {
    getCurrent: () => ipcRenderer.invoke('api:shifts:getCurrent'),
    hasAnyOpen: () => ipcRenderer.invoke('api:shifts:hasAnyOpen'),
    getLastClosedFloat: () => ipcRenderer.invoke('api:shifts:getLastClosedFloat'),
    open: (payload: any) => ipcRenderer.invoke('api:shifts:open', payload),
    addCashTx: (payload: any) => ipcRenderer.invoke('api:shifts:addCashTx', payload),
    getSummary: (shiftId: string) => ipcRenderer.invoke('api:shifts:getSummary', shiftId),
    close: (payload: any) => ipcRenderer.invoke('api:shifts:close', payload),
    getHistory: (limit?: number) => ipcRenderer.invoke('api:shifts:getHistory', limit),
  },
  settings: {
    previewInvoice: (overrides?: Record<string, any>) =>
      ipcRenderer.invoke('api:settings:previewInvoice', overrides),
    get: () => ipcRenderer.invoke('api:settings:get'),
    update: (data: any) => ipcRenderer.invoke('api:settings:update', data),
    generateRecoveryCodes: () => ipcRenderer.invoke('api:settings:generateRecoveryCodes'),
    exportRecoveryCodes: (codes: string[]) => ipcRenderer.invoke('api:settings:exportRecoveryCodes', codes),
  },
  audit: {
    list: (limit?: number) => ipcRenderer.invoke('api:audit:list', limit),
  },
  sync: {
    getStatus: () => ipcRenderer.invoke('api:sync:getStatus'),
    triggerNow: () => ipcRenderer.invoke('api:sync:triggerNow'),
    configure: (config: any) => ipcRenderer.invoke('api:sync:configure', config),
  },
  gdrive: {
    status: () => ipcRenderer.invoke('api:gdrive:status'),
    getAuthUrl: () => ipcRenderer.invoke('api:gdrive:getAuthUrl'),
    authorize: (code: string) => ipcRenderer.invoke('api:gdrive:authorize', code),
    disconnect: () => ipcRenderer.invoke('api:gdrive:disconnect'),
    restoreLatest: () => ipcRenderer.invoke('api:gdrive:restoreLatest'),
  },
  backup: {
    selectFolder: () => ipcRenderer.invoke('api:backup:selectFolder'),
    selectFile: () => ipcRenderer.invoke('api:backup:selectFile'),
    getFileInfo: (filePath: string) => ipcRenderer.invoke('api:backup:getFileInfo', filePath),
    restoreLocalFile: (filePath: string) => ipcRenderer.invoke('api:backup:restoreLocalFile', filePath),
    list: () => ipcRenderer.invoke('api:backup:list'),
    createManual: () => ipcRenderer.invoke('api:backup:createManual'),
    restore: (backupFilePath: string) => ipcRenderer.invoke('api:backup:restore', backupFilePath),
  },
  wizard: {
    checkStatus: () => ipcRenderer.invoke('api:wizard:checkStatus'),
    completeFirstRun: (payload: any) => ipcRenderer.invoke('api:wizard:completeFirstRun', payload),
  },
  demo: {
    seed: () => ipcRenderer.invoke('api:demo:seed'),
  },
  data: {
    counts: () => ipcRenderer.invoke('api:data:counts'),
    erase: (args: { password: string; confirmText: string }) => ipcRenderer.invoke('api:data:erase', args),
  },
  app: {
    info: () => ipcRenderer.invoke('api:app:info'),
  },
});

