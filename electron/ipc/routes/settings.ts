import { ipcMain, dialog, app } from 'electron';
import fs from 'fs';
import { v7 as uuidv7 } from 'uuid';
import { getDb } from '../../db';
import { z } from 'zod';
// cart calculations not needed
import {
  activeSession,
  setActiveSession,
  requireRole,
  getDeviceId,
  logAudit,
  generateRecoveryCodes,
  storeRecoveryCodes,
  recoveryCodeStatus,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODES_KEY,
  RECOVERY_LEGACY_HASH_KEY,
  RECOVERY_SET_AT_KEY,
} from '../shared';
import { printOptionsFromSettings } from '../../services/invoicePrintOptions';
import { generateInvoicePdf } from '../../services/invoicePdf';


export function registerSettingsHandlers() {
  // Settings Handlers
  ipcMain.handle('api:settings:get', async () => {
      requireRole(['owner', 'staff']);
      const db = getDb();
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      const map: Record<string, string> = {};
      rows.forEach(r => { map[r.key] = r.value; });
  
      return {
        shop_name: map['shop_name'] || 'Mechanical Parts Shop',
        invoice_shop_name: map['invoice_shop_name'] || '',
        shop_address: map['shop_address'] || 'Dhaka, Bangladesh',
        shop_phone: map['shop_phone'] || '01700-000000',
        // Blank by default, and printed only when set - a footer with an empty
        // "Web :" label looks like a form nobody finished.
        shop_web: map['shop_web'] || '',
        shop_email: map['shop_email'] || '',
        invoice_footer: map['invoice_footer'] || 'Thank you for your business!',
        invoice_contacts: (() => {
          try { return JSON.parse(map['invoice_contacts'] || '[]'); } catch { return []; }
        })(),
        device_id: map['device_id'] || 'REG01',
        idle_lock_minutes: map['idle_lock_minutes'] || '15',
        local_backup_path: map['local_backup_path'] || '',
        default_invoice_layout: map['default_invoice_layout'] || '80mm',
        // Derived rather than stored raw, so an unset shop still gets sensible
        // margins and type for whichever paper it prints on.
        ...(() => {
          const o = printOptionsFromSettings(map);
          return {
            invoice_margin_mm: o.marginMm,
            invoice_font_pt: o.fontPt,
            invoice_show_address: o.showAddress,
            invoice_show_phone: o.showPhone,
            invoice_show_qr: o.showQr,
            invoice_show_cashier: o.showCashier,
            invoice_show_name_bn: o.showNameBn,
            invoice_show_footer: o.showFooter,
            invoice_logo: o.logoDataUrl,
            invoice_show_logo: o.showLogo,
            invoice_logo_height_mm: o.logoHeightMm,
            invoice_title: o.title,
            invoice_header_note: o.headerNote,
            invoice_terms: o.terms,
            invoice_show_signature: o.showSignature,
            invoice_show_customer_signature: o.showCustomerSignature,
            invoice_signature: o.signatureDataUrl,
            invoice_signature_height_mm: o.signatureHeightMm,
          };
        })(),
        enable_shifts: map['enable_shifts'] !== '0',
        // A counter has a printer unless told otherwise, so every shop that
        // already prints keeps printing after this update.
        has_printer: map['has_printer'] !== '0',
        // Off unless a shop has deliberately picked a printer, so an install
        // that has not been set up still gets the dialog it always got.
        silent_print: map['silent_print'] === '1',
        receipt_printer_name: map['receipt_printer_name'] || '',
        barcode_scanner_mode: map['barcode_scanner_mode'] || 'speed',
        barcode_scanner_prefix: map['barcode_scanner_prefix'] || '',
        supabase_url: map['supabase_url'] || '',
        supabase_anon_key: map['supabase_anon_key'] ? '********' : '',
        supabase_shop_id: map['supabase_shop_id'] || '',
        recovery_codes_total: recoveryCodeStatus(db).total,
        recovery_codes_remaining: recoveryCodeStatus(db).remaining,
        recovery_set_at: map[RECOVERY_SET_AT_KEY] || '',
      };
    });

  /**
   * A sample invoice, drawn by the real generator.
   *
   * The Settings preview used to be its own HTML sketch of an invoice, so it
   * agreed with the printed document only by coincidence - and once the A4
   * memo layout was written it stopped agreeing at all: no signature, none of
   * the memo structure. An owner set the options against a picture that was
   * not what the printer would produce.
   *
   * Takes the options as they stand in the form, unsaved, so moving a slider
   * shows its effect before committing to it.
   */
  ipcMain.handle('api:settings:previewInvoice', async (_event, rawOverrides) => {
    requireRole(['owner']);
    const overrides = (rawOverrides || {}) as Record<string, any>;
    const db = getDb();

    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const map: Record<string, string> = {};
    rows.forEach((r) => { map[r.key] = r.value; });
    // What the form currently shows wins over what is stored.
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === null) continue;
      map[k] = typeof v === 'boolean' ? (v ? '1' : '0') : typeof v === 'object' ? JSON.stringify(v) : String(v);
    }

    const opts = printOptionsFromSettings(map, map['default_invoice_layout']);
    const isRoll = opts.paper === '80mm';

    // Enough lines to show wrapping and a running table; a one-item sample
    // hides exactly the problems a preview exists to reveal.
    const sample = [
      { name: 'Oil Filter - Bosch OE Spec, fits Hero Splendor', qty: 2, unitPricePaisa: 20000 },
      { name: 'Brake Pad Set - TVS Apache, front', qty: 1, unitPricePaisa: 55000 },
      { name: 'Spark Plug - NGK Iridium', qty: 4, unitPricePaisa: 10000 },
    ].map((i) => ({ ...i, discountPaisa: 0, totalPaisa: i.unitPricePaisa * i.qty }));

    const subtotal = sample.reduce((n, i) => n + i.totalPaisa, 0);
    const discount = 3500;
    const total = subtotal - discount;
    const paid = 100000;

    const pdfBase64 = await generateInvoicePdf(
      {
        shopName: map['invoice_shop_name'] || map['shop_name'] || 'Your Shop Name',
        shopAddress: map['shop_address'] || 'Dhaka, Bangladesh',
        shopPhone: map['shop_phone'] || '',
        invoiceContacts: (() => { try { return JSON.parse(map['invoice_contacts'] || '[]'); } catch { return []; } })(),
        invoiceFooter: map['invoice_footer'] || '',
        invoiceNo: 'INV-SAMPLE-0001',
        date: new Date().toISOString(),
        cashierName: activeSession?.name || 'Cashier',
        customerName: 'Karim Auto Workshop',
        customerPhone: '01711-220044',
        customerAddress: 'Bangshal, Dhaka',
        items: sample,
        subtotalPaisa: subtotal,
        discountPaisa: discount,
        totalPaisa: total,
        payments: [{ method: 'cash', amountPaisa: paid }],
        totalPaidPaisa: paid,
        changePaisa: 0,
        duePaisa: total - paid,
      },
      opts
    );

    return { pdfBase64, paper: opts.paper, isRoll };
  });

  ipcMain.handle('api:settings:update', async (_event, rawData) => {
      requireRole(['owner']);
      // Accept any simple values, we'll convert them to string for storage
      const schema = z.record(z.any());
      const data = schema.parse(rawData);
      const db = getDb();
      const now = new Date().toISOString();
  
      const insertOrUpdate = db.prepare(`
        INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `);
  
      /*
       * Credentials are not settings, and this handler accepts any key at all.
       *
       * Without the list, a generic settings write could replace the recovery
       * hash - and could also drop a Supabase key or a Drive refresh token into
       * the table in plain text, going round encryptSecret entirely. Each of
       * those has a handler of its own that stores it properly
       * (sync:configure, the Drive OAuth flow); this is the door they must not
       * be allowed in through.
       *
       * last_app_version is here for a different reason: it is how the app
       * decides whether to take a backup before a new build touches the schema.
       * Writing it by hand would skip that backup on the next upgrade.
       */
      const protectedKeys = new Set([
        RECOVERY_CODES_KEY,
        RECOVERY_LEGACY_HASH_KEY,
        RECOVERY_SET_AT_KEY,
        'supabase_anon_key',
        'gdrive_refresh_token',
        'last_app_version',
      ]);

      const written: Record<string, unknown> = {};
      db.transaction(() => {
        for (const [k, v] of Object.entries(data)) {
          if (protectedKeys.has(k)) continue;
          // Convert true/false to '1'/'0', and other types to string
          const strVal = typeof v === 'boolean' ? (v ? '1' : '0') : typeof v === 'object' ? JSON.stringify(v) : String(v);
          insertOrUpdate.run(k, strVal, now);
          written[k] = v;
        }
      })();

      // Only what was actually stored, so the log cannot end up holding a value
      // this handler deliberately refused to keep. The audit log is read on
      // screen and travels in every backup.
      logAudit('UPDATE_SETTINGS', 'settings', undefined, written);
      return { success: true };
    });

  /**
   * Issues a fresh sheet of recovery codes and returns them. This is the only
   * moment they exist in the clear, so the caller has to show or save them
   * before discarding them.
   *
   * Replaces any existing sheet outright, including unused codes: an owner who
   * reissues usually does so because the old sheet is compromised or lost, and a
   * sheet that half survives a reissue is one nobody can reason about.
   */
  ipcMain.handle('api:settings:generateRecoveryCodes', async () => {
      requireRole(['owner']);
      const db = getDb();
      const codes = generateRecoveryCodes(RECOVERY_CODE_COUNT);
      storeRecoveryCodes(db, codes);
      logAudit('GENERATE_RECOVERY_CODES', 'settings', undefined, {
        by: activeSession?.username,
        count: codes.length,
      });
      return { codes };
    });

  /**
   * Writes a sheet to a text file the owner picks. The codes come back from the
   * renderer rather than being re-read, because they only exist there - the
   * database holds hashes.
   */
  ipcMain.handle('api:settings:exportRecoveryCodes', async (_event, rawCodes) => {
      // Allowed without auth because the first-run wizard calls this before anyone logs in.
      // The codes come from the frontend, so this handler cannot leak them.
      if (activeSession && activeSession.role !== 'owner') {
        throw new Error(`Forbidden: Insufficient privileges for role ${activeSession.role}`);
      }
      const codes = z.array(z.string().min(1)).min(1).parse(rawCodes);

      const db = getDb();
      const shopRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('shop_name') as any;
      const shopName = shopRow?.value || 'Mechanical Shop POS';
      const issued = new Date();

      const result = await dialog.showSaveDialog({
        title: 'Save recovery codes',
        defaultPath: `recovery-codes-${issued.toISOString().slice(0, 10)}.txt`,
        filters: [{ name: 'Text file', extensions: ['txt'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      const lines = [
        `${shopName} - owner recovery codes`,
        `Issued ${issued.toLocaleString()}`,
        '',
        'Each code works once. Using one does not affect the others.',
        'They reset the owner password from the login screen.',
        'Keep this away from the counter - anyone holding a code can take over the owner account.',
        '',
        ...codes.map((code, i) => `  ${i + 1}.  ${code}`),
        '',
        'Generating a new sheet in Settings replaces every code above.',
        '',
      ];

      fs.writeFileSync(result.filePath, lines.join('\r\n'), 'utf8');
      logAudit('EXPORT_RECOVERY_CODES', 'settings', undefined, { by: activeSession?.username });

      return { success: true, filePath: result.filePath };
    });

}
