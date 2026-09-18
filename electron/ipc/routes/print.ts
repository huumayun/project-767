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

/**
 * Removes print scratch files an earlier run left behind.
 *
 * Each job writes its document to the temp folder and deletes it when the
 * job ends. A job that never ended - the PDF-viewer printing above, or the
 * app being killed mid-print - left its file, and a busy counter collected
 * one per sale.
 */
function sweepStalePrintFiles() {
  const dir = app.getPath('temp');
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  fs.promises
    .readdir(dir)
    .then((names) =>
      names
        .filter((n) => /^mcpos-(print|invoice)-\d+\.(html|pdf)$/.test(n))
        .forEach((n) => {
          const file = path.join(dir, n);
          fs.promises
            .stat(file)
            .then((s) => (s.mtimeMs < dayAgo ? fs.promises.unlink(file) : undefined))
            .catch(() => {});
        })
    )
    .catch(() => {});
}

export function registerPrintHandlers() {
  sweepStalePrintFiles();

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
      status: p.status,
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
   * Prints the pages of an invoice, each handed over as an image of the page.
   *
   * The invoice is produced once, by invoicePdf.ts, and that file is the
   * document the shop actually hands over. This used to load the PDF itself
   * into a hidden window and print that, but the page it printed was
   * Chromium's PDF viewer, and printing the viewer from webContents.print()
   * does not behave like printing a page: the job never reached the printer,
   * the callback never fired, and the cashier sat on "Printing…" while the
   * hidden window and its temp file were never cleaned up. An ordinary page
   * sent the same way prints reliably, so the renderer draws each PDF page to
   * an image at print resolution (src/utils/printPdf.ts) and this prints a
   * page of exactly that size around it. The printer gets the same drawing
   * the preview shows.
   */
  ipcMain.handle('api:print:pages', async (_event, rawArgs) => {
    requireRole(['owner', 'staff']);
    const { pages } = z
      .object({
        pages: z
          .array(
            z.object({
              image: z.string().regex(/^data:image\/(png|jpeg);base64,/),
              widthMm: z.number().min(20).max(500),
              heightMm: z.number().min(20).max(3000),
            })
          )
          .min(1)
          .max(50),
        fileName: z.string().optional(),
      })
      .parse(rawArgs);

    // One invoice is one paper size; the first page speaks for the rest.
    const widthMm = pages[0].widthMm;
    const heightMm = pages[0].heightMm;
    const mm = (v: number) => `${v.toFixed(2)}mm`;

    // No margin here or in Electron's options: the image already contains the
    // PDF's own margins, and any margin added around it would shrink the page
    // onto the next sheet - or feed a receipt of blank roll.
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page { size: ${mm(widthMm)} ${mm(heightMm)}; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.page { width: ${mm(widthMm)}; height: ${mm(heightMm)}; overflow: hidden; break-after: page; page-break-after: always; }
.page:last-child { break-after: auto; page-break-after: auto; }
.page img { display: block; width: ${mm(widthMm)}; height: ${mm(heightMm)}; }
</style></head><body>${pages
      .map((p) => `<div class="page"><img src="${p.image}" alt=""></div>`)
      .join('')}</body></html>`;

    return withDocument(html, async (win) => {
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
        const printer = available.find((p) => p.name === chosen.deviceName);
        if (!printer) {
          // Not thrown: a receipt still has to come out of some printer, and
          // the dialog lets the cashier pick one. Refusing outright would leave
          // a customer waiting over a Settings entry.
          console.warn(`Receipt printer "${chosen.deviceName}" is not connected or not found; falling back to the print dialog.`);
          silent = false;
        }
        // A non-zero status can mean offline, but Windows often reports a
        // printer offline until the first job wakes it, so the job is sent
        // anyway and the timeout below catches a printer that really is off.
      }

      // Electron takes the paper size in microns. The receipt roll is a custom
      // size; a driver set to a fixed roll width keeps its own, which is fine.
      const pageSize = { width: Math.round(widthMm * 1000), height: Math.round(heightMm * 1000) };

      return await new Promise<{ success: boolean; cancelled?: boolean }>((resolve, reject) => {
        // A silent job that never calls back leaves the counter stuck on
        // "Printing…"; the dialog path has no limit, since a person is
        // choosing. Thirty seconds is longer than any spooler takes to accept.
        const limit = silent
          ? setTimeout(() => reject(new Error('The printer did not respond. Check that it is on and connected.')), 30_000)
          : null;

        win.webContents.print(
          silent
            ? { silent: true, printBackground: true, deviceName: chosen.deviceName, pageSize, margins: { marginType: 'none' } }
            : { silent: false, printBackground: true, pageSize, margins: { marginType: 'none' } },
          (success, reason) => {
            if (limit) clearTimeout(limit);
            if (success || reason === 'cancelled') resolve({ success, cancelled: !success });
            else reject(new Error(reason || 'The invoice could not be printed. Check if the printer is connected and turned on.'));
          }
        );
      });
    });
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
