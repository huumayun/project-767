import { ipcMain } from 'electron';
import { ZodError } from 'zod';
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
import { registerDataHandlers } from './routes/data';
import { registerGDriveHandlers } from './routes/gdrive';
import { registerPrintHandlers } from './routes/print';

/**
 * Turns a schema failure into a sentence.
 *
 * z.parse throws a ZodError whose message is the raw issue array, and every
 * handler lets it travel straight to the renderer, where it is shown to the
 * shopkeeper as a toast. Typing a three-digit PIN into Add User produced
 * eighteen lines of JSON beginning `[{ "code": "too_small"` - which reads as
 * "it is broken", not "the PIN needs four digits", so the form looked like it
 * simply would not save.
 */
function readableZodError(error: ZodError): string {
  const label = (path: (string | number)[]) =>
    String(path[path.length - 1] ?? 'value')
      .replace(/_paisa$/, '')
      .replace(/_/g, ' ')
      .replace(/^./, (c) => c.toUpperCase());

  const lines = error.issues.map((issue) => {
    const name = label(issue.path);
    if (issue.code === 'too_small') {
      const min = (issue as any).minimum;
      return issue.type === 'string'
        ? `${name} must be at least ${min} character${min === 1 ? '' : 's'}.`
        : `${name} must be at least ${min}.`;
    }
    if (issue.code === 'too_big') {
      const max = (issue as any).maximum;
      return issue.type === 'string'
        ? `${name} must be at most ${max} characters.`
        : `${name} must be at most ${max}.`;
    }
    if (issue.code === 'invalid_type') {
      return (issue as any).received === 'undefined'
        ? `${name} is required.`
        : `${name} is not valid.`;
    }
    if (issue.code === 'invalid_enum_value') {
      return `${name} must be one of: ${((issue as any).options || []).join(', ')}.`;
    }
    return `${name}: ${issue.message}`;
  });

  return [...new Set(lines)].join(' ');
}

/*
 * Wraps every handler once, here, rather than asking each of the two hundred
 * to remember. Anything that is not a schema failure is passed through
 * untouched, so a handler's own thrown message still reaches the user as it is.
 */
function installValidationErrorFormatter() {
  const original = ipcMain.handle.bind(ipcMain);
  (ipcMain as any).handle = (channel: string, listener: (...args: any[]) => any) =>
    original(channel, async (...args: any[]) => {
      try {
        return await listener(...args);
      } catch (err) {
        if (err instanceof ZodError) throw new Error(readableZodError(err));
        throw err;
      }
    });
}

export function registerIpcHandlers() {
  installValidationErrorFormatter();

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
  registerDataHandlers();
  registerGDriveHandlers();
  registerPrintHandlers();
}
