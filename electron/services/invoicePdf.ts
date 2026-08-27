import QRCode from 'qrcode';

// Invoice details interface
export interface InvoicePdfData {
  shopName: string;
  shopAddress: string;
  shopPhone?: string;
  invoiceFooter: string;
  invoiceNo: string;
  date: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
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
}

export async function generateInvoicePdf(
  data: InvoicePdfData,
  layout: '80mm' | 'a5' = '80mm'
): Promise<string> {
  // Generate QR Code data URI for invoice verification
  const qrDataUrl = await QRCode.toDataURL(data.invoiceNo, {
    margin: 1,
    width: 80,
    errorCorrectionLevel: 'M',
  });

  const isThermal = layout === '80mm';

  // Import pdfmake dynamically to support both CJS & ESM bundles
  const pdfMakeModule = require('pdfmake/build/pdfmake');
  const pdfFontsModule = require('pdfmake/build/vfs_fonts');
  const pdfMake = pdfMakeModule.default || pdfMakeModule;
  const pdfFonts = pdfFontsModule.default || pdfFontsModule;
  pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

  // Build items table body
  const tableBody: any[] = [
    [
      { text: 'Item', bold: true, fontSize: isThermal ? 8 : 9 },
      { text: 'Qty', bold: true, alignment: 'center', fontSize: isThermal ? 8 : 9 },
      { text: 'Price (৳)', bold: true, alignment: 'right', fontSize: isThermal ? 8 : 9 },
      { text: 'Total (৳)', bold: true, alignment: 'right', fontSize: isThermal ? 8 : 9 },
    ],
  ];

  data.items.forEach((item) => {
    const itemTotalTaka = (item.totalPaisa / 100).toFixed(2);
    const unitPriceTaka = (item.unitPricePaisa / 100).toFixed(2);
    tableBody.push([
      {
        text: item.name + (item.nameBn ? ` (${item.nameBn})` : ''),
        fontSize: isThermal ? 7.5 : 8.5,
      },
      { text: item.qty.toString(), alignment: 'center', fontSize: isThermal ? 7.5 : 8.5 },
      { text: unitPriceTaka, alignment: 'right', fontSize: isThermal ? 7.5 : 8.5 },
      { text: itemTotalTaka, alignment: 'right', fontSize: isThermal ? 7.5 : 8.5 },
    ]);
  });

  const subtotalTaka = (data.subtotalPaisa / 100).toFixed(2);
  const discountTaka = (data.discountPaisa / 100).toFixed(2);
  const totalTaka = (data.totalPaisa / 100).toFixed(2);
  const paidTaka = (data.totalPaidPaisa / 100).toFixed(2);
  const changeTaka = ((data.changePaisa || 0) / 100).toFixed(2);
  const dueTaka = ((data.duePaisa || 0) / 100).toFixed(2);

  const docDefinition: any = {
    pageSize: isThermal ? { width: 226, height: 'auto' } : 'A5', // 80mm = ~226pt
    pageMargins: isThermal ? [10, 10, 10, 10] : [25, 25, 25, 25],
    content: [
      // Header
      { text: data.shopName, fontSize: isThermal ? 13 : 16, bold: true, alignment: 'center' },
      { text: data.shopAddress, fontSize: isThermal ? 8 : 9, alignment: 'center', margin: [0, 2, 0, 0] },
      data.shopPhone ? { text: `Phone: ${data.shopPhone}`, fontSize: isThermal ? 8 : 9, alignment: 'center' } : {},
      {
        canvas: [{ type: 'line', x1: 0, y1: 5, x2: isThermal ? 206 : 370, y2: 5, lineWidth: 1 }],
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
              { text: `Date: ${data.date}\n` },
              { text: `Cashier: ${data.cashierName}\n` },
            ],
            fontSize: isThermal ? 7.5 : 8.5,
          },
          data.customerName
            ? {
                width: '*',
                text: [
                  { text: `Customer: `, bold: true },
                  { text: `${data.customerName}\n` },
                  data.customerPhone ? { text: `Phone: ${data.customerPhone}\n` } : '',
                ],
                fontSize: isThermal ? 7.5 : 8.5,
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
          widths: isThermal ? ['*', 22, 38, 42] : ['*', 35, 60, 65],
          body: tableBody,
        },
        layout: 'lightHorizontalLines',
        margin: [0, 0, 0, 6],
      },

      // Totals & Calculations
      {
        columns: [
          { width: '*', text: '' },
          {
            width: isThermal ? 120 : 160,
            table: {
              widths: ['*', 'auto'],
              body: [
                [{ text: 'Subtotal:', fontSize: isThermal ? 8 : 9 }, { text: `৳ ${subtotalTaka}`, alignment: 'right', fontSize: isThermal ? 8 : 9 }],
                data.discountPaisa > 0
                  ? [{ text: 'Discount:', fontSize: isThermal ? 8 : 9 }, { text: `- ৳ ${discountTaka}`, alignment: 'right', fontSize: isThermal ? 8 : 9 }]
                  : [],
                [
                  { text: 'Grand Total:', bold: true, fontSize: isThermal ? 9 : 10.5 },
                  { text: `৳ ${totalTaka}`, bold: true, alignment: 'right', fontSize: isThermal ? 9 : 10.5 },
                ],
                [{ text: 'Total Paid:', fontSize: isThermal ? 8 : 9 }, { text: `৳ ${paidTaka}`, alignment: 'right', fontSize: isThermal ? 8 : 9 }],
                data.changePaisa && data.changePaisa > 0
                  ? [{ text: 'Change Returned:', fontSize: isThermal ? 8 : 9 }, { text: `৳ ${changeTaka}`, alignment: 'right', fontSize: isThermal ? 8 : 9 }]
                  : [],
                data.duePaisa && data.duePaisa > 0
                  ? [{ text: 'Remaining Due:', bold: true, fontSize: isThermal ? 8 : 9, color: '#dc2626' }, { text: `৳ ${dueTaka}`, bold: true, alignment: 'right', fontSize: isThermal ? 8 : 9, color: '#dc2626' }]
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
            text: `Payment: ${data.payments.map((p) => `${p.method.toUpperCase()} (৳ ${(p.amountPaisa / 100).toFixed(2)})`).join(', ')}`,
            fontSize: isThermal ? 7.5 : 8,
            color: '#475569',
            margin: [0, 2, 0, 6],
          }
        : {},

      // QR Code & Barcode Section
      {
        columns: [
          {
            width: '*',
            text: [
              { text: data.invoiceFooter + '\n', bold: true, fontSize: isThermal ? 7.5 : 8.5 },
              { text: 'Software: Mechanical Shop POS (Offline-First)\n', fontSize: 6.5, color: '#94a3b8' },
            ],
            alignment: isThermal ? 'center' : 'left',
          },
          {
            width: isThermal ? 60 : 70,
            image: qrDataUrl,
            fit: isThermal ? [50, 50] : [60, 60],
            alignment: 'right',
          },
        ],
        margin: [0, 6, 0, 0],
      },
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
