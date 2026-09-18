# Fatema Electronics POS — Offline-First Desktop System

> **A production-ready Point of Sale and inventory desktop application for a small electronics and parts shop in Bangladesh. One till, no internet needed, Bengali-ready invoices.**

[![Built with Electron](https://img.shields.io/badge/Electron-34.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Features

- **⚡ Offline-First, Zero-Setup**
  - Embedded local **SQLite database (`shop.db`)** in **Write-Ahead Logging (WAL)** mode.
  - Versioned migration runner: a database months behind catches up in one launch. A copy is taken before the first launch of a new version.
- **💰 Integer Paisa Money (No Floating-Point Drift)**
  - Every price, cost, total, discount, refund and payment is stored and calculated as integer paisa (1 Taka = 100 paisa).
- **📋 Live Customer Due (বাকী) Ledger**
  - Balances are never stored as mutable columns. They are derived by the `v_customer_due` SQL view (`SUM(sales) - SUM(payments)`).
  - Full statement history, partial collections and printable money receipts.
- **🧾 Sales, Returns and Shifts**
  - Held sales, split payments (cash, bKash, Nagad, card, other), credit sales and due collection.
  - Returns with their own return invoices, refunded in cash or credited against dues.
  - Cash-drawer shifts with opening float, petty cash in/out, reconciliation and a printable Z-report.
- **🏷️ Barcode Scanning and Receipt Printing**
  - Global keyboard-emulation listener catches USB barcode scanner input from any screen.
  - **80mm thermal receipts** and **A4 invoice memos** with Bengali Unicode, logo, QR code and amount in words.
  - Silent printing to a chosen receipt printer, or the Windows print dialog. The invoice PDF is drawn to page images (pdf.js) and printed at exact paper size, so the paper matches the preview.
  - Code128 barcode label and A4 sticker sheet generators.
- **📦 Stock, Suppliers and Purchases**
  - FIFO cost batches, stock adjustments with history, low-stock alerts, CSV bulk import.
  - Supplier ledgers, purchase invoices with landed transport cost, and supplier payments.
- **📊 Reports**
  - Daily sales, profit and loss, stock valuation, refund-aware daily breakdown, staff sales, audit log.
- **🛡️ Role-Based Access**
  - **Owner**: profit and loss, cost prices, staff accounts, settings, data tools.
  - **Staff / Cashier**: fast checkout, customer search, invoice reprints, with cost prices and margins hidden.
  - PIN login and idle lock for the counter, recovery codes for a forgotten owner password.
- **☁️ Backups**
  - Local `VACUUM INTO` backups with retention, one-click export and restore.
  - Optional Google Drive backup (OAuth with PKCE) and optional Supabase push sync.
  - Secrets encrypted at rest with Windows DPAPI via Electron `safeStorage`.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 22.12 or later.** electron-builder 26 needs it; on older Node `npm install` fails in its post-install step.
- **Windows 10 / 11 (x64)**

### 1. Install
```powershell
git clone <repository-url>
cd project-767
npm install
```

### 2. Run in development
Starts Vite and Electron together with hot reload:
```powershell
npm start
```

### 3. First run
The app seeds one owner account (`owner` / `owner123`) and opens a setup wizard. The wizard **requires a new owner password** before setup can finish and then issues recovery codes. Keep those codes: they are the only way back in if the password is forgotten. No staff account is seeded; create staff from the Users screen.

Forgot the owner password on a development machine?
```powershell
npm run reset-owner
```

---

## 📦 Building the Windows Installer

```powershell
npm run electron:build
```

Runs the type check, the renderer and main-process builds, then electron-builder. Two to five minutes. Output in `release/`:

- **`Fatema Electronics POS-Setup-1.0.0.exe`** — NSIS installer with desktop and Start Menu shortcuts.
- **`Fatema Electronics POS-Portable-1.0.0.exe`** — single-file executable, no install.

Before building, **close the dev app**. Its file watcher holds the project's folders and the packager fails with `EPERM … rename win-unpacked.tmp`. If it must stay running, build outside the project:
```powershell
npm run electron:build -- --config.directories.output=../project-767-release
```

The installer is not code-signed, so SmartScreen warns on first run. See [`RELEASE.md`](RELEASE.md) for the full release and upgrade procedure, and [`google-oauth.example.json`](google-oauth.example.json) for Drive credentials.

---

## 🗄️ Data and Database

### Where the data lives
- **Windows**: `%APPDATA%\fatema-electronics-pos\shop.db`, with local backups in `backups\` beside it.
- The dev app and the installed app **share this folder** on a development machine.
- The installer never touches it. **Uninstalling asks** whether to delete it; the default is No, and upgrades never ask.
- Builds from before the September 2026 package rename kept their data in `%APPDATA%\mechanical-shop-pos\`. That data is not migrated automatically; see `RELEASE.md`.

### Core invariants
1. **Integer money**: `100.50 Taka` is stored as `10050` paisa.
2. **Race-safe stock decrement**:
   ```sql
   UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?;
   ```
3. **Derived customer due**:
   ```sql
   CREATE VIEW v_customer_due AS
   SELECT
     c.id, c.name, c.phone, c.address,
     COALESCE(s.total_sales, 0) AS total_sales_paisa,
     COALESCE(p.total_paid, 0)  AS total_paid_paisa,
     MAX(0, COALESCE(s.total_sales, 0) - COALESCE(p.total_paid, 0)) AS due_paisa
   FROM customers c
   LEFT JOIN (SELECT customer_id, SUM(total_paisa) AS total_sales FROM sales
              WHERE status = 'completed' AND deleted_at IS NULL GROUP BY customer_id) s ON c.id = s.customer_id
   LEFT JOIN (SELECT customer_id, SUM(amount_paisa) AS total_paid FROM payments
              WHERE deleted_at IS NULL GROUP BY customer_id) p ON c.id = p.customer_id;
   ```
4. **Migrations are append-only.** A shipped migration is never edited; new changes get a new id at the end of `MIGRATIONS` in `electron/db/migrations.ts`.

---

## ☁️ Optional Cloud Backup

**Google Drive** — in Settings, connect a Google account. The app uploads database backups to the shop's own Drive. Requires an OAuth client in `google-oauth.json` at build time; without it the feature reports itself unconfigured and everything else works.

**Supabase** (push-only sync, a cloud copy rather than multi-till sync):
1. Create a free project at [supabase.com](https://supabase.com).
2. In its SQL Editor, run [`electron/services/supabaseSchema.sql`](electron/services/supabaseSchema.sql).
3. Click the cloud badge in the app header and enter the Supabase URL, anon key and shop ID.
4. Save. Changes sync in the background whenever a connection is available.

---

## 🔒 Security

- **Context isolation**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`; every renderer call goes through a typed preload bridge.
- **Strict CSP**: `script-src 'self'`, no `unsafe-eval`; `blob:` allowed only for PDF previews and the bundled PDF worker; `connect-src` limited to Supabase.
- **Validated IPC**: `zod` schemas on all 100+ IPC handlers, with role checks on the main-process side.
- **DevTools** closed and blocked in packaged builds.
- **Secrets** (Drive refresh token, Supabase keys) stored encrypted with DPAPI.
- **Not encrypted**: `shop.db` itself. Use BitLocker on the till. See `RELEASE.md`.

---

## 📄 License
This project is licensed under the MIT License.
