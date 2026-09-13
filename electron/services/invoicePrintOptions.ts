/*
 * What an invoice looks like when it prints.
 *
 * The generator used to branch on a single `isThermal` boolean, which works for
 * exactly two papers and nothing else. A third size, and any owner-set margin or
 * type size, needs the geometry described rather than hardcoded at each call.
 *
 * Sizes are derived from one base rather than listed per element: an owner who
 * nudges the type up expects the whole receipt to scale, not the body text to
 * grow into the headings.
 */

/*
 * Two papers, not three. A5 was offered and never used: a shop prints
 * either a thermal receipt at the counter or a full-page memo for a trade
 * customer, and the half sheet sat between the two doing neither job while
 * every layout, preview and print path had to carry a third case.
 */
export type InvoicePaper = '80mm' | 'a4';

export const INVOICE_PAPERS: InvoicePaper[] = ['80mm', 'a4'];

export interface InvoicePrintOptions {
  paper: InvoicePaper;
  /** Page margin, in millimetres - the unit printers and owners both think in. */
  marginMm: number;
  /** Base type size in points; every other size is a multiple of it. */
  fontPt: number;
  showAddress: boolean;
  showPhone: boolean;
  showQr: boolean;
  showCashier: boolean;
  showNameBn: boolean;
  showFooter: boolean;

  /*
   * The masthead. A shop's paperwork is not just its name: the trade licence or
   * VAT line has to appear on a memo, and what the document calls itself - CASH
   * MEMO, INVOICE, ESTIMATE - decides how a customer treats it.
   */
  logoDataUrl: string;
  showLogo: boolean;
  logoHeightMm: number;
  title: string;
  headerNote: string;

  /** Terms printed under the footer note, one line each. */
  terms: string;
  showSignature: boolean;
  /**
   * The shop's own signature, scanned once and printed on every memo.
   *
   * Only the shop's side. The customer signs by hand on their copy - that is
   * the whole point of their line - so there is deliberately no image for it.
   */
  signatureDataUrl: string;
  signatureHeightMm: number;
  /**
   * A second signature line, on the customer's side.
   *
   * A memo that only the shop signs records the shop's word for what was
   * handed over. Both signatures on the paper is what makes it an
   * acknowledgement, which is why every trade memo carries the pair.
   */
  showCustomerSignature: boolean;

  /** Footer contacts. A shop with neither prints neither - no empty labels. */
  web: string;
  email: string;
}

/** Page geometry in PDF points. 80mm roll is 226pt wide and rolls on forever. */
export const PAPER_GEOMETRY: Record<
  InvoicePaper,
  { widthPt: number; pdfPageSize: any; defaultMarginMm: number; defaultFontPt: number; label: string }
> = {
  '80mm': {
    widthPt: 226,
    pdfPageSize: { width: 226, height: 'auto' },
    defaultMarginMm: 3,
    defaultFontPt: 8,
    label: '80mm Thermal Receipt (POS roll)',
  },
  a4: {
    widthPt: 595,
    pdfPageSize: 'A4',
    defaultMarginMm: 12,
    defaultFontPt: 10,
    label: 'A4 Invoice (full page)',
  },
};

export const MM_TO_PT = 2.834645669;

export function isInvoicePaper(value: unknown): value is InvoicePaper {
  return typeof value === 'string' && (INVOICE_PAPERS as string[]).includes(value);
}

/**
 * Relative type scale. One base size, everything else a multiple of it, so the
 * hierarchy survives whatever the owner sets.
 */
export function typeScale(fontPt: number) {
  return {
    shopName: fontPt * 1.7,
    shopMeta: fontPt * 0.95,
    meta: fontPt * 0.95,
    tableHead: fontPt,
    tableBody: fontPt * 0.95,
    total: fontPt * 1.05,
    grandTotal: fontPt * 1.25,
    footer: fontPt * 0.95,
    fine: fontPt * 0.8,
  };
}

const asBool = (value: string | undefined, fallback: boolean) =>
  value === undefined || value === '' ? fallback : value !== '0';

const asNumber = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * Reads the saved layout out of a settings map.
 *
 * `overridePaper` is the paper picked for one print at the till - the toggle on
 * the payment screen - which beats the shop default without changing it.
 */
export function printOptionsFromSettings(
  map: Record<string, string>,
  overridePaper?: string | null
): InvoicePrintOptions {
  const saved = map['default_invoice_layout'];
  const paper: InvoicePaper = isInvoicePaper(overridePaper)
    ? overridePaper
    : isInvoicePaper(saved)
    ? saved
    : '80mm';

  const geometry = PAPER_GEOMETRY[paper];

  return {
    paper,
    marginMm: asNumber(map['invoice_margin_mm'], geometry.defaultMarginMm, 0, 40),
    fontPt: asNumber(map['invoice_font_pt'], geometry.defaultFontPt, 6, 16),
    showAddress: asBool(map['invoice_show_address'], true),
    showPhone: asBool(map['invoice_show_phone'], true),
    showQr: asBool(map['invoice_show_qr'], true),
    showCashier: asBool(map['invoice_show_cashier'], true),
    showNameBn: asBool(map['invoice_show_name_bn'], true),
    showFooter: asBool(map['invoice_show_footer'], true),

    logoDataUrl: map['invoice_logo'] || '',
    showLogo: asBool(map['invoice_show_logo'], true),
    logoHeightMm: asNumber(map['invoice_logo_height_mm'], 12, 5, 40),
    title: map['invoice_title'] || '',
    headerNote: map['invoice_header_note'] || '',
    terms: map['invoice_terms'] || '',
    showSignature: asBool(map['invoice_show_signature'], false),
    signatureDataUrl: map['invoice_signature'] || '',
    signatureHeightMm: asNumber(map['invoice_signature_height_mm'], 14, 6, 30),
    showCustomerSignature: asBool(map['invoice_show_customer_signature'], false),

    web: map['shop_web'] || '',
    email: map['shop_email'] || '',
  };
}

export function defaultPrintOptions(paper: InvoicePaper = '80mm'): InvoicePrintOptions {
  return printOptionsFromSettings({ default_invoice_layout: paper });
}
