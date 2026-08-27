# Mechanical Shop POS — Improvement Notes

Frontend (src/) আর electron backend দুইটাই review করে যেই issue/improvement suggestion গুলা পাওয়া গেছে, সেগুলা এখানে গোছানো আছে।

---

## 🔴 Critical (আগে ঠিক করা দরকার)

### 1. Auto-login + fake role switcher — RBAC বাইপাস হয়ে যাচ্ছে
- **কোথায়:** `src/App.tsx`
- **সমস্যা:** App খুললেই স্বয়ংক্রিয়ভাবে `owner/owner123` দিয়ে login হয়ে যায় — কোনো login screen-ই দেখায় না। এছাড়া `AuthBanner.tsx`-এ একটা "Owner ⇄ Staff" quick-switch button আছে যেটা password ছাড়াই role পাল্টে দেয়।
- **প্রভাব:** Cost price/profit hide করার পুরো security feature অকেজো হয়ে যাচ্ছে — যে কেউ এক click-এ Owner হয়ে যেতে পারবে।
- **Fix:** App start-এ auto-login কল remove করো, real login screen দেখাও। Quick-switch button dev-only flag-এর পিছনে রাখো বা সরিয়ে ফেলো।

### 2. `wizard:completeFirstRun` — কোনো auth check নাই
- **কোথায়:** `electron/ipc/handlers.ts` (~লাইন 1838)
- **সমস্যা:** এই handler-এ `requireRole()` কল নাই, আর `first_run_completed` setting আগেই `'1'` কিনা সেটাও check হয় না।
- **প্রভাব:** Setup শেষ হওয়ার পরও, login ছাড়াই কেউ `window.api.wizard.completeFirstRun({ owner_password: 'hacked123' })` কল করলে owner-এর password চুপচাপ reset হয়ে যাবে।
- **Fix:**
  ```ts
  ipcMain.handle('api:wizard:completeFirstRun', async (_event, rawPayload) => {
    const db = getDb();
    const already = db.prepare("SELECT value FROM settings WHERE key = 'first_run_completed'").get() as any;
    if (already?.value === '1') {
      requireRole(['owner']); // completed hoye gele shudhu owner change korte parbe
    }
    // ...baki code
  });
  ```

### 3. Developer-facing text ইউজারকে দেখাচ্ছে
- **কোথায়:** `src/App.tsx`
- **সমস্যা:** "IPC Connection Error", "Connected (OK at...)", "SQLite DB shop.db active with migration engine", "Web Browser Mode (No Electron Desktop IPC)" — এই লাইনগুলা UI-তে দেখানো হচ্ছে।
- **প্রভাব:** Shop-এর cashier/owner-এর কাছে এগুলা অর্থহীন, confusing।
- **Fix:** এগুলা `console.log`-এ রাখো, UI থেকে সরিয়ে ফেলো।

---

## 🟡 Medium (security hardening)

### 4. `safeStore.ts`-এ hardcoded fallback encryption key
- **কোথায়:** `electron/services/safeStore.ts`
- **সমস্যা:** `FALLBACK_SECRET = 'msp-pos-secure-key-2026-bangladesh'` — এটা static, source code-এই লেখা।
- **প্রভাব:** Windows DPAPI (`safeStorage`) available না থাকলে Supabase URL/anon key এই static key দিয়ে encrypt হয় — app asar-extract করলে key trivially বের করা যাবে।
- **Fix:** Per-install random key generate করে `userData` folder-এ আলাদা file-এ রাখো, হার্ডকোড করো না।

---

## 🟢 UI সহজবোধ্য করার জন্য

### 5. সব UI text ইংরেজি — non-technical Bangla-speaking staff-এর জন্য কঠিন
- Product-এর `name_bn` field আছে কিন্তু nav/button/label সব ইংরেজি।
- কমপক্ষে POS screen আর main nav bilingual/Bangla করলে staff-দের জন্য অনেক সহজ হবে ("বিক্রি", "পণ্য", "গ্রাহক", "বাকী", "রিপোর্ট")।

### 6. `alert()` / `confirm()` ব্যবহার হচ্ছে (২৬+৬ জায়গায়)
- এগুলা browser-এর ugly, blocking popup — professional look দেয় না, POS-এর মতো fast-paced counter-এ কাজের গতি কমায়।
- **Fix:** Non-blocking toast notification (success/error) ব্যবহার করো — `react-hot-toast` বা নিজের ছোট component।

### 7. Reports শুধু table, কোনো chart নাই
- **কোথায়:** `src/components/reports/ReportsView.tsx`
- Owner-এর জন্য daily sales trend/profit margin দেখতে bar/pie chart table-এর চেয়ে অনেক দ্রুত বোঝা যায়।
- **Fix:** `recharts` add করে simple bar/pie chart দাও।

### 8. App সরাসরি POS-এ চলে যায়, কোনো Dashboard/Home নাই
- Owner login করলে আজকের total sale, due collection, low-stock count — এই summary এক নজরে দেখতে পাওয়া উচিত।
- এখন এটা দেখতে হলে Reports tab-এ যেতে হয়।

### 9. Low-stock alert শুধু Products tab-এর ভিতরে filter হিসেবে আছে
- Customers tab-এ যেমন due count badge (🔴 নম্বর) nav-এ দেখা যায়, Products tab-এও low-stock count badge থাকলে owner এক নজরে বুঝবে কিছু কেনা লাগবে কিনা।

---

## 🟢 Feature-level উন্নতি (POS-centric)

### 10. Scan feedback
- Barcode scan সফল হলে ছোট beep/green flash, না পেলে red flash — visual/audio confirmation ছাড়া fast scanning-এ mistake হওয়ার সম্ভাবনা বেশি।

### 11. Keyboard shortcut hint স্ক্রিনে নাই
- F2/F4/F8 shortcuts code-এ আছে কিন্তু screen-এ কোথাও দেখানো হয় না। নতুন staff শিখবে কীভাবে?

### 12. Customer due reminder (WhatsApp/SMS)
- বাকী ট্র্যাক করা আছে কিন্তু reminder পাঠানোর কোনো option নাই — এটা shop-এর জন্য বড় pain point resolve করবে।

### 13. Print preview before confirm
- Sale complete করার আগে invoice preview না দেখিয়ে সরাসরি PDF generate হয়ে যাচ্ছে — ভুল হলে re-print করা লাগবে।

---

## Priority অনুযায়ী কাজের ক্রম (suggestion)

1. Auto-login + role switcher bug (#1)
2. Wizard auth bug (#2)
3. Dev text UI থেকে সরানো (#3)
4. Toast notification system বসানো (#6)
5. safeStore hardcoded key fix (#4)
6. বাকিগুলো (Bangla UI, dashboard, charts, scan feedback ইত্যাদি) — পরবর্তী ধাপে
