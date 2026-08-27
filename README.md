# Mechanical Shop POS — Offline-First Desktop System

> **A rugged, production-ready Point of Sale (POS) and inventory management desktop application crafted specifically for automotive and mechanical parts shops in Bangladesh.**

[![Built with Electron](https://img.shields.io/badge/Electron-34.x-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite WAL](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3.4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🌟 Key Features

- **⚡ Offline-First Zero-Setup Architecture**:
  - Embedded local **SQLite database (`shop.db`)** running in high-concurrency **Write-Ahead Logging (WAL)** mode.
  - Automatic migration runner ensures instantaneous zero-configuration startup on any Windows machine.
- **💰 Pure Integer Paisa Math (No Floating-Point Drift)**:
  - Every price, cost, total, discount, refund, and payment is strictly stored and calculated as integer Paisa (1 Taka = 100 Paisa).
- **📋 Live Dynamic Due (বাকী) Ledger**:
  - Due balances are never stored as mutable columns. They are derived dynamically via the high-performance `v_customer_due` SQL view (`SUM(sales) - SUM(payments)`).
  - Complete account statement history with partial collection and printable Money Receipts.
- **🏷️ USB Barcode Scanning & Thermal Printing**:
  - Global zero-focus keyboard emulation listener catches USB barcode scanner inputs from any screen.
  - Generates instant **80mm POS thermal roll receipts** and **A5 formal invoice memos** with full Bengali Unicode support.
  - Built-in Code128 barcode sticker sheet generator for A4 paper.
- **🛡️ Enterprise Role-Based Access Control (RBAC)**:
  - **Owner**: Complete authority over profit & loss reports, stock valuation, cost prices, staff accounts, and database reset.
  - **Staff / Cashier**: Fast POS checkout, customer search, and invoice printing with cost prices and profit margins securely concealed.
- **☁️ Supabase Cloud Sync & Local Atomic Backups**:
  - Background push-first delta sync engine with dependency ordering, tombstone deletes, and exponential retry.
  - Credentials encrypted natively with Windows DPAPI via Electron `safeStorage`.
  - Non-blocking online `VACUUM INTO` backups with automated 14-day retention rotation and one-click USB export.
- **☀️ Modern High-Contrast Light Theme**:
  - Crisp, professional white and slate aesthetic tailored for bright daylight workshop counters and retail storefronts.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18 or later (v20+ recommended)
- **Operating System**: Windows 10 / 11 (x64)

### 1. Installation
Clone the repository and install all dependencies:
```powershell
git clone <repository-url>
cd project-767
npm install
```

### 2. Run in Development Mode
Launch the Electron desktop application with hot-reload:
```powershell
npm run electron:dev
```

### 3. Default Login Credentials

| Role | Username | Password | Capabilities |
|---|---|---|---|
| **Owner** | `owner` | `owner123` | Full access to P&L reports, costs, user management, and cloud settings |
| **Staff** | `staff` | `staff123` | POS checkout, inventory view (cost hidden), invoice reprints |

---

## 📦 Building Windows Installers & Release Executables

To build production-ready distributables:

```powershell
# 1. Compile React frontend and Electron backend
npm run build

# 2. Package into Windows NSIS Installer and Portable .exe
npm run electron:build
```

### Generated Distributables (in `./release/` directory):
- **`Mechanical Shop POS-Setup-1.0.0.exe`**: Full Windows NSIS setup wizard with desktop shortcuts and auto-uninstaller.
- **`Mechanical Shop POS-Portable-1.0.0.exe`**: Zero-install standalone executable that runs directly from USB drives.

---

## 🗄️ Database Architecture & Migrations

### Local Storage Location
- **Windows**: `%APPDATA%\Mechanical Shop POS\shop.db` (or `Electron\shop.db` in dev)

### Core Invariants:
1. **Integer Money**: `100.50 Taka` is stored as `10050` Paisa.
2. **Race-Safe Stock Decrement**:
   ```sql
   UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?;
   ```
3. **Derived Customer Due Balance**:
   ```sql
   CREATE VIEW v_customer_due AS
   SELECT 
     c.id, c.name, c.phone, c.address,
     COALESCE(s.total_sales, 0) as total_sales_paisa,
     COALESCE(p.total_paid, 0) as total_paid_paisa,
     MAX(0, COALESCE(s.total_sales, 0) - COALESCE(p.total_paid, 0)) as due_paisa
   FROM customers c
   LEFT JOIN (SELECT customer_id, SUM(total_paisa) as total_sales FROM sales WHERE status = 'completed' AND deleted_at IS NULL GROUP BY customer_id) s ON c.id = s.customer_id
   LEFT JOIN (SELECT customer_id, SUM(amount_paisa) as total_paid FROM payments WHERE deleted_at IS NULL GROUP BY customer_id) p ON c.id = p.customer_id;
   ```

---

## ☁️ Setting Up Supabase Cloud Backup (Optional)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard and run the entire contents of [`electron/services/supabaseSchema.sql`](electron/services/supabaseSchema.sql).
3. In the POS application header, click the **Cloud / Local Only** badge.
4. Enter your **Supabase URL**, **Anon Key**, and **Shop ID (UUID)**.
5. Click **Save & Encrypt Credentials**. The app will automatically sync all changes in the background whenever an internet connection is detected.

---

## 🔒 Security Hardening Compliance

- ✅ **Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- ✅ **Strict Content Security Policy (CSP)**: `script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://*.supabase.co`.
- ✅ **IPC Whitelisting**: Strict `zod` input validation schemas across all 40+ IPC handlers.
- ✅ **DevTools Enforcement**: Automatically closed and blocked in production packaged mode.
- ✅ **Secure Storage**: Cryptographic storage of sensitive API tokens via Windows DPAPI.

---

## 📄 License
This project is licensed under the MIT License.
