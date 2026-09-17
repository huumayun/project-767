/*
 * Shows a printable document and prints it, without window.open.
 *
 * Electron denies window.open by default (no setWindowOpenHandler is
 * registered), so every print path that reached for a second window got null
 * back. The Z-report reported "pop-ups blocked" when nothing had blocked
 * anything - there was no pop-up to block.
 *
 * An iframe does the job instead: printing one prints only its own document and
 * honours its own @page rule, so the A4 sheet comes out as written rather than
 * as a screenshot of the app around it. The toolbar lives outside the frame, so
 * it cannot land on the paper.
 */

export interface PrintPreviewOptions {
  /** Shown in the toolbar so it is obvious what is about to print. */
  label?: string;
  /**
   * An optional switch in the toolbar that re-renders the document.
   *
   * A busy shift runs to several pages once every bill is listed, and an owner
   * checking a cash-up often wants the one-page summary instead. Rather than
   * guess, the choice sits next to the Print button.
   */
  toggle?: {
    label: string;
    on: boolean;
    render: (on: boolean) => string;
  };
  /** Page margin in millimetres, applied by the print pipeline rather than CSS. */
  marginMm?: number;
  /** Base name for the PDF, if the owner saves one. */
  fileName?: string;
}

export function openPrintPreview(html: string, options: PrintPreviewOptions = {}): void {
  const label = options.label || 'Print preview';

  const host = document.createElement('div');
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-label', label);
  host.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;background:#0f172a';

  const bar = document.createElement('div');
  bar.style.cssText =
    'flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;' +
    'padding:10px 16px;background:#0f172a;color:#fff;-webkit-app-region:drag;' +
    "font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:13px";

  const caption = document.createElement('span');
  caption.textContent = label;

  const actions = document.createElement('span');
  // 140px padding on the right to avoid overlapping with Windows titlebar control buttons
  actions.style.cssText = 'display:flex;gap:8px;padding-right:140px;-webkit-app-region:no-drag;';

  const button = (text: string, background: string, color: string) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.textContent = text;
    el.style.cssText =
      `font:inherit;font-weight:600;border:0;border-radius:8px;padding:7px 18px;cursor:pointer;background:${background};color:${color}`;
    return el;
  };

  const printButton = button('Print', '#356464', '#ffffff');
  const pdfButton = button('Save PDF', '#334155', '#e2e8f0');
  const closeButton = button('Close', '#334155', '#e2e8f0');

  const frame = document.createElement('iframe');
  frame.title = label;
  frame.style.cssText = 'flex:1 1 auto;width:100%;border:0;background:#f1f5f9';
  frame.srcdoc = html;

  if (options.toggle) {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;margin-right:8px';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = options.toggle.on;
    box.style.cssText = 'width:15px;height:15px;cursor:pointer;accent-color:#468686';
    const text = document.createElement('span');
    text.textContent = options.toggle.label;
    box.addEventListener('change', () => {
      frame.srcdoc = options.toggle!.render(box.checked);
    });
    wrap.append(box, text);
    actions.append(wrap);
  }

  const close = () => {
    document.removeEventListener('keydown', onKey, true);
    host.remove();
  };

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  /*
   * The document goes to the main process to be printed, not to this iframe.
   * Printing a frame leaves pagination at the mercy of the dialog's margin
   * setting - "None" pushes the last rows into the printer's unprintable edge
   * and they simply vanish. Sent as a document, the page size and margins are
   * fixed in code and the same sheet comes out every time.
   */
  const currentHtml = () => frame.getAttribute('srcdoc') || html;

  printButton.addEventListener('click', async () => {
    if (!window.api?.print) {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      return;
    }
    printButton.disabled = true;
    try {
      await window.api.print.document({ html: currentHtml(), marginMm: options.marginMm ?? 14 });
    } finally {
      printButton.disabled = false;
    }
  });

  pdfButton.addEventListener('click', async () => {
    if (!window.api?.print) return;
    pdfButton.disabled = true;
    try {
      await window.api.print.toPdf({
        html: currentHtml(),
        marginMm: options.marginMm ?? 14,
        fileName: options.fileName || 'document',
      });
    } finally {
      pdfButton.disabled = false;
    }
  });
  closeButton.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);

  actions.append(printButton, pdfButton, closeButton);
  bar.append(caption, actions);
  host.append(bar, frame);
  document.body.append(host);

  frame.addEventListener('load', () => frame.contentWindow?.focus());
}
