import { openPrintPreview } from './printPreview';
import { Customer } from '../types/ipc';

interface DueAdjustmentReceiptParams {
  adjustmentId: string;
  customer: Customer;
  type: 'add' | 'deduct';
  amountPaisa: number;
  previousDuePaisa: number;
  newDuePaisa: number;
  note: string;
  date?: string;
}

interface DueCollectionReceiptParams {
  paymentId: string;
  customer: Customer;
  amountPaisa: number;
  previousDuePaisa: number;
  remainingDuePaisa: number;
  method: string;
  trxId?: string | null;
  note?: string | null;
  date?: string;
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const taka = (paisa: number) =>
  (paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Builds clean, structured POS-style thermal receipt HTML for Due Adjustment
 */
function buildAdjustmentHtml(
  params: DueAdjustmentReceiptParams,
  settings: any,
  isA4 = false
): string {
  const shopName = settings?.shop_name || 'Fatema Electronics';
  const shopAddress = settings?.shop_address || '';
  const shopPhone = settings?.shop_phone || '';
  const invoiceFooter = settings?.invoice_footer || 'Thank you for your business!';

  const formattedDate = params.date
    ? new Date(params.date).toLocaleDateString('en-GB') + ' ' + new Date(params.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isAddition = params.type === 'add';
  const titleText = isAddition ? 'DUE ADDITION SLIP' : 'DUE DEDUCTION SLIP';
  const refNo = `ADJ-${params.adjustmentId.slice(0, 8).toUpperCase()}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${esc(titleText)} - ${esc(params.customer.name)}</title>
        <style>
          @page {
            size: ${isA4 ? 'A4 portrait' : '80mm auto'};
            margin: ${isA4 ? '15mm' : '3mm 4mm'};
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: ${isA4 ? '14px' : '4px'};
            font-size: ${isA4 ? '13px' : '11px'};
            line-height: 1.35;
          }
          .receipt {
            max-width: ${isA4 ? '680px' : '72mm'};
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: 700; }
          .shop-name {
            font-size: ${isA4 ? '20px' : '15px'};
            font-weight: 800;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
            text-transform: uppercase;
          }
          .shop-info {
            font-size: ${isA4 ? '11px' : '9.5px'};
            color: #333;
            margin-bottom: 2px;
          }
          .receipt-title {
            font-size: ${isA4 ? '13px' : '11px'};
            font-weight: 800;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 4px 0;
            margin: 8px 0;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
            font-size: ${isA4 ? '11.5px' : '10px'};
          }
          .meta-table td {
            padding: 1.5px 0;
            vertical-align: top;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
            font-size: ${isA4 ? '12.5px' : '11px'};
          }
          .data-table th {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 4px 0;
            text-align: left;
            font-weight: 700;
          }
          .data-table td {
            padding: 3.5px 0;
            vertical-align: middle;
          }
          .data-table .amount {
            text-align: right;
            font-family: 'Courier New', Courier, monospace;
            font-weight: 700;
            white-space: nowrap;
          }
          .border-top-dashed {
            border-top: 1px dashed #000;
          }
          .total-row td {
            padding: 5px 0;
            font-size: ${isA4 ? '14px' : '12px'};
            font-weight: 800;
            border-bottom: 2px solid #000;
          }
          .note-row {
            margin: 8px 0;
            padding: 4px 0;
            font-size: ${isA4 ? '11.5px' : '10px'};
            border-top: 1px dashed #aaa;
          }
          .sign-row {
            display: flex;
            justify-content: space-between;
            margin-top: ${isA4 ? '45px' : '28px'};
            font-size: ${isA4 ? '11px' : '9px'};
          }
          .sign-box {
            border-top: 1px solid #000;
            width: ${isA4 ? '140px' : '30mm'};
            text-align: center;
            padding-top: 2px;
          }
          .footer {
            margin-top: 10px;
            text-align: center;
            font-size: ${isA4 ? '10px' : '8.5px'};
            color: #555;
          }
          @media print {
            body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Shop Header -->
          <div class="text-center">
            <div class="shop-name">${esc(shopName)}</div>
            ${shopAddress ? `<div class="shop-info">${esc(shopAddress)}</div>` : ''}
            ${shopPhone ? `<div class="shop-info">Mobile: ${esc(shopPhone)}</div>` : ''}
          </div>

          <!-- Receipt Title -->
          <div class="receipt-title">${esc(titleText)}</div>

          <!-- Meta Info -->
          <table class="meta-table">
            <tr>
              <td style="width:52%">Receipt No: <b>${esc(refNo)}</b></td>
              <td class="text-right">Date: ${esc(formattedDate)}</td>
            </tr>
            <tr>
              <td>Customer: <b>${esc(params.customer.name)}</b></td>
              ${params.customer.phone ? `<td class="text-right">Phone: ${esc(params.customer.phone)}</td>` : '<td></td>'}
            </tr>
            ${params.customer.address ? `
              <tr>
                <td colspan="2">Address: ${esc(params.customer.address)}</td>
              </tr>
            ` : ''}
          </table>

          <!-- Financial Table (Clean POS Bill Layout) -->
          <table class="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Previous Due Balance</td>
                <td class="amount">Tk ${taka(params.previousDuePaisa)}</td>
              </tr>
              <tr>
                <td>${isAddition ? 'Due Added (+)' : 'Due Deducted (-)'}</td>
                <td class="amount">${isAddition ? '+' : '-'} Tk ${taka(params.amountPaisa)}</td>
              </tr>
              <tr class="border-top-dashed total-row">
                <td>Total Outstanding Due</td>
                <td class="amount">Tk ${taka(params.newDuePaisa)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Note -->
          ${params.note ? `
            <div class="note-row">
              <b>Note:</b> ${esc(params.note)}
            </div>
          ` : ''}

          <!-- Signatures -->
          <div class="sign-row">
            <div class="sign-box">Customer Signature</div>
            <div class="sign-box">Authorized Signature</div>
          </div>

          <!-- Footer -->
          <div class="footer">
            ${esc(invoiceFooter)}
            <br/>
            Software Generated Slip &bull; Printed: ${esc(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Builds clean, structured POS-style thermal receipt HTML for Due Collection
 */
function buildCollectionHtml(
  params: DueCollectionReceiptParams,
  settings: any,
  isA4 = false
): string {
  const shopName = settings?.shop_name || 'Fatema Electronics';
  const shopAddress = settings?.shop_address || '';
  const shopPhone = settings?.shop_phone || '';
  const invoiceFooter = settings?.invoice_footer || 'Thank you for your business!';

  const formattedDate = params.date
    ? new Date(params.date).toLocaleDateString('en-GB') + ' ' + new Date(params.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleDateString('en-GB') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const refNo = `RCPT-${params.paymentId.slice(0, 8).toUpperCase()}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Money Receipt - ${esc(params.customer.name)}</title>
        <style>
          @page {
            size: ${isA4 ? 'A4 portrait' : '80mm auto'};
            margin: ${isA4 ? '15mm' : '3mm 4mm'};
          }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #000;
            background: #fff;
            margin: 0;
            padding: ${isA4 ? '14px' : '4px'};
            font-size: ${isA4 ? '13px' : '11px'};
            line-height: 1.35;
          }
          .receipt {
            max-width: ${isA4 ? '680px' : '72mm'};
            margin: 0 auto;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .bold { font-weight: 700; }
          .shop-name {
            font-size: ${isA4 ? '20px' : '15px'};
            font-weight: 800;
            letter-spacing: 0.5px;
            margin: 0 0 2px 0;
            text-transform: uppercase;
          }
          .shop-info {
            font-size: ${isA4 ? '11px' : '9.5px'};
            color: #333;
            margin-bottom: 2px;
          }
          .receipt-title {
            font-size: ${isA4 ? '13px' : '11px'};
            font-weight: 800;
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 4px 0;
            margin: 8px 0;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
            font-size: ${isA4 ? '11.5px' : '10px'};
          }
          .meta-table td {
            padding: 1.5px 0;
            vertical-align: top;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin: 6px 0;
            font-size: ${isA4 ? '12.5px' : '11px'};
          }
          .data-table th {
            border-top: 1px solid #000;
            border-bottom: 1px solid #000;
            padding: 4px 0;
            text-align: left;
            font-weight: 700;
          }
          .data-table td {
            padding: 3.5px 0;
            vertical-align: middle;
          }
          .data-table .amount {
            text-align: right;
            font-family: 'Courier New', Courier, monospace;
            font-weight: 700;
            white-space: nowrap;
          }
          .border-top-dashed {
            border-top: 1px dashed #000;
          }
          .total-row td {
            padding: 5px 0;
            font-size: ${isA4 ? '14px' : '12px'};
            font-weight: 800;
            border-bottom: 2px solid #000;
          }
          .note-row {
            margin: 8px 0;
            padding: 4px 0;
            font-size: ${isA4 ? '11.5px' : '10px'};
            border-top: 1px dashed #aaa;
          }
          .sign-row {
            display: flex;
            justify-content: space-between;
            margin-top: ${isA4 ? '45px' : '28px'};
            font-size: ${isA4 ? '11px' : '9px'};
          }
          .sign-box {
            border-top: 1px solid #000;
            width: ${isA4 ? '140px' : '30mm'};
            text-align: center;
            padding-top: 2px;
          }
          .footer {
            margin-top: 10px;
            text-align: center;
            font-size: ${isA4 ? '10px' : '8.5px'};
            color: #555;
          }
          @media print {
            body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Shop Header -->
          <div class="text-center">
            <div class="shop-name">${esc(shopName)}</div>
            ${shopAddress ? `<div class="shop-info">${esc(shopAddress)}</div>` : ''}
            ${shopPhone ? `<div class="shop-info">Mobile: ${esc(shopPhone)}</div>` : ''}
          </div>

          <!-- Receipt Title -->
          <div class="receipt-title">MONEY RECEIPT (DUE COLLECTION)</div>

          <!-- Meta Info -->
          <table class="meta-table">
            <tr>
              <td style="width:52%">Receipt No: <b>${esc(refNo)}</b></td>
              <td class="text-right">Date: ${esc(formattedDate)}</td>
            </tr>
            <tr>
              <td>Customer: <b>${esc(params.customer.name)}</b></td>
              ${params.customer.phone ? `<td class="text-right">Phone: ${esc(params.customer.phone)}</td>` : '<td></td>'}
            </tr>
            <tr>
              <td>Payment Channel: <b>${esc(params.method.toUpperCase())}</b></td>
              ${params.trxId ? `<td class="text-right">TrxID: ${esc(params.trxId)}</td>` : '<td></td>'}
            </tr>
          </table>

          <!-- Financial Table (Clean POS Bill Layout) -->
          <table class="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Previous Due Balance</td>
                <td class="amount">Tk ${taka(params.previousDuePaisa)}</td>
              </tr>
              <tr>
                <td>Amount Paid Today</td>
                <td class="amount">- Tk ${taka(params.amountPaisa)}</td>
              </tr>
              <tr class="border-top-dashed total-row">
                <td>Remaining Due Balance</td>
                <td class="amount">Tk ${taka(params.remainingDuePaisa)}</td>
              </tr>
            </tbody>
          </table>

          <!-- Note -->
          ${params.note ? `
            <div class="note-row">
              <b>Note:</b> ${esc(params.note)}
            </div>
          ` : ''}

          <!-- Signatures -->
          <div class="sign-row">
            <div class="sign-box">Customer Signature</div>
            <div class="sign-box">Cashier Signature</div>
          </div>

          <!-- Footer -->
          <div class="footer">
            ${esc(invoiceFooter)}
            <br/>
            Software Generated Slip &bull; Printed: ${esc(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Triggers Print Preview for a Customer Due Adjustment
 */
export async function printCustomerDueAdjustment(params: DueAdjustmentReceiptParams): Promise<void> {
  const settings = await window.api?.settings.get().catch(() => null);
  const isDefaultA4 = settings?.default_invoice_layout === 'a4';
  const isAddition = params.type === 'add';
  const label = isAddition ? 'Due Addition Slip' : 'Due Deduction Slip';

  openPrintPreview(buildAdjustmentHtml(params, settings, isDefaultA4), {
    label: `${label} — ${params.customer.name}`,
    marginMm: isDefaultA4 ? (settings?.invoice_margin_mm || 12) : 3,
    fileName: `adjustment-${params.customer.name}-${params.adjustmentId.slice(0, 8)}`,
    toggle: {
      label: 'Print on A4 Paper',
      on: isDefaultA4,
      render: (isA4) => buildAdjustmentHtml(params, settings, isA4),
    },
  });
}

/**
 * Triggers Print Preview for a Due Collection Payment
 */
export async function printCustomerDueCollection(params: DueCollectionReceiptParams): Promise<void> {
  const settings = await window.api?.settings.get().catch(() => null);
  const isDefaultA4 = settings?.default_invoice_layout === 'a4';

  openPrintPreview(buildCollectionHtml(params, settings, isDefaultA4), {
    label: `Money Receipt — ${params.customer.name}`,
    marginMm: isDefaultA4 ? (settings?.invoice_margin_mm || 12) : 3,
    fileName: `money-receipt-${params.customer.name}-${params.paymentId.slice(0, 8)}`,
    toggle: {
      label: 'Print on A4 Paper',
      on: isDefaultA4,
      render: (isA4) => buildCollectionHtml(params, settings, isA4),
    },
  });
}
