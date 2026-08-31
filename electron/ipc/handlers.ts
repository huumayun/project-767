import { ipcMain } from 'electron';
import { registerPingHandlers } from './routes/ping';
import { registerAuthHandlers } from './routes/auth';
import { registerShellHandlers } from './routes/shell';
import { registerCategoriesHandlers } from './routes/categories';
import { registerProductsHandlers } from './routes/products';
import { registerSalesHandlers } from './routes/sales';
import { registerCustomersHandlers } from './routes/customers';
import { registerReportsHandlers } from './routes/reports';
import { registerUsersHandlers } from './routes/users';
import { registerShiftsHandlers } from './routes/shifts';
import { registerSettingsHandlers } from './routes/settings';
import { registerAuditHandlers } from './routes/audit';
import { registerSyncHandlers } from './routes/sync';
import { registerBackupHandlers } from './routes/backup';
import { registerSuppliersHandlers } from './routes/suppliers';
import { registerPurchasesHandlers } from './routes/purchases';
import { registerStockTransactionsHandlers } from './routes/stockTransactions';
import { registerWizardHandlers } from './routes/wizard';
import { registerDemoHandlers } from './routes/demo';
import { registerGDriveHandlers } from './routes/gdrive';

export function registerIpcHandlers() {
  // Registered Route Handlers
  registerPingHandlers();
  registerAuthHandlers();
  registerShellHandlers();
  registerCategoriesHandlers();
  registerProductsHandlers();

  registerSalesHandlers();
  registerCustomersHandlers();
  registerReportsHandlers();
  registerUsersHandlers();
  registerShiftsHandlers();
  registerSettingsHandlers();
  registerAuditHandlers();
  registerSyncHandlers();
  registerBackupHandlers();
  registerSuppliersHandlers();
  registerPurchasesHandlers();
  registerStockTransactionsHandlers();
  registerWizardHandlers();
  registerDemoHandlers();
  registerGDriveHandlers();
}
