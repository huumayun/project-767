import React, { useState, useEffect } from 'react';
import { Customer, CustomerHistoryItem } from '../../types/ipc';
import { FileText, X, Printer, RefreshCw, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { InvoiceModal } from '../pos/InvoiceModal';
import { openPrintPreview } from '../../utils/printPreview';

interface CustomerLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

export const CustomerLedgerModal: React.FC<CustomerLedgerModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const [history, setHistory] = useState<CustomerHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string | null>(null);

  const fetchLedger = async () => {
    if (!window.api || !customer) return;
    setLoading(true);
    try {
      const list = await window.api.customers.getHistory(customer.id);
        const grouped = [];
        for (let i = 0; i < list.length; i++) {
          const row = list[i];
          if (row.type === 'sale') {
            const nextRow = i + 1 < list.length ? list[i + 1] : null;
            if (nextRow && nextRow.type === 'payment' && nextRow.ref_no === row.ref_no) {
              grouped.push({
                ...row,
                description: `Invoice ${row.ref_no}`,
                credit_paisa: nextRow.credit_paisa,
                running_balance_paisa: nextRow.running_balance_paisa
              });
              i++;
              continue;
            }
          }
          grouped.push(row);
        }
        setHistory(grouped);
    } catch (err) {
      console.error('Failed to load customer statement:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && customer) {
      fetchLedger();
    }
  }, [isOpen, customer]);

  if (!isOpen) return null;

  /*
   * Totals summed from the very rows on screen, not fetched separately.
   *
   * The card used to read customer.total_sales_paisa, which v_customer_due
   * reports net of returns, while the Debit column below listed invoices gross.
   * Two figures from two definitions, side by side, and no way for a reader to
   * reconcile them. Summed here, the card and the table cannot disagree.
   */
  const totalDebitPaisa = history.reduce((n, tx) => n + tx.debit_paisa, 0);
  const totalCreditPaisa = history.reduce((n, tx) => n + tx.credit_paisa, 0);
  const closingBalancePaisa = history.length
    ? history[history.length - 1].running_balance_paisa || 0
    : 0;

  /*
   * The statement as a document of its own, not a screenshot of the app.
   *
   * window.print() printed the whole renderer - sidebar, modal backdrop and all
   * - and worse, the table on screen sits in a max-h-80 scroller, so only the
   * handful of rows that happened to be visible reached the paper. A long
   * account simply lost the rest.
   *
   * Built as HTML and sent through the print pipeline instead: page size and
   * margins come from the @page rule, and Chromium paginates it the way it
   * paginates any document.
   */
  const handlePrintStatement = async () => {
    const esc = (v: unknown) =>
      String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const taka = (paisa: number) =>
      (paisa / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const settings = await window.api?.settings.get().catch(() => null);
    const shopName = settings?.shop_name || 'Fatema Electronics';
    const shopAddress = settings?.shop_address || '';
    const shopPhone = settings?.shop_phone || '';

    const rows = history
      .map((tx) => {
        let displayPaid = tx.credit_paisa;
        let displayDueColl = 0;
        if (tx.type === 'sale') {
          if (tx.credit_paisa > tx.debit_paisa) {
            displayDueColl = tx.credit_paisa - tx.debit_paisa;
          }
        } else if (tx.type === 'payment' && tx.credit_paisa > 0) {
          displayPaid = 0;
          displayDueColl = tx.credit_paisa;
        }

        return `
          <tr>
            <td class="date">${esc(new Date(tx.date).toLocaleDateString('en-GB'))}</td>
            <td class="ref">${esc(tx.ref_no)}</td>
            <td>${esc(tx.description)}</td>
            <td class="num">${tx.debit_paisa ? taka(tx.debit_paisa) : ''}</td>
            <td class="num">${displayPaid ? taka(displayPaid) : ''}</td>
            <td class="num">${displayDueColl ? taka(displayDueColl) : ''}</td>
            <td class="num strong">${taka(tx.running_balance_paisa || 0)}</td>
          </tr>`;
      })
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statement - ${esc(customer.name)}</title>
          <meta charset="utf-8" />
          <style>
            /* The margin belongs here: Chromium lets the document's @page rule
               beat the margins handed to print(), so setting it anywhere else
               yields an edge-to-edge sheet whose last rows fall into the
               printer's unprintable border. */
            @page { size: A4 portrait; margin: 16mm; }
            * { box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              color: #0f172a; background: #f1f5f9; margin: 0;
              font-size: 10.5pt; line-height: 1.4;
            }
            .sheet { background: #fff; max-width: 210mm; margin: 16px auto; padding: 16mm; }
            h1 { font-size: 16pt; margin: 0; }
            .head { display: flex; justify-content: space-between; align-items: flex-start;
                    gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
            .muted { color: #475569; font-size: 9pt; }
            .who { margin-top: 12px; display: flex; justify-content: space-between; gap: 16px; font-size: 9.5pt; }
            .who b { display: block; font-size: 11pt; }
            .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0 6px; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; }
            .kpi span { display: block; font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: .04em; }
            .kpi b { font-size: 12.5pt; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { border-bottom: 1px solid #0f172a; font-size: 8pt; text-transform: uppercase;
                 color: #475569; text-align: left; letter-spacing: .04em; padding: 4px 6px; }
            td { border-bottom: 1px solid #e2e8f0; padding: 4px 6px; font-size: 9.5pt; vertical-align: top; }
            .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
            .date, .ref { white-space: nowrap; }
            .ref { font-family: ui-monospace, Consolas, monospace; font-size: 8.5pt; }
            .strong { font-weight: 700; }

            /* Pagination. A statement that outgrows one page has to carry its
               column headings onto the next, and no row may be sliced in half
               across the break. */
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            .closing { break-inside: avoid; page-break-inside: avoid; margin-top: 10px;
                       border-top: 2px solid #0f172a; padding-top: 8px;
                       display: flex; justify-content: space-between; font-size: 11pt; }
            .foot { break-inside: avoid; page-break-inside: avoid; margin-top: 18px;
                    border-top: 1px solid #cbd5e1; padding-top: 6px; }

            @media print {
              body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .sheet { margin: 0; padding: 0; max-width: none; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="head">
              <div>
                <h1>${esc(shopName)}</h1>
                ${shopAddress ? `<div class="muted">${esc(shopAddress)}</div>` : ''}
                ${shopPhone ? `<div class="muted">Phone: ${esc(shopPhone)}</div>` : ''}
              </div>
              <div class="muted" style="text-align:right">
                <div class="strong" style="font-size:11pt;color:#0f172a">Customer Account Statement</div>
                <div>Generated ${esc(new Date().toLocaleString())}</div>
              </div>
            </div>

            <div class="who">
              <div>
                <span class="muted">Statement for</span>
                <b>${esc(customer.name)}</b>
                ${customer.phone ? `<div class="muted">${esc(customer.phone)}</div>` : ''}
                ${customer.address ? `<div class="muted">${esc(customer.address)}</div>` : ''}
              </div>
              <div class="muted" style="text-align:right">
                <span>Transactions</span>
                <b style="color:#0f172a">${history.length}</b>
              </div>
            </div>

            <div class="kpis">
              <div class="kpi"><span>Total Bill</span><b>৳ ${taka(totalDebitPaisa)}</b></div>
              <div class="kpi"><span>Total Paid/Return</span><b>৳ ${taka(totalCreditPaisa)}</b></div>
              <div class="kpi"><span>Current Due</span><b>৳ ${taka(closingBalancePaisa)}</b></div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reference</th>
                  <th>Description</th>
                  <th class="num">Bill (৳)</th>
                  <th class="num">Paid (৳)</th>
                    <th class="num">Due Coll. (৳)</th>
                  <th class="num">Due (৳)</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="7" style="text-align:center;color:#64748b">No transactions recorded.</td></tr>'}
              </tbody>
            </table>

            <div class="closing">
              <span class="strong">Closing Balance (Current Due)</span>
              <span class="strong">৳ ${taka(closingBalancePaisa)}</span>
            </div>

            <div class="foot muted">
              Balance shown is as at the generated date above. Bill increases the due (purchases); Paid decreases it (cash/returns).
            </div>
          </div>
        </body>
      </html>`;

    openPrintPreview(html, {
      label: `Statement — ${customer.name}`,
      marginMm: 16,
      fileName: `statement-${customer.name}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-3xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Customer Account Statement & Ledger</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">
                {customer.name} {customer.phone ? `(${customer.phone})` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintStatement}
              className="px-3.5 py-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-jungle-teal-300 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-azure-mist-700" />
              <span>Print Statement</span>
            </button>

            <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Statement Summary Card */}
        <div className="grid grid-cols-3 gap-3 font-mono bg-jungle-teal-50 border border-jungle-teal-200 p-3.5 rounded-xl text-xs">
          <div>
            <span className="text-jungle-teal-500 font-sans block text-[10px]">Total Bill (Invoices)</span>
            <span className="font-bold text-jungle-teal-900">৳ {(totalDebitPaisa / 100).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-jungle-teal-500 font-sans block text-[10px]">Total Paid / Returned</span>
            <span className="font-bold text-muted-teal-800">৳ {(totalCreditPaisa / 100).toFixed(2)}</span>
          </div>
          <div>
            <span className="text-jungle-teal-500 font-sans block text-[10px]">Closing Balance (Due)</span>
            <span className="font-extrabold text-amber-700">৳ {(closingBalancePaisa / 100).toFixed(2)}</span>
          </div>
        </div>

        {/* Ledger Transactions Table */}
        <div className="border border-jungle-teal-200 rounded-xl overflow-hidden bg-jungle-teal-50 max-h-80 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 font-mono text-[10px] uppercase border-b border-jungle-teal-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Reference</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Bill / Sale (৳)</th>
                <th className="p-3 text-right">Paid / Return (৳)</th>
                  <th className="p-3 text-right">Due Coll. (৳)</th>
                <th className="p-3 text-right" title="Balance after this transaction. Reads top to bottom, oldest first.">
                  Running Due (৳)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11px]">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-jungle-teal-500 font-sans">
                    {loading ? 'Loading account statement...' : 'No transaction records found.'}
                  </td>
                </tr>
              ) : (
                history.map((tx, idx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-jungle-teal-50 transition-colors ${
                      idx === history.length - 1 ? 'bg-amber-50/60 font-bold' : ''
                    }`}
                  >
                    <td className="p-3 text-jungle-teal-600">
                      {new Date(tx.date).toLocaleDateString('en-GB')} {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 text-azure-mist-800 font-bold">
                      {tx.ref_no?.startsWith('INV') ? (
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceNo(tx.ref_no)}
                          className="hover:underline hover:text-azure-mist-600 text-left font-mono font-bold cursor-pointer transition-colors"
                          title="Click to view & print invoice"
                        >
                          {tx.ref_no}
                        </button>
                      ) : (
                        <span>{tx.ref_no}</span>
                      )}
                    </td>
                    <td className="p-3 font-sans text-jungle-teal-800">{tx.description}</td>
                    <td className="p-3 text-right text-jungle-teal-900 font-bold">
                      {tx.debit_paisa > 0 ? `৳ ${(tx.debit_paisa / 100).toFixed(2)}` : '-'}
                    </td>
                                          <td className="p-3 text-right text-muted-teal-800 font-bold">
                        {(() => {
                          let displayPaid = tx.credit_paisa;
                          if (tx.type === 'payment' && tx.credit_paisa > 0) {
                            displayPaid = 0; // Pure due collection, not a sale
                          }
                          return displayPaid > 0 ? `৳ ${(displayPaid / 100).toFixed(2)}` : '-';
                        })()}
                      </td>
                      <td className="p-3 text-right text-indigo-700 font-bold">
                        {(() => {
                          let displayDueColl = 0;
                          if (tx.type === 'sale') {
                            if (tx.credit_paisa > tx.debit_paisa) {
                              displayDueColl = tx.credit_paisa - tx.debit_paisa;
                            }
                          } else if (tx.type === 'payment' && tx.credit_paisa > 0) {
                            displayDueColl = tx.credit_paisa;
                          }
                          return displayDueColl > 0 ? `৳ ${(displayDueColl / 100).toFixed(2)}` : '-';
                        })()}
                      </td>
                    <td className="p-3 text-right text-amber-700 font-extrabold">
                      ৳ {((tx.running_balance_paisa || 0) / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2 border-t border-jungle-teal-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold"
          >
            Close Statement
          </button>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoiceNo && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoiceNo)}
          onClose={() => setSelectedInvoiceNo(null)}
          invoiceNo={selectedInvoiceNo}
        />
      )}
    </div>
  );
};
