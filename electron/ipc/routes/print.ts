import { ipcMain, BrowserWindow, app, shell, dialog } from 'electron';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { getDb } from '../../db';
import { requireRole } from '../shared';

/**
 * How the shop wants receipts to come out.
 *
 * A counter that sells fifty small parts a day was made to answer the Windows
 * print dialog fifty times, for the same printer every time. With a printer
 * chosen here the receipt simply prints.
 *
 * Anything unset, or a chosen printer that is no longer attached, falls back to
 * the dialog rather than failing - a receipt that asks which printer is a
 * nuisance, a receipt that silently goes nowhere is a lost sale record.
 */
function receiptPrinter(): { silent: boolean; deviceName?: string } {
  try {
    const rows = getDb()
      .prepare("SELECT key, value FROM settings WHERE key IN ('silent_print', 'receipt_printer_name', 'has_printer')")
      .all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    rows.forEach((r) => { map[r.key] = r.value; });

    const deviceName = (map['receipt_printer_name'] || '').trim();
    if (map['has_printer'] === '0' || map['silent_print'] !== '1' || !deviceName) return { silent: false };
    return { silent: true, deviceName };
  } catch {
    return { silent: false };
  }
}

/*
 * Printing a document, rather than a screenshot of the app.
 *
 * The renderer used to reach for window.open, which Electron denies by default,
 * and then for an iframe, whose pagination the print dialog's own margin
 * setting can override - which is how a long Z-report lost rows off the end and
 * came out with the wrong spacing.
 *
 * Here the document is loaded as a real top-level page and Chromium paginates
 * it the way it paginates any page. The page size is fixed to A4 in code; the
 * margin is left to the document's own @page rule, which Chromium honours over
 * anything passed here.
 */

/** Loads html into an offscreen window and hands back its webContents. */
async function withDocument<T>(html: string, run: (win: BrowserWindow) => Promise<T>): Promise<T> {
  const file = path.join(app.getPath('temp'), `mcpos-print-${Date.now()}.html`);
  fs.writeFileSync(file, html, 'utf8');

  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false },
  });

  try {
    await win.loadFile(file);
    // Give layout and web fonts a moment; printing a half-laid-out page is how
    // rows end up clipped.
    await new Promise((resolve) => setTimeout(resolve, 250));
    return await run(win);
  } finally {
    if (!win.isDestroyed()) win.destroy();
    fs.promises.unlink(file).catch(() => {});
  }
}

export function registerPrintHandlers() {
  /**
   * The printers Windows knows about, so Settings can offer a list rather than
   * asking the shop to type a device name exactly right.
   */
  ipcMain.handle('api:print:listPrinters', async () => {
    requireRole(['owner', 'staff']);
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [];
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
    }));
  });

  /**
   * Opens the system print dialog for a document.
   *
   * The margin is left to the document's own @page rule and explicitly not set
   * here. Chromium lets @page win, so asking for a margin in both places gave a
   * sheet with none at all - the document said zero and this said 14mm, the
   * document won, and the last rows of a long report ran off the paper.
   */
  ipcMain.handle('api:print:document', async (_event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const { html } = z
      .object({ html: z.string().min(1), marginMm: z.number().min(0).max(40).optional() })
      .parse(rawArgs);

    return withDocument(html, (win) =>
      new Promise((resolve, reject) => {
        win.webContents.print(
          {
            silent: false,
            printBackground: true,
            pageSize: 'A4',
            margins: { marginType: 'none' },
          },
          (success, reason) => {
            // Closing the dialog is an ordinary outcome, not a failure.
            if (success || reason === 'cancelled') resolve({ success, cancelled: !success });
            else reject(new Error(reason || 'The document could not be printed.'));
          }
        );
      })
    );
  });

  /**
   * Prints a PDF that has already been generated.
   *
   * The invoice is produced once, by invoicePdf.ts, and that file is the
   * document the shop actually hands over. Everything else here takes HTML and
   * lays it out again, which is how the memo on screen, the memo that printed
   * and the memo in the PDF all came to look different - three drawings of one
   * bill. Given the PDF itself, Chromium's viewer paginates it exactly as it
   * was written.
   */
  ipcMain.handle('api:print:pdf', async (_event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const { pdfBase64 } = z
      .object({ pdfBase64: z.string().min(1), fileName: z.string().optional() })
      .parse(rawArgs);

    const file = path.join(app.getPath('temp'), `mcpos-invoice-${Date.now()}.pdf`);
    fs.writeFileSync(file, Buffer.from(pdfBase64.replace(/^data:.*?base64,/, ''), 'base64'));

    // `plugins` is what enables the built-in PDF viewer; without it the window
    // loads a blank page and prints one.
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, plugins: true },
    });

    try {
      // loadFile, not a file:// URL: building one from a Windows path means
      // escaping backslashes, and getting that wrong loads nothing at all.
      await win.loadFile(file);
      // The viewer renders after load; printing too early gives a blank sheet.
      await new Promise((resolve) => setTimeout(resolve, 600));

      const chosen = receiptPrinter();
      /*
       * A named printer that has since been unplugged or renamed would make
       * Electron fail the job outright, and silently - the cashier sees a
       * success toast and no paper. Checking first means such a shop gets the
       * dialog back instead.
       */
      let silent = chosen.silent;
      if (silent) {
        const available = await win.webContents.getPrintersAsync();
        if (!available.some((p) => p.name === chosen.deviceName)) {
          console.warn(`Receipt printer "${chosen.deviceName}" was not found; falling back to the print dialog.`);
          silent = false;
        }
      }

      return await new Promise((resolve, reject) => {
        win.webContents.print(
          silent
            ? { silent: true, printBackground: true, deviceName: chosen.deviceName }
            : { silent: false, printBackground: true },
          (success, reason) => {
            if (success || reason === 'cancelled') resolve({ success, cancelled: !success });
            else reject(new Error(reason || 'The invoice could not be printed.'));
          }
        );
      });
    } finally {
      if (!win.isDestroyed()) win.destroy();
      fs.promises.unlink(file).catch(() => {});
    }
  });

  /**
   * Saves an invoice PDF where the user chooses, then opens it.
   *
   * The memo's Download PDF used to be an <a download> pointed at a data: URL.
   * Electron did start a download from it, but nothing ever showed where the
   * file went and nothing opened it, so from the counter the button looked
   * dead. A shop without a printer depends on this button to hand a customer
   * their bill, so it asks where to put the file and then shows it.
   */
  ipcMain.handle('api:print:savePdf', async (event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const { pdfBase64, fileName } = z
      .object({ pdfBase64: z.string().min(1), fileName: z.string().min(1).max(120).default('invoice') })
      .parse(rawArgs);

    const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '-').replace(/\.pdf$/i, '');
    const owner = BrowserWindow.fromWebContents(event.sender) || undefined;
    const choice = await (owner
      ? dialog.showSaveDialog(owner, {
          title: 'Save invoice as PDF',
          defaultPath: path.join(app.getPath('downloads'), `${safeName}.pdf`),
          filters: [{ name: 'PDF document', extensions: ['pdf'] }],
        })
      : dialog.showSaveDialog({
          title: 'Save invoice as PDF',
          defaultPath: path.join(app.getPath('downloads'), `${safeName}.pdf`),
          filters: [{ name: 'PDF document', extensions: ['pdf'] }],
        }));

    if (choice.canceled || !choice.filePath) return { success: false, canceled: true };

    fs.writeFileSync(choice.filePath, Buffer.from(pdfBase64.replace(/^data:.*?base64,/, ''), 'base64'));

    // A file saved and not opened is the same dead end as before. Failing to
    // open it does not undo the save, so that is reported rather than thrown.
    const openError = await shell.openPath(choice.filePath);
    return { success: true, filePath: choice.filePath, opened: !openError };
  });

  /** Writes the document to a PDF and opens it, for saving or emailing. */
  ipcMain.handle('api:print:toPdf', async (_event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const { html, fileName } = z
      .object({
        html: z.string().min(1),
        marginMm: z.number().min(0).max(40).optional(),
        fileName: z.string().min(1).max(120).default('document'),
      })
      .parse(rawArgs);

    // Zero here for the same reason as above: the document's @page rule supplies
    // the margin, and adding one on top of it would inset the sheet twice.
    const pdf = await withDocument(html, (win) =>
      win.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      })
    );

    const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '-');
    const target = path.join(app.getPath('downloads'), `${safeName}.pdf`);
    fs.writeFileSync(target, pdf);
    shell.openPath(target);
    return { success: true, filePath: target };
  });
}
