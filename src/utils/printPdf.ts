import * as pdfjs from 'pdfjs-dist';
// Bundled into the app as a blob: worker. A worker fetched by URL would need
// CSP 'self' to cover it, and under the packaged app's file:// origin 'self'
// does not reliably match (see vite.config.mts on fonts); blob: is explicit.
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&inline';

/*
 * Printing an invoice PDF, by way of a picture of it.
 *
 * The main process used to load the PDF into a hidden window and print that
 * window. The page that shows is Chromium's PDF viewer, and printing the
 * viewer from webContents.print() does not work the way printing a page does:
 * the job either never reaches the printer or the callback never fires, so the
 * cashier sat on "Printing…" with no paper, and the hidden window and its temp
 * file were never cleaned up. A plain HTML page sent the same way prints
 * reliably, silent or through the dialog.
 *
 * So the PDF is drawn here, page by page, into a canvas at print resolution,
 * and each page goes to the main process as an image of exactly the page's
 * size. The printer gets the same drawing the preview shows.
 */

const worker = new PdfWorker();
pdfjs.GlobalWorkerOptions.workerPort = worker;

/** Points per inch in a PDF, and millimetres per point. */
const PT_PER_INCH = 72;
const MM_PER_PT = 25.4 / PT_PER_INCH;

/**
 * Dots per inch to draw at. A thermal receipt printer is 203 dpi and a laser
 * 300 or 600; 216 keeps 8pt text crisp on the roll without making an A4 page
 * a multi-megabyte image.
 */
const RENDER_DPI = 216;

export interface RenderedPage {
  /** PNG data URL. */
  image: string;
  widthMm: number;
  heightMm: number;
}

function base64ToBytes(base64: string): Uint8Array {
  const raw = atob(base64.replace(/^data:.*?base64,/, ''));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Draws every page of the PDF to an image at RENDER_DPI. */
export async function renderPdfPages(pdfBase64: string): Promise<RenderedPage[]> {
  const doc = await pdfjs.getDocument({ data: base64ToBytes(pdfBase64) }).promise;
  try {
    const pages: RenderedPage[] = [];
    const scale = RENDER_DPI / PT_PER_INCH;

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const natural = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('The invoice could not be drawn for printing.');

      // A PDF page is transparent where nothing is drawn; paper is white.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      pages.push({
        image: canvas.toDataURL('image/png'),
        widthMm: natural.width * MM_PER_PT,
        heightMm: natural.height * MM_PER_PT,
      });
      page.cleanup();
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/**
 * Prints an invoice PDF: silently to the receipt printer when Settings say so,
 * otherwise through the print dialog. Resolves once the job is handed over or
 * the dialog is closed; rejects when the printer refuses it.
 */
export async function printInvoicePdf(
  pdfBase64: string,
  fileName?: string
): Promise<{ success: boolean; cancelled?: boolean }> {
  if (!window.api?.print?.pages) throw new Error('Printing is not available here.');
  const pages = await renderPdfPages(pdfBase64);
  if (pages.length === 0) throw new Error('The invoice has no pages to print.');
  return window.api.print.pages({ pages, fileName });
}
