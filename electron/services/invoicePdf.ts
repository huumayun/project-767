import QRCode from 'qrcode';
import { takaInWords } from './amountInWords';
import {
  InvoicePaper,
  InvoicePrintOptions,
  PAPER_GEOMETRY,
  MM_TO_PT,
  typeScale,
  defaultPrintOptions,
} from './invoicePrintOptions';

// Invoice details interface
export interface InvoicePdfData {
  shopName: string;
  shopAddress: string;
  shopPhone?: string;
  invoiceContacts?: { name: string; phone: string }[];
  invoiceFooter: string;
  invoiceNo: string;
  /** When the sale happened, as a timestamp (ISO). Formatted for print here. */
  date: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  /** Printed under the client's name on a full-page memo. */
  customerAddress?: string | null;
  items: Array<{
    name: string;
    nameBn?: string;
    qty: number;
    unitPricePaisa: number;
    discountPaisa: number;
    totalPaisa: number;
  }>;
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  payments: Array<{
    method: string;
    amountPaisa: number;
  }>;
  totalPaidPaisa: number;
  changePaisa?: number;
  duePaisa?: number;
  returnedPaisa?: number;
  refundedPaisa?: number;
}

/**
 * The sale's date as printed on a receipt: 13/09/2026 5:40:49 AM.
 *
 * Callers used to hand over that string already formatted, and the A4 memo
 * then read it back with new Date() to fill its day/month/year boxes. JS reads
 * "05/09/2026" month-first, so a sale on 5 September was printed as 9 May, and
 * anything after the 12th ("13/09/2026") did not parse at all and left the
 * boxes blank. The Settings sample passed a timestamp instead, which is why its
 * preview looked right while real invoices did not. Callers now pass the
 * timestamp, and formatting for people happens here, once.
 *
 * A value that is not a timestamp is printed as it came, so nothing that still
 * passes a formatted string loses its date.
 */
function printedDate(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString();
}

/*
 * The full-page memo.
 *
 * A4 is not a long receipt, and printing it as one wasted most of the sheet:
 * everything centred down a narrow column, the buyer's details squeezed beside
 * the shop's, no room to sign. A trade memo here has a settled shape - who it
 * is for on the left and when on the right, a ruled table of goods, the money
 * stacked at the bottom right with the amount written out beside it, and two
 * signatures - and that shape is what this builds.
 *
 * 80mm and A5 keep the receipt layout above; a thermal roll has no use for any
 * of this.
 */
function buildMemoContent(
  data: InvoicePdfData,
  opts: InvoicePrintOptions,
  contentWidthPt: number,
  size: ReturnType<typeof typeScale>,
  qrDataUrl: string | null
): any[] {
  const money = (paisa: number) =>
    (paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const INK = '#0f172a';
  const MUTED = '#475569';
  const RULE = '#94a3b8';
  const BAND = '#eef2f1';

  // The date split into its parts, as the boxes on a printed memo have it.
  const d = new Date(data.date);
  const parsed = !isNaN(d.getTime());
  const dd = parsed ? String(d.getDate()).padStart(2, '0') : '';
  const mm = parsed ? String(d.getMonth() + 1).padStart(2, '0') : '';
  const yyyy = parsed ? String(d.getFullYear()) : '';

  const dateBox = (text: string) => ({
    table: { widths: [22], body: [[{ text, alignment: 'center', fontSize: size.meta, bold: true, margin: [0, 1, 0, 1] }]] },
    layout: {
      hLineWidth: () => 0.7, vLineWidth: () => 0.7,
      hLineColor: () => RULE, vLineColor: () => RULE,
    },
  });

  const labelled = (label: string, value: string) => ({
    columns: [
      { width: 62, text: label, fontSize: size.meta, color: MUTED },
      { width: '*', text: value || '', fontSize: size.meta, bold: true, color: INK },
    ],
    margin: [0, 0, 0, 2],
  });

  // ── the goods ───────────────────────────────────────────────────────────
  const body: any[] = [
    [
      { text: 'SL #', style: 'th', alignment: 'center' },
      { text: 'Description', style: 'th' },
      { text: 'Quantity', style: 'th', alignment: 'center' },
      { text: 'Unit Price', style: 'th', alignment: 'right' },
      { text: 'Amount', style: 'th', alignment: 'right' },
    ],
  ];
  data.items.forEach((item, i) => {
    body.push([
      { text: String(i + 1), alignment: 'center', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
      {
        // Wraps. The sample this follows cut its own descriptions off at the
        // column edge - "DOUBLE DISPLAY AND CO" - which loses the part that
        // says which model was sold.
        text: item.name + (opts.showNameBn && item.nameBn ? ` (${item.nameBn})` : ''),
        fontSize: size.tableBody,
        margin: [0, 1.5, 0, 1.5],
      },
      { text: String(item.qty), alignment: 'center', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
      { text: money(item.unitPricePaisa), alignment: 'right', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
      { text: money(item.totalPaisa), alignment: 'right', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
    ]);
  });

  // ── the money ───────────────────────────────────────────────────────────
  const totalsRow = (label: string, value: string, o: { bold?: boolean; rule?: boolean; color?: string } = {}) => [
    {
      text: label,
      alignment: 'right',
      fontSize: o.bold ? size.total : size.meta,
      bold: o.bold,
      color: o.color || (o.bold ? INK : MUTED),
      margin: [0, o.rule ? 3 : 1, 6, 1],
      border: [false, o.rule || false, false, false],
      borderColor: [RULE, RULE, RULE, RULE],
    },
    {
      text: value,
      alignment: 'right',
      fontSize: o.bold ? size.total : size.meta,
      bold: o.bold,
      color: o.color || INK,
      margin: [0, o.rule ? 3 : 1, 0, 1],
      border: [false, o.rule || false, false, false],
      borderColor: [RULE, RULE, RULE, RULE],
    },
  ];

  const totalsBody: any[] = [totalsRow('Total Amount :', money(data.subtotalPaisa))];
  if (data.discountPaisa > 0) totalsBody.push(totalsRow('Discount :', money(data.discountPaisa)));
  if ((data.returnedPaisa || 0) > 0) totalsBody.push(totalsRow('Returns Deducted :', `-${money(data.returnedPaisa || 0)}`, { color: '#e11d48' }));
  const finalTotal = data.totalPaisa - (data.returnedPaisa || 0);
  totalsBody.push(totalsRow('Net Payable :', money(finalTotal), { bold: true, rule: true }));
  if ((data.refundedPaisa || 0) > 0) {
    totalsBody.push(totalsRow('Paid Amount (Original) :', money(data.totalPaidPaisa)));
    totalsBody.push(totalsRow('Refunded to Customer :', `-${money(data.refundedPaisa || 0)}`, { color: '#e11d48' }));
  } else {
    totalsBody.push(totalsRow('Paid Amount :', money(data.totalPaidPaisa)));
  }
  if ((data.changePaisa || 0) > 0) totalsBody.push(totalsRow('Change Returned :', money(data.changePaisa || 0)));
  totalsBody.push(totalsRow('Total Outstanding :', money(data.duePaisa || 0), { bold: true, rule: true }));

  const sigHeightPt = Math.round(opts.signatureHeightMm * MM_TO_PT);

  /*
   * Only a raster signature is handed to the renderer.
   *
   * pdfmake's `image` accepts PNG and JPEG and throws "Unknown image format"
   * on anything else - an SVG among them - and that throw takes the whole
   * invoice down. Settings rasterises whatever is picked, so this is the
   * belt on a setting that could also be written directly: a decorative
   * image is never worth losing the customer's bill over.
   */
  const rasterSignature = /^data:image\/(png|jpe?g);base64,/i.test(opts.signatureDataUrl || '')
    ? opts.signatureDataUrl
    : '';

  /*
   * `image` is the stored signature, drawn sitting ON the rule rather than
   * above a gap - a signature floating clear of its own line reads as a
   * picture someone pasted, not as a signed document. Where there is no image
   * the same height is left blank, so a hand-signed copy and a pre-signed one
   * come off the printer the same size and the totals above them do not shift.
   */
  const signature = (caption: string, image?: string) => ({
    width: contentWidthPt * 0.3,
    stack: [
      image
        ? { image, fit: [contentWidthPt * 0.28, sigHeightPt], alignment: 'center', margin: [0, 0, 0, 1] }
        : { text: '', margin: [0, 0, 0, sigHeightPt + 1] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidthPt * 0.3, y2: 0, lineWidth: 0.7, lineColor: RULE }] },
      { text: caption, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 3, 0, 0] },
    ],
  });

  const footerLines = [
    [
      opts.web ? `Web : ${opts.web}` : '',
      opts.email ? `E-mail : ${opts.email}` : '',
    ].filter(Boolean).join('   '),
  ].filter(Boolean);

  return [
    // ── masthead: the logo carries the brand, so the name only fills in
    //    where there is no logo to carry it.
    {
      stack: [
        opts.showLogo && opts.logoDataUrl
          ? { image: opts.logoDataUrl, fit: [contentWidthPt, Math.round(opts.logoHeightMm * MM_TO_PT)], alignment: 'center', margin: [0, 0, 0, 4] }
          : { text: data.shopName, fontSize: size.shopName, bold: true, alignment: 'center', color: INK },
        opts.headerNote
          ? { text: opts.headerNote, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 2, 0, 0] }
          : {},
        opts.showAddress && data.shopAddress
          ? { text: data.shopAddress, fontSize: size.shopMeta, color: MUTED, alignment: 'center', margin: [0, 2, 0, 0] }
          : {},
        opts.showPhone && data.invoiceContacts && data.invoiceContacts.length > 0
          ? { text: data.invoiceContacts.map(c => `${c.name}: ${c.phone}`).join('   |   '), fontSize: size.shopMeta, color: MUTED, alignment: 'center', margin: [0, 2, 0, 0] }
          : opts.showPhone && data.shopPhone
          ? { text: `Phone: ${data.shopPhone}`, fontSize: size.shopMeta, color: MUTED, alignment: 'center', margin: [0, 2, 0, 0] }
          : {},
      ],
      margin: [0, 0, 0, 8],
    },

    // ── what this document is
    {
      table: { widths: ['*'], body: [[{ text: opts.title || 'Sales Invoice', style: 'docTitle' }]] },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => BAND, paddingTop: () => 3, paddingBottom: () => 3 },
      margin: [contentWidthPt * 0.3, 0, contentWidthPt * 0.3, 8],
    },

    // ── who it is for, and when
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              columns: [
                {
                  width: 34,
                  table: { widths: [22], body: [[{ text: 'No', alignment: 'center', fontSize: size.meta, bold: true, color: '#ffffff' }]] },
                  layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => INK },
                },
                { width: '*', text: data.invoiceNo, fontSize: size.meta, bold: true, margin: [4, 0.5, 0, 0] },
              ],
              margin: [0, 0, 0, 3],
            },
            labelled('Client Name :', data.customerName || 'Walk-in Customer'),
            data.customerAddress ? labelled('Address :', data.customerAddress) : {},
          ],
        },
        {
          width: 'auto',
          stack: [
            {
              columns: [
                { width: 'auto', text: 'Date :', fontSize: size.meta, color: MUTED, margin: [0, 2, 6, 0] },
                { width: 'auto', ...dateBox(dd) },
                { width: 'auto', ...dateBox(mm), margin: [3, 0, 0, 0] },
                { width: 'auto', ...dateBox(yyyy === '' ? '' : yyyy), margin: [3, 0, 0, 0] },
              ],
              margin: [0, 0, 0, 4],
            },
            data.customerPhone
              ? { text: [{ text: 'Contact : ', color: MUTED }, { text: data.customerPhone, bold: true }], fontSize: size.meta, alignment: 'right' }
              : {},
            opts.showCashier
              ? { text: [{ text: 'Served by : ', color: MUTED }, { text: data.cashierName }], fontSize: size.fine, alignment: 'right', margin: [0, 2, 0, 0] }
              : {},
          ],
        },
      ],
      margin: [0, 0, 0, 8],
    },

    // ── the goods
    {
      table: { headerRows: 1, widths: [26, '*', 46, 62, 68], body },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
        vLineWidth: () => 0.4,
        hLineColor: (i: number) => (i <= 1 ? INK : '#cbd5e1'),
        vLineColor: () => '#cbd5e1',
        paddingLeft: () => 4, paddingRight: () => 4,
      },
    },

    // ── the money, with the amount written out beside it
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'In words', fontSize: size.fine, color: MUTED, margin: [0, 6, 0, 1] },
            { text: takaInWords(data.totalPaisa), fontSize: size.meta, bold: true, color: INK },
            qrDataUrl ? { image: qrDataUrl, fit: [56, 56], margin: [0, 8, 0, 0] } : {},
          ],
        },
        {
          width: 230,
          table: { widths: ['*', 78], body: totalsBody },
          layout: {
            defaultBorder: false,
            hLineWidth: (i: number, node: any) => (node.table.body[i]?.[0]?.border?.[1] ? 0.8 : 0),
            vLineWidth: () => 0,
            hLineColor: () => RULE,
          },
        },
      ],
      margin: [0, 0, 0, 4],
    },

    // ── the undertaking, and the two people to it
    opts.terms
      ? { text: opts.terms, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 18, 0, 0] }
      : {},
    opts.showSignature || opts.showCustomerSignature
      ? {
          columns: [
            opts.showCustomerSignature ? signature("Customer's Signature") : { width: contentWidthPt * 0.3, text: '' },
            { width: '*', text: '' },
            opts.showSignature
              ? signature('Authorised Signature', rasterSignature || undefined)
              : { width: contentWidthPt * 0.3, text: '' },
          ],
          margin: [0, opts.terms ? 26 : 40, 0, 0],
        }
      : {},

    // ── the shop's own details, at the foot where a memo keeps them
    opts.showFooter
      ? {
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidthPt, y2: 0, lineWidth: 0.8, lineColor: RULE }], margin: [0, 0, 0, 4] },
            {
              columns: [
                { width: '*', text: '' },
                {
                  width: 'auto',
                  stack: [
                    { text: data.shopName, fontSize: size.total, bold: true, alignment: 'center', color: INK },
                    ...footerLines.map((line) => ({ text: line, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 1, 0, 0] })),
                    data.invoiceFooter
                      ? { text: data.invoiceFooter, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 3, 0, 0], italics: true }
                      : {},
                  ],
                },
                {
                  width: '*',
                  text: 'Software by GraamTech',
                  fontSize: size.fine,
                  color: '#94a3b8',
                  alignment: 'right',
                  margin: [0, 2, 0, 0],
                },
              ],
            },
          ],
          margin: [0, 24, 0, 0],
        }
      : {},
  ];
}

export async function generateInvoicePdf(
  data: InvoicePdfData,
  layoutOrOptions: InvoicePaper | InvoicePrintOptions = '80mm'
): Promise<string> {
  // Callers that only know which paper they want still work; the rest pass the
  // owner's saved layout.
  const opts: InvoicePrintOptions =
    typeof layoutOrOptions === 'string' ? defaultPrintOptions(layoutOrOptions) : layoutOrOptions;

  const geometry = PAPER_GEOMETRY[opts.paper];
  const marginPt = Math.round(opts.marginMm * MM_TO_PT);
  const contentWidthPt = geometry.widthPt - marginPt * 2;
  const size = typeScale(opts.fontPt);
  const isThermal = opts.paper === '80mm';

  const qrDataUrl = opts.showQr
    ? await QRCode.toDataURL(data.invoiceNo, {
        margin: 1,
        width: 80,
        errorCorrectionLevel: 'M',
      })
    : null;

  /*
   * Column widths follow the paper rather than a thermal/not-thermal guess: on
   * A4 the fixed columns can afford to be generous, on an 80mm roll every point
   * spent on them is taken from the item name.
   */
  const numericCols: Record<InvoicePaper, [number, number, number]> = {
    '80mm': [22, 38, 42],
    a4: [45, 78, 84],
  };
  const qrFit: Record<InvoicePaper, number> = { '80mm': 50, a4: 72 };

  // Import pdfmake dynamically to support both CJS & ESM bundles
  const pdfMakeModule = require('pdfmake/build/pdfmake');
  const pdfFontsModule = require('pdfmake/build/vfs_fonts');
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  const pdfFonts = pdfFontsModule.default || pdfFontsModule;
  pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

  // Build items table body
  const tableBody: any[] = [
    [
      { text: 'Item', bold: true, fontSize: size.tableHead },
      { text: 'Qty', bold: true, alignment: 'center', fontSize: size.tableHead },
      // "Tk", not the Taka sign. The PDF is set in pdfmake's bundled Roboto,
      // which has no glyph for ৳, so every amount on the receipt printed as
      // an empty box. It went unseen because the on-screen previews were
      // blocked from showing the PDF at all.
      { text: 'Price (Tk)', bold: true, alignment: 'right', fontSize: size.tableHead },
      { text: 'Total (Tk)', bold: true, alignment: 'right', fontSize: size.tableHead },
    ],
  ];

  data.items.forEach((item) => {
    const itemTotalTaka = (item.totalPaisa / 100).toFixed(2);
    const unitPriceTaka = (item.unitPricePaisa / 100).toFixed(2);
    tableBody.push([
      {
        text: item.name + (opts.showNameBn && item.nameBn ? ` (${item.nameBn})` : ''),
        fontSize: isThermal ? 7.5 : 8.5,
      },
      { text: item.qty.toString(), alignment: 'center', fontSize: size.tableBody },
      { text: unitPriceTaka, alignment: 'right', fontSize: size.tableBody },
      { text: itemTotalTaka, alignment: 'right', fontSize: size.tableBody },
    ]);
  });

  const subtotalTaka = (data.subtotalPaisa / 100).toFixed(2);
  const discountTaka = (data.discountPaisa / 100).toFixed(2);
  const totalTaka = (data.totalPaisa / 100).toFixed(2);
  const paidTaka = (data.totalPaidPaisa / 100).toFixed(2);
  const changeTaka = ((data.changePaisa || 0) / 100).toFixed(2);
  const dueTaka = ((data.duePaisa || 0) / 100).toFixed(2);

  const isMemo = opts.paper === 'a4';

  const docDefinition: any = {
    pageSize: geometry.pdfPageSize,
    pageMargins: [marginPt, marginPt, marginPt, marginPt],
    styles: {
      th: { bold: true, fontSize: size.tableHead, color: '#0f172a', margin: [0, 2, 0, 2] },
      docTitle: { bold: true, fontSize: size.total, alignment: 'center', color: '#0f172a', characterSpacing: 0.6 },
    },
    content: isMemo
      ? buildMemoContent(data, opts, contentWidthPt, size, qrDataUrl)
      : [
      // Masthead
      opts.showLogo && opts.logoDataUrl
        ? {
            image: opts.logoDataUrl,
            fit: [contentWidthPt, Math.round(opts.logoHeightMm * MM_TO_PT)],
            alignment: 'center',
            margin: [0, 0, 0, 4],
          }
        : {},
      opts.title
        ? {
            text: opts.title,
            fontSize: size.shopMeta,
            bold: true,
            alignment: 'center',
            characterSpacing: 1.5,
            color: '#475569',
            margin: [0, 0, 0, 2],
          }
        : {},
      { text: data.shopName, fontSize: size.shopName, bold: true, alignment: 'center', margin: [0, 0, 0, -2] },
      opts.headerNote
        ? { text: opts.headerNote, fontSize: size.fine, alignment: 'center', margin: [0, 1, 0, 0] }
        : {},
      opts.showAddress && data.shopAddress
        ? { text: data.shopAddress, fontSize: size.shopMeta, alignment: 'center', margin: [0, 2, 0, 0] }
        : {},
      opts.showPhone && data.invoiceContacts && data.invoiceContacts.length > 0
        ? { text: data.invoiceContacts.map(c => `${c.name}: ${c.phone}`).join('\n'), fontSize: size.shopMeta, alignment: 'center' }
        : opts.showPhone && data.shopPhone
        ? { text: `Phone: ${data.shopPhone}`, fontSize: size.shopMeta, alignment: 'center' }
        : {},
      {
        canvas: [{ type: 'line', x1: 0, y1: 5, x2: contentWidthPt, y2: 5, lineWidth: 1 }],
        margin: [0, 2, 0, 6],
      },

      // Invoice Meta
      {
        columns: [
          {
            width: '*',
            text: [
              { text: `Invoice: `, bold: true },
              { text: `${data.invoiceNo}\n` },
              { text: `Date: ${printedDate(data.date)}\n` },
              opts.showCashier ? { text: `Cashier: ${data.cashierName}\n` } : '',
            ],
            fontSize: size.meta,
          },
          data.customerName
            ? {
                width: '*',
                text: [
                  { text: `Customer: `, bold: true },
                  { text: `${data.customerName}\n` },
                  data.customerPhone ? { text: `Phone: ${data.customerPhone}\n` } : '',
                ],
                fontSize: size.meta,
                alignment: 'right',
              }
            : {},
        ],
        margin: [0, 0, 0, 6],
      },

      // Items Table
      {
        table: {
          headerRows: 1,
          widths: ['*', ...numericCols[opts.paper]],
          body: tableBody,
        },
        layout: {
          hLineWidth: function (i: number, node: any) {
            return 0.5; // Make all horizontal lines thin (0.5 instead of 2/1)
          },
          vLineWidth: function (i: number, node: any) {
            return 0; // No vertical lines
          },
          hLineColor: function (i: number, node: any) {
            return '#0f172a';
          },
          paddingLeft: function (i: number, node: any) { return 0; },
          paddingRight: function (i: number, node: any) { return 0; },
          paddingTop: function (i: number, node: any) { return 3; },
          paddingBottom: function (i: number, node: any) { return 3; }
        },
        margin: [0, 0, 0, 6],
      },

      // Totals & Calculations
      {
        columns: [
          { width: '*', text: '' },
          {
            width: Math.min(contentWidthPt, isThermal ? 120 : opts.paper === 'a4' ? 200 : 160),
            table: {
              widths: ['*', 'auto'],
              body: [
                [{ text: 'Subtotal:', fontSize: size.total }, { text: `Tk ${subtotalTaka}`, alignment: 'right', fontSize: size.total }],
                data.discountPaisa > 0
                  ? [{ text: 'Discount:', fontSize: size.total }, { text: `- Tk ${discountTaka}`, alignment: 'right', fontSize: size.total }]
                  : [],
                [
                  { text: 'Grand Total:', bold: true, fontSize: size.grandTotal },
                  { text: `Tk ${totalTaka}`, bold: true, alignment: 'right', fontSize: size.grandTotal },
                ],
                [{ text: 'Total Paid:', fontSize: size.total }, { text: `Tk ${paidTaka}`, alignment: 'right', fontSize: size.total }],
                data.changePaisa && data.changePaisa > 0
                  ? [{ text: 'Change Returned:', fontSize: size.total }, { text: `Tk ${changeTaka}`, alignment: 'right', fontSize: size.total }]
                  : [],
                data.duePaisa && data.duePaisa > 0
                  ? [{ text: 'Remaining Due:', bold: true, fontSize: size.total, color: '#dc2626' }, { text: `Tk ${dueTaka}`, bold: true, alignment: 'right', fontSize: size.total, color: '#dc2626' }]
                  : [],
              ].filter(row => row.length > 0),
            },
            layout: 'noBorders',
          },
        ],
        margin: [0, 0, 0, 6],
      },

      // Split Payment Details
      data.payments.length > 0
        ? {
            // Printed the way the brands write themselves. Upper-casing the
            // stored id turned bKash into "BKASH" on a customer's receipt.
            text: `Payment: ${data.payments
              .map((p) => {
                const label =
                  ({ cash: 'Cash', bkash: 'bKash', nagad: 'Nagad', card: 'Card', other: 'Other' } as Record<string, string>)[
                    p.method
                  ] || p.method;
                return `${label} (Tk ${(p.amountPaisa / 100).toFixed(2)})`;
              })
              .join(', ')}`,
            fontSize: size.meta,
            color: '#475569',
            margin: [0, 2, 0, 6],
          }
        : {},

      // Footer note and the QR that identifies the invoice
      {
        columns: [
          {
            width: '*',
            text: [
              opts.showFooter && data.invoiceFooter
                ? { text: data.invoiceFooter + '\n', bold: true, fontSize: size.footer }
                : '',
              { text: 'Software by GraamTech\n', fontSize: size.fine, color: '#94a3b8' },
            ],
            alignment: isThermal ? 'center' : 'left',
          },
          qrDataUrl
            ? {
                width: qrFit[opts.paper] + 10,
                image: qrDataUrl,
                fit: [qrFit[opts.paper], qrFit[opts.paper]],
                alignment: 'right',
              }
            : { width: 0, text: '' },
        ],
        margin: [0, 6, 0, 0],
      },

      opts.terms
        ? {
            text: opts.terms,
            fontSize: size.fine,
            color: '#64748b',
            margin: [0, 6, 0, 0],
            alignment: isThermal ? 'center' : 'left',
          }
        : {},

      // A memo that has to be signed needs somewhere to sign. Pointless on a
      // roll, so it is only drawn where there is a margin to draw it in.
      opts.showSignature && !isThermal
        ? {
            columns: [
              { width: '*', text: '' },
              {
                width: contentWidthPt * 0.4,
                stack: [
                  /^data:image\/(png|jpe?g);base64,/i.test(opts.signatureDataUrl || '')
                    ? {
                        image: opts.signatureDataUrl,
                        fit: [contentWidthPt * 0.38, Math.round(opts.signatureHeightMm * MM_TO_PT)],
                        alignment: 'center',
                        margin: [0, 0, 0, 1],
                      }
                    : {},
                  { canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidthPt * 0.4, y2: 0, lineWidth: 0.7 }] },
                  { text: 'Authorised Signature', fontSize: size.fine, alignment: 'center', margin: [0, 3, 0, 0] },
                ],
              },
            ],
            margin: [0, 28, 0, 0],
          }
        : {},
      ],
    defaultStyle: {
      font: 'Roboto',
    },
  };

  return new Promise((resolve, reject) => {
    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBase64((dataUri: string) => {
      resolve(dataUri);
    });
  });
}

// ─── Return / Credit Note PDF ────────────────────────────────────────────────

export interface ReturnInvoicePdfData {
  shopName: string;
  shopAddress: string;
  shopPhone?: string;
  invoiceFooter: string;
  /** The RTN-... number generated for this return. */
  returnInvoiceNo: string;
  /** The original INV-... sale invoice this return is against. */
  originalInvoiceNo: string;
  /** When the return was processed (ISO timestamp). */
  date: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  reason: string;
  refundMethod: string;
  originalItems: Array<{
    productName: string;
    qty: number;
    unitPricePaisa: number;
    totalPaisa: number;
  }>;
  originalTotalPaisa: number;
  items: {
    productName: string;
    qty: number;
    unitPricePaisa: number;
    totalPaisa: number;
  }[];
  totalRefundPaisa: number;
  cashRefundPaisa?: number;
  creditedToDuePaisa?: number;
}

function buildMemoReturnContent(
  data: ReturnInvoicePdfData,
  opts: InvoicePrintOptions,
  contentWidthPt: number,
  size: ReturnType<typeof typeScale>
): any[] {
  const money = (paisa: number) =>
    (paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const INK = '#0f172a';
  const MUTED = '#475569';
  const RULE = '#94a3b8';
  const BAND = '#eef2f1';

  const d = new Date(data.date);
  const parsed = !isNaN(d.getTime());
  const dd = parsed ? String(d.getDate()).padStart(2, '0') : '';
  const mm = parsed ? String(d.getMonth() + 1).padStart(2, '0') : '';
  const yyyy = parsed ? String(d.getFullYear()) : '';

  const dateBox = (text: string) => ({
    table: { widths: [22], body: [[{ text, alignment: 'center', fontSize: size.meta, bold: true, margin: [0, 1, 0, 1] }]] },
    layout: {
      hLineWidth: () => 0.7, vLineWidth: () => 0.7,
      hLineColor: () => RULE, vLineColor: () => RULE,
    },
  });

  const labelled = (label: string, value: string) => ({
    columns: [
      { width: 75, text: label, fontSize: size.meta, color: MUTED },
      { width: '*', text: value || '', fontSize: size.meta, bold: true, color: INK },
    ],
    margin: [0, 0, 0, 2],
  });

  const body: any[] = [
    [
      { text: 'SL #', style: 'th', alignment: 'center' },
      { text: 'Description', style: 'th' },
      { text: 'Quantity', style: 'th', alignment: 'center' },
      { text: 'Unit Price', style: 'th', alignment: 'right' },
      { text: 'Amount', style: 'th', alignment: 'right' },
    ],
    [
      { text: 'ORIGINAL PURCHASE', colSpan: 5, bold: true, fontSize: size.tableHead, margin: [0, 2, 0, 2], fillColor: '#f8fafc', color: MUTED },
      {}, {}, {}, {}
    ]
  ];

  data.originalItems.forEach((item, i) => {
    body.push([
      { text: String(i + 1), alignment: 'center', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
      { text: item.productName, fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
      { text: String(item.qty), alignment: 'center', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
      { text: money(item.unitPricePaisa), alignment: 'right', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
      { text: money(item.totalPaisa), alignment: 'right', fontSize: size.tableBody, margin: [0, 1.5, 0, 1.5] },
    ]);
  });

  body.push([
    { text: 'RETURNED ITEMS', colSpan: 5, bold: true, color: '#dc2626', fontSize: size.tableHead, margin: [0, 2, 0, 2], fillColor: '#fef2f2' },
    {}, {}, {}, {}
  ]);

  data.items.forEach((item, i) => {
    body.push([
      { text: String(i + 1), alignment: 'center', fontSize: size.tableBody, color: '#dc2626', margin: [0, 1.5, 0, 1.5] },
      { text: item.productName, fontSize: size.tableBody, color: '#dc2626', margin: [0, 1.5, 0, 1.5] },
      { text: String(item.qty), alignment: 'center', fontSize: size.tableBody, color: '#dc2626', margin: [0, 1.5, 0, 1.5] },
      { text: money(item.unitPricePaisa), alignment: 'right', fontSize: size.tableBody, color: '#dc2626', margin: [0, 1.5, 0, 1.5] },
      { text: '-' + money(item.totalPaisa), alignment: 'right', fontSize: size.tableBody, color: '#dc2626', margin: [0, 1.5, 0, 1.5] },
    ]);
  });

  const totalsRow = (label: string, value: string, o: { bold?: boolean; rule?: boolean; color?: string } = {}) => [
    {
      text: label,
      alignment: 'right',
      fontSize: o.bold ? size.total : size.meta,
      bold: o.bold,
      color: o.color || (o.bold ? INK : MUTED),
      margin: [0, o.rule ? 3 : 1, 6, 1],
      border: [false, o.rule || false, false, false],
      borderColor: [RULE, RULE, RULE, RULE],
    },
    {
      text: value,
      alignment: 'right',
      fontSize: o.bold ? size.total : size.meta,
      bold: o.bold,
      color: o.color || INK,
      margin: [0, o.rule ? 3 : 1, 0, 1],
      border: [false, o.rule || false, false, false],
      borderColor: [RULE, RULE, RULE, RULE],
    },
  ];

  const finalNetPaisa = data.originalTotalPaisa - data.totalRefundPaisa;

  const totalsBody: any[] = [
    totalsRow('Original Total :', money(data.originalTotalPaisa)),
    totalsRow('Total Refund :', `-${money(data.totalRefundPaisa)}`, { color: '#dc2626' }),
  ];

  if ((data.creditedToDuePaisa || 0) > 0) {
    totalsBody.push(totalsRow('Adjusted against Due :', money(data.creditedToDuePaisa!)));
  }
  if ((data.cashRefundPaisa || 0) > 0) {
    totalsBody.push(totalsRow('Actual Payout :', money(data.cashRefundPaisa!), { color: '#dc2626', bold: true }));
  }

  totalsBody.push(totalsRow('Final Net Bill :', money(finalNetPaisa), { bold: true, rule: true }));

  const refundMethodLabel: Record<string, string> = {
    cash: 'Cash', bkash: 'bKash', nagad: 'Nagad', card: 'Card', other: 'Other',
  };

  const footerLines = [
    opts.web ? `Web : ${opts.web}` : '',
    opts.email ? `E-mail : ${opts.email}` : '',
  ].filter(Boolean).join('   ');

  return [
    {
      stack: [
        opts.showLogo && opts.logoDataUrl
          ? { image: opts.logoDataUrl, fit: [contentWidthPt, Math.round(opts.logoHeightMm * MM_TO_PT)], alignment: 'center', margin: [0, 0, 0, 4] }
          : { text: data.shopName, fontSize: size.shopName, bold: true, alignment: 'center', color: INK },
        opts.headerNote ? { text: opts.headerNote, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 2, 0, 0] } : {},
        opts.showAddress && data.shopAddress ? { text: data.shopAddress, fontSize: size.shopMeta, color: MUTED, alignment: 'center', margin: [0, 2, 0, 0] } : {},
        opts.showPhone && data.shopPhone ? { text: `Phone: ${data.shopPhone}`, fontSize: size.shopMeta, color: MUTED, alignment: 'center', margin: [0, 2, 0, 0] } : {},
      ],
      margin: [0, 0, 0, 8],
    },
    {
      table: { widths: ['*'], body: [[{ text: 'RETURN / CREDIT NOTE', style: 'docTitle' }]] },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => BAND, paddingTop: () => 3, paddingBottom: () => 3 },
      margin: [contentWidthPt * 0.3, 0, contentWidthPt * 0.3, 8],
    },
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              columns: [
                {
                  width: 34,
                  table: { widths: [22], body: [[{ text: 'No', alignment: 'center', fontSize: size.meta, bold: true, color: '#ffffff' }]] },
                  layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => INK },
                },
                { width: '*', text: data.returnInvoiceNo, fontSize: size.meta, bold: true, margin: [4, 0.5, 0, 0] },
              ],
              margin: [0, 0, 0, 3],
            },
            labelled('Orig. Invoice :', data.originalInvoiceNo),
            labelled('Client Name :', data.customerName || 'Walk-in Customer'),
            labelled('Reason :', data.reason || 'Customer returned item'),
            labelled('Refund Method :', refundMethodLabel[data.refundMethod] || 'Cash'),
          ],
        },
        {
          width: 'auto',
          stack: [
            {
              columns: [
                { width: 'auto', text: 'Date :', fontSize: size.meta, color: MUTED, margin: [0, 2, 6, 0] },
                { width: 'auto', ...dateBox(dd) },
                { width: 'auto', ...dateBox(mm), margin: [3, 0, 0, 0] },
                { width: 'auto', ...dateBox(yyyy === '' ? '' : yyyy), margin: [3, 0, 0, 0] },
              ],
              margin: [0, 0, 0, 4],
            },
            data.customerPhone ? { text: [{ text: 'Contact : ', color: MUTED }, { text: data.customerPhone, bold: true }], fontSize: size.meta, alignment: 'right' } : {},
            opts.showCashier ? { text: [{ text: 'Served by : ', color: MUTED }, { text: data.cashierName }], fontSize: size.fine, alignment: 'right', margin: [0, 2, 0, 0] } : {},
          ],
        },
      ],
      margin: [0, 0, 0, 8],
    },
    {
      table: { headerRows: 1, widths: [26, '*', 46, 62, 68], body },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 0.8 : 0.4),
        vLineWidth: () => 0.4,
        hLineColor: (i: number) => (i <= 1 ? INK : '#cbd5e1'),
        vLineColor: () => '#cbd5e1',
        paddingLeft: () => 4, paddingRight: () => 4,
      },
      margin: [0, 0, 0, 4],
    },
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 230,
          table: { widths: ['*', 78], body: totalsBody },
          layout: {
            defaultBorder: false,
            hLineWidth: (i: number, node: any) => (node.table.body[i]?.[0]?.border?.[1] ? 0.8 : 0),
            vLineWidth: () => 0,
            hLineColor: () => RULE,
          },
        },
      ],
      margin: [0, 0, 0, 4],
    },
    opts.showFooter
      ? {
          stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidthPt, y2: 0, lineWidth: 0.8, lineColor: RULE }], margin: [0, 0, 0, 4] },
            { text: data.shopName, fontSize: size.total, bold: true, alignment: 'center', color: INK },
            footerLines ? { text: footerLines, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 1, 0, 0] } : {},
            data.invoiceFooter ? { text: data.invoiceFooter, fontSize: size.fine, color: MUTED, alignment: 'center', margin: [0, 3, 0, 0], italics: true } : {},
          ],
          margin: [0, 24, 0, 0],
        }
      : {},
  ];
}

/**
 * Generates a Return / Credit Note PDF.
 */
export async function generateReturnInvoicePdf(
  data: ReturnInvoicePdfData,
  opts: InvoicePrintOptions
): Promise<string> {
  const geometry = PAPER_GEOMETRY[opts.paper] || PAPER_GEOMETRY['80mm'];
  const marginPt = Math.round((opts.marginMm ?? 5) * MM_TO_PT);
  const contentWidthPt = geometry.widthPt - marginPt * 2;
  const size = typeScale(geometry.defaultFontPt);

  const pdfMakeModule = require('pdfmake/build/pdfmake');
  const pdfFontsModule = require('pdfmake/build/vfs_fonts');
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  const pdfFonts = pdfFontsModule.default || pdfFontsModule;
  pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

  const money = (paisa: number) => (paisa / 100).toFixed(2);

  const refundMethodLabel: Record<string, string> = {
    cash: 'Cash', bkash: 'bKash', nagad: 'Nagad', card: 'Card', other: 'Other',
  };

  const isMemo = opts.paper === 'a4';

  const tableBody: any[] = [
    [
      { text: 'Item', bold: true, fontSize: size.tableHead },
      { text: 'Qty', bold: true, alignment: 'center', fontSize: size.tableHead },
      { text: 'Price(Tk)', bold: true, alignment: 'right', fontSize: size.tableHead },
      { text: 'Total(Tk)', bold: true, alignment: 'right', fontSize: size.tableHead },
    ],
  ];

  tableBody.push([
    { text: 'ORIGINAL PURCHASE', colSpan: 4, bold: true, fontSize: size.tableHead - 1, margin: [0, 4, 0, 2] },
    {}, {}, {}
  ]);

  data.originalItems.forEach((item) => {
    tableBody.push([
      { text: item.productName, fontSize: size.tableBody },
      { text: String(item.qty), alignment: 'center', fontSize: size.tableBody },
      { text: money(item.unitPricePaisa), alignment: 'right', fontSize: size.tableBody },
      { text: money(item.totalPaisa), alignment: 'right', fontSize: size.tableBody },
    ]);
  });

  tableBody.push([
    { text: 'RETURNED ITEMS', colSpan: 4, bold: true, color: '#dc2626', fontSize: size.tableHead - 1, margin: [0, 4, 0, 2] },
    {}, {}, {}
  ]);

  data.items.forEach((item) => {
    tableBody.push([
      { text: item.productName, fontSize: size.tableBody, color: '#dc2626' },
      { text: String(item.qty), alignment: 'center', fontSize: size.tableBody, color: '#dc2626' },
      { text: money(item.unitPricePaisa), alignment: 'right', fontSize: size.tableBody, color: '#dc2626' },
      { text: '-' + money(item.totalPaisa), alignment: 'right', fontSize: size.tableBody, color: '#dc2626' },
    ]);
  });

  const rule = (weight = 0.7) => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: contentWidthPt, y2: 0, lineWidth: weight }],
    margin: [0, 2, 0, 4],
  });

  const finalNetPaisa = data.originalTotalPaisa - data.totalRefundPaisa;

  const docDefinition: any = {
    pageSize: geometry.pdfPageSize,
    pageMargins: [marginPt, marginPt, marginPt, marginPt],
    styles: {
      th: { bold: true, fontSize: size.tableHead, color: '#0f172a', margin: [0, 2, 0, 2] },
      docTitle: { bold: true, fontSize: size.total, alignment: 'center', color: '#0f172a', characterSpacing: 0.6 },
    },
    content: isMemo ? buildMemoReturnContent(data, opts, contentWidthPt, size) : [
      // ── Masthead ──
      { text: data.shopName, fontSize: size.shopName, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
      data.shopAddress
        ? { text: data.shopAddress, fontSize: size.shopMeta, alignment: 'center' }
        : {},
      data.shopPhone
        ? { text: `Phone: ${data.shopPhone}`, fontSize: size.shopMeta, alignment: 'center', margin: [0, 0, 0, 2] }
        : {},
      rule(1),

      // ── Credit Note title ──
      { text: 'RETURN / CREDIT NOTE', fontSize: size.total, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
      rule(0.5),

      // ── Meta ──
      { text: [{ text: 'Return No:  ', bold: true }, data.returnInvoiceNo], fontSize: size.meta, margin: [0, 0, 0, 1] },
      { text: [{ text: 'Orig. Invoice: ', bold: true }, data.originalInvoiceNo], fontSize: size.meta, margin: [0, 0, 0, 1] },
      { text: [{ text: 'Date: ', bold: true }, printedDate(data.date)], fontSize: size.meta, margin: [0, 0, 0, 1] },
      { text: [{ text: 'Cashier: ', bold: true }, data.cashierName], fontSize: size.meta, margin: [0, 0, 0, 1] },
      data.customerName
        ? { text: [{ text: 'Customer: ', bold: true }, data.customerName + (data.customerPhone ? ` (${data.customerPhone})` : '')], fontSize: size.meta, margin: [0, 0, 0, 1] }
        : {},
      rule(0.5),

      // ── Items ──
      {
        table: { widths: ['*', 'auto', 'auto', 'auto'], body: tableBody },
        layout: {
          hLineWidth: (i: number, node: any) =>
            i === 0 || i === 1 || i === node.table.body.length ? 0.7 : 0.3,
          vLineWidth: () => 0,
          hLineColor: () => '#94a3b8',
          paddingLeft: () => 2, paddingRight: () => 2,
          paddingTop: () => 2, paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 4],
      },

      // ── Totals ──
      rule(0.7),
      {
        columns: [
          { width: '*', text: 'Original Total:', fontSize: size.total, bold: true },
          { width: 'auto', text: `Tk ${money(data.originalTotalPaisa)}`, fontSize: size.total, bold: true, alignment: 'right' },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          { width: '*', text: 'Total Refund:', fontSize: size.total, bold: true, color: '#dc2626' },
          { width: 'auto', text: `-Tk ${money(data.totalRefundPaisa)}`, fontSize: size.total, bold: true, alignment: 'right', color: '#dc2626' },
        ],
        margin: [0, 0, 0, 2],
      },
      (data.creditedToDuePaisa || 0) > 0 ? {
        columns: [
          { width: '*', text: 'Adjusted to Due:', fontSize: size.meta },
          { width: 'auto', text: `Tk ${money(data.creditedToDuePaisa!)}`, fontSize: size.meta, alignment: 'right' },
        ],
        margin: [0, 0, 0, 1],
      } : {},
      (data.cashRefundPaisa || 0) > 0 ? {
        columns: [
          { width: '*', text: 'Actual Payout:', fontSize: size.meta, bold: true, color: '#dc2626' },
          { width: 'auto', text: `Tk ${money(data.cashRefundPaisa!)}`, fontSize: size.meta, bold: true, alignment: 'right', color: '#dc2626' },
        ],
        margin: [0, 0, 0, 1],
      } : {},
      rule(0.3),
      {
        columns: [
          { width: '*', text: 'Final Net Bill:', fontSize: size.total, bold: true },
          { width: 'auto', text: `Tk ${money(finalNetPaisa)}`, fontSize: size.total, bold: true, alignment: 'right' },
        ],
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { width: '*', text: 'Refund Method:', fontSize: size.meta },
          { width: 'auto', text: refundMethodLabel[data.refundMethod] ?? data.refundMethod, fontSize: size.meta, alignment: 'right' },
        ],
        margin: [0, 0, 0, 2],
      },
      {
        columns: [
          { width: '*', text: 'Reason:', fontSize: size.meta },
          { width: 'auto', text: data.reason, fontSize: size.meta, alignment: 'right' },
        ],
        margin: [0, 0, 0, 6],
      },

      // ── Footer ──
      rule(0.5),
      opts.paper === 'a4'
        ? {
            columns: [
              { width: '*', text: '' },
              { width: 'auto', text: data.invoiceFooter || 'Thank you!', fontSize: size.fine, alignment: 'center', italics: true },
              { width: '*', text: 'Software by GraamTech', fontSize: size.fine, color: '#94a3b8', alignment: 'right' },
            ],
            margin: [0, 4, 0, 0]
          }
        : {
            stack: [
              { text: data.invoiceFooter || 'Thank you!', fontSize: size.fine, alignment: 'center', italics: true },
              { text: 'Software by GraamTech', fontSize: size.fine, color: '#94a3b8', alignment: 'center', margin: [0, 8, 0, 0] },
            ]
          },
    ],
    defaultStyle: { font: 'Roboto' },
  };

  return new Promise((resolve) => {
    const pdfDoc = pdfMake.createPdf(docDefinition);
    pdfDoc.getBase64((dataUri: string) => resolve(dataUri));
  });
}
