# PROMPT FOR ANTIGRAVITY — Mechanical Shop POS (Desktop, Offline-First)

You are building a production-grade, offline-first desktop POS application for a mechanical parts shop in Bangladesh. Final deliverable is a Windows **.exe** (Electron). Follow this document exactly. Where this document conflicts with your defaults, this document wins.

---

## 1. Product Summary

A desktop Point of Sale app for a mechanical parts shop:
- Inventory with barcode workflow (one barcode = one product model, quantity-based stock)
- POS sell screen (scan → cart → payment → invoice PDF)
- Customer due/baki ledger
- Reports (sales, profit, stock, best-sellers)
- Owner/Staff roles with audit log
- Offline-first local SQLite; background delta-sync to Supabase when internet is available

Primary users are non-technical shop staff. Zero setup: app must work fully on first launch with no configuration.

---

## 2. Tech Stack (LOCKED — do not substitute)

| Layer | Choice | Critical rules |
|---|---|---|
| UI | React + **Vite** (or Next.js with `output: 'export'` static mode ONLY) | No SSR, no API routes, no Next middleware — Electron loads static files. If Next.js causes friction with Electron, use Vite + React Router. |
| Desktop | Electron (latest LTS) | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, no `remote` module. |
| Local DB | `better-sqlite3` | **Main process only.** Never import it in renderer. All DB access via typed IPC handlers exposed through a `preload.ts` `contextBridge`. Run `electron-rebuild` in postinstall. |
| Cloud | Supabase (Postgres) | Sync from main process only. See §5 security rules for keys. |
| Styling | Tailwind CSS | |
| PDF | `pdfmake` | Invoice generation in main process; renderer requests via IPC. |
| Barcodes | `jsbarcode` (Code128) for internal labels + invoice barcode; `qrcode` for invoice QR | |
| Packaging | `electron-builder` → NSIS installer + portable exe | |

DB file location: `app.getPath('userData')/shop.db`, created + migrated automatically on first run with a versioned migration system (a `migrations` table storing applied migration ids).

---

## 3. Non-Negotiable Security Requirements

Implement ALL of these. Treat each as an acceptance criterion.

1. **IPC surface**: whitelist-based. Preload exposes named functions only (e.g. `api.products.search(q)`), never a generic `invoke(channel, ...args)` passthrough. Every IPC handler validates its input with `zod` before touching the DB.
2. **SQL**: prepared statements / parameter binding everywhere. String concatenation into SQL is forbidden — including in search (`LIKE ?` with escaped `%_`).
3. **Passwords**: hash with `argon2id` (or `bcrypt` cost ≥ 12 if argon2 native build is problematic). Never store or log plaintext. Enforce minimum PIN/password length 6. Login attempts rate-limited (5 tries → 30s lockout) and recorded in audit log.
4. **Authorization in the backend, not the UI**: every privileged IPC handler (price edit, cost price read, discount above limit, refund, report access, user management, backup restore) re-checks the current session's role in the **main process**. Hiding buttons in React is not access control.
5. **Sessions**: in-memory session in main process after login; auto-lock after configurable idle minutes; staff cannot see cost price or profit anywhere (including in search results payloads — strip fields server-side in the IPC handler based on role).
6. **Supabase keys**: NEVER ship the `service_role` key inside the app. Options, in order of preference:
   a. Each shop gets a Supabase **auth user**; app logs in with email/password stored via `safeStorage` (Electron OS keychain encryption), uses the **anon key + Row Level Security** policies scoping every table to that shop's `shop_id`.
   b. Or sync through a small Supabase Edge Function that validates a per-shop token.
   RLS must be ON for every synced table. Write the RLS policies as part of Phase 5.
6b. Any secret persisted locally (Supabase refresh token, SMS API key later) goes through `electron.safeStorage`, never plaintext JSON.
7. **Money**: store all amounts as **integer paisa** (or integer taka if the shop never uses paisa — pick integer paisa). No floats in DB or arithmetic. Format only at display time.
8. **Transactions**: a sale (insert sale + sale_items + stock decrement + customer due update + audit row) runs inside ONE SQLite transaction. Stock can never go negative from a race — decrement with `UPDATE ... SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?` and fail the transaction if 0 rows changed (offer override with owner approval for known count drift).
9. **Audit log**: append-only table. No IPC handler for update/delete on it. Log: login/logout/failed login, sale, refund, price change, stock adjustment, user management, backup/restore, sync errors.
10. **Scanner input = keyboard input**: treat scanned strings as untrusted. Validate charset/length before lookup. Render everything through React (no `dangerouslySetInnerHTML`).
11. **Electron hardening**: single `BrowserWindow`, `webSecurity: true`, strict CSP meta tag (`default-src 'self'`), deny `window.open`/external navigation (`setWindowOpenHandler` → deny), disable devtools in production build.
12. **Backups**: besides Supabase sync, a daily local backup — copy `shop.db` (using SQLite `VACUUM INTO`) to `userData/backups/`, keep last 14, plus a manual "Backup Now" that also lets the owner export to a chosen folder/USB. Restore is owner-only and audited.
13. **Updates/packaging**: if auto-update is added later it must be signed; for now, produce a reproducible electron-builder config and document the build.

---

## 4. Database Schema (corrected — implement this, not the draft in the client spec)

All tables include: `id TEXT PRIMARY KEY` (UUIDv7), `created_at`, `updated_at` (ISO-8601 UTC), `deleted_at NULL` (soft delete — required for sync), `device_id TEXT`.

- `products`: barcode (UNIQUE, nullable→auto-generate internal `INT-` prefixed Code128), name, name_bn (optional), category_id, brand, unit (pcs/box/kg), cost_price_paisa, sell_price_paisa, stock_qty INTEGER, low_stock_threshold, is_serial_tracked BOOLEAN
- `categories`: name
- `suppliers`: name, phone, address, total_payable_paisa
- `purchases`: supplier_id, invoice_ref, total_paisa, paid_paisa, note
- `purchase_items`: purchase_id, product_id, qty, unit_cost_paisa
- `stock_transactions`: product_id, type (`purchase|sale|return_in|return_out|adjustment|initial`), qty_delta (signed), ref_table, ref_id, reason, user_id
- `serial_numbers`: product_id, serial (UNIQUE per product), status (`in_stock|sold|returned|warranty_out`), sale_item_id NULL
- `customers`: name, phone (indexed), address, note  ← **no stored total_due; due is derived**
- `sales`: invoice_no (UNIQUE, format `INV-<DEVICE>-YYYYMMDD-####` — device code prevents offline collisions across future multi-PC), status (`completed|held|refunded|partial_refund`), customer_id NULL, subtotal_paisa, discount_paisa, total_paisa, user_id
- `sale_items`: sale_id, product_id, qty, unit_price_paisa, discount_paisa, serial_number_id NULL
- `payments`: ledger for ALL money movement — sale_id NULL, customer_id NULL, direction (`in|out`), method (`cash|bkash|nagad|card`), amount_paisa, type (`sale_payment|due_collection|refund|supplier_payment`), user_id. Split payment = multiple rows. **Customer due = SUM(their sales totals) − SUM(their payments in)**, computed by a view.
- `returns`: sale_id, user_id, reason; `return_items`: return_id, sale_item_id, qty, amount_paisa
- `users`: name, username UNIQUE, role (`owner|staff`), password_hash, is_active
- `audit_log`: user_id, action, entity, entity_id, detail_json, created_at (append-only)
- `settings`: key/value (shop name, address, invoice footer, idle-lock minutes, device_id, low-stock defaults)
- `sync_state`: table_name, last_pushed_at, last_pulled_at
- `migrations`: id, applied_at

Views: `v_customer_due`, `v_daily_sales`, `v_product_profit`, `v_stock_valuation`.

---

## 5. Sync Design (Phase 5)

- Delta sync per table using `updated_at` + `deleted_at` (soft deletes sync as tombstones — never hard-delete synced rows locally).
- Push-first architecture (single device now): queue outbound changes; on connectivity, push in dependency order (products → sales → sale_items → payments…), then pull.
- Timestamps set by the app in UTC; also store server `synced_at`. Conflict rule for future multi-device: last-writer-wins on `updated_at` EXCEPT `stock_qty`, which is never synced as a value — it is recomputed from `stock_transactions` (event-sourced), so concurrent sales on two devices merge correctly.
- Sync runs in main process on an interval + on connectivity events; failures logged, retried with backoff; a small status indicator in the UI (`Synced ✓ / Pending 12 / Offline`).
- Supabase side: same schema + `shop_id` column on every table + RLS policies (`shop_id = auth.jwt() ->> 'shop_id'` pattern).

---

## 6. Key UX Requirements

- POS screen is keyboard-first: scan adds to cart instantly (scanner sends Enter suffix), `F2` quick-search by name, `F4` payment, `F8` hold sale, numpad-friendly qty edit. Focus management must survive dialogs (scanner types into a global capture, not a fragile input field).
- New-stock flow: scan → if exists, popup "Current: X. Add how many?" → creates `stock_transactions` row. If unknown barcode → quick-create product form pre-filled with barcode.
- Bulk CSV/Excel import (Phase 1): template download, dry-run validation report (duplicates, bad prices) before commit, all-or-nothing transaction.
- Invoice PDF: 80mm thermal layout AND A5 layout (setting), shop header, items, dues, invoice Code128 + QR of invoice_no; scanning an invoice barcode anywhere in the app opens that sale (return/refund/reprint).
- Bangla-friendly: UI labels in English but product names, customer names must handle Bangla text everywhere including PDFs (embed a Bangla-capable font like Noto Sans Bengali in pdfmake).
- Low stock: badge + dashboard list.
- Empty states and errors always say what to do next. No silent failures.

---

## 7. Build Phases & the progress.html Protocol

A file `progress.html` sits at the repository root (already provided). It contains a `const PROJECT_DATA = {...}` block listing every phase and task below with `"status": "todo"`.

**Protocol — follow after EVERY task:**
1. When you complete a task, edit `progress.html` and set that task's `status` to `"done"` and `completedAt` to today's date (ISO).
2. When starting a task, set it to `"doing"`.
3. If you intentionally defer/change a task, set `status: "blocked"` and fill `note` with one line explaining why.
4. At the end of each phase, verify every acceptance criterion for that phase, then set the phase's `status: "done"` and write a 1–2 line `note` summarizing what shipped. Do not mark a phase done if any of its tasks are not done/blocked-with-note.
5. Never remove tasks from PROJECT_DATA; never edit the HTML/JS outside the PROJECT_DATA block.

### Phase 0 — Scaffold & Hardening
Tasks: repo + Vite/React + Electron + TypeScript scaffold; secure BrowserWindow config (§3.11); preload contextBridge with one demo typed IPC call; better-sqlite3 in main + migration runner + `migrations` table; CI-able build script; electron-builder config producing a runnable dev .exe.
Acceptance: app opens a window, creates shop.db, passes a smoke IPC round-trip; `nodeIntegration` off verified.

### Phase 1 — Products & Stock
Tasks: full schema migration (§4); products CRUD (role-aware field stripping); barcode lookup + internal barcode auto-generation + label print sheet (A4 grid of Code128 labels); stock-in flow (scan → add qty popup); purchases + suppliers; stock_transactions ledger + adjustment with reason; CSV import with dry-run; low-stock alerts; category/brand filter + search.
Acceptance: add 1,000 products via CSV in one transaction; stock_qty always equals SUM(stock_transactions); staff login cannot retrieve cost_price via any IPC payload.

### Phase 2 — POS & Invoicing
Tasks: POS screen (cart, qty edit, per-item + total discount with owner-limit rule); split payments; hold/park + resume; sale transaction (§3.8); invoice number generator with device code; pdfmake invoices (thermal + A5, Bangla font); invoice barcode/QR + scan-to-open-sale; reprint; return/refund flow (quantity-based, serial-aware) restoring stock via stock_transactions.
Acceptance: simulated concurrent sale of last unit fails cleanly for the second cart; refund restores stock and writes payments row `direction=out`; invoice PDF renders Bangla product names.

### Phase 3 — Customers & Due (Baki)
Tasks: customers CRUD; attach customer to sale; partial payment at sale time; due collection screen (payments ledger); `v_customer_due`; per-customer purchase + payment history; due summary on dashboard.
Acceptance: due figures always derived from ledger — deleting/refunding a sale updates due correctly; no `total_due` column anywhere.

### Phase 4 — Reports, Users, Audit
Tasks: daily/monthly sales report; profit report (owner only); best sellers; stock valuation; date-range filters + CSV export; users CRUD (owner only); login screen + idle auto-lock; role enforcement audit of every IPC handler (write a checklist in code comments); audit log viewer (owner only).
Acceptance: automated test proving each privileged handler rejects staff role; reports match hand-computed fixtures.

### Phase 5 — Cloud Sync & Backup
Tasks: Supabase schema + RLS policies + shop provisioning script; safeStorage credential store; outbound queue + delta sync engine (§5); tombstone handling; sync status UI; daily local `VACUUM INTO` backup + retention; manual backup/restore (owner, audited).
Acceptance: kill internet mid-sync → no data loss, resumes cleanly; anon key only in app; RLS verified by attempting cross-shop read with a second test account (must fail).

### Phase 6 — Packaging & Delivery
Tasks: production build (devtools off, CSP verified); NSIS installer + portable exe; first-run wizard (shop name, owner account, device code); seed/demo data toggle; README with build + install steps; final security pass against §3 checklist (write results into progress.html notes).
Acceptance: fresh Windows VM → install → sell → print PDF works offline end to end.

---

## 8. Working Rules

- TypeScript strict everywhere. Zod schemas shared between renderer and main for IPC payloads.
- Write tests where they pay: money math, sale transaction, sync engine, role enforcement.
- Small commits per task, message prefixed with the task id from PROJECT_DATA (e.g. `p2t4: refund flow`).
- If a client-spec detail conflicts with §3 or §4, this document wins; note the deviation in progress.html.
- Do not invent extra features (loyalty points, e-commerce, etc.). Ship the phases in order.
