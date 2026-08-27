# Role-Based Access — Review & Fix Notes

**Project:** Mechanical Shop POS (project-767)
**Date:** August 21, 2026

## যা check করা হয়েছে

পুরো `src/` (27 components) আর `electron/` backend (IPC handlers, role middleware) দেখা হয়েছে — বিশেষ করে **Owner vs Staff** access boundary কতটা সঠিকভাবে enforce করা আছে সেটা।

## যা আগে থেকেই ঠিক ছিল (কিছু পরিবর্তন লাগেনি)

| জায়গা | Owner | Staff | Enforcement |
|---|---|---|---|
| Product Add / Edit / Delete | ✅ | ❌ | Frontend hide + Backend `requireRole(['owner'])` |
| Bulk CSV Import | ✅ | ❌ | Frontend hide + Backend `requireRole(['owner'])` |
| Cost Price দেখা | ✅ | ❌ | Frontend column hidden |
| Stock Adjustment (manual correction) | ✅ | ❌ | Backend `requireRole(['owner'])` |
| Reports — Profit / COGS / Margin | ✅ | ❌ | Frontend lock icon + backend filter |
| Dashboard / Users / Settings / Audit tab | ✅ | ❌ (nav এ দেখায়ই না) | `isOwner &&` route guard |
| POS Discount limit | Unlimited | Max 10% | **দুই জায়গায়** — UI validation + Backend re-check (`handlers.ts:614`) |
| Sell / Checkout / Invoice | ✅ | ✅ | সবার জন্য open — এটাই তো staff এর মূল কাজ |

Discount limit বিশেষভাবে ভালো implement করা ছিল — শুধু frontend এ আটকায়নি, backend এও same 10% rule আছে, তাই DevTools দিয়ে bypass করা যাবে না।

## যে bug পাওয়া গেছে এবং fix করা হয়েছে

**সমস্যা:** Products tab এর প্রতিটা row এ "Quick Stock-In" বাটন (green ↓ icon) — এইটা owner-check ছাড়া সবার জন্য visible ছিল, এবং backend handler `api:products:stockIn` ভুলবশত `requireRole(['owner', 'staff'])` — মানে staff role থেকেও stock বাড়ানো সম্ভব ছিল।

তোমার requirement অনুযায়ী staff শুধু **sell** করবে, stock/price touch করবে না — তাই এইটা close করা হলো।

### Fix ১ — Backend (`electron/ipc/handlers.ts`, line ~385)
```diff
  ipcMain.handle('api:products:stockIn', async (_event, rawData) => {
-   requireRole(['owner', 'staff']);
+   requireRole(['owner']);
```

### Fix ২ — Frontend (`src/components/products/ProductsView.tsx`)
Stock-In বাটন এখন Edit/Delete বাটনের মতোই `isOwner` দিয়ে wrap করা:
```diff
- <button onClick={() => setStockInProduct(product)} title="Quick Stock-In">
-   <ArrowDownCircle className="w-3.5 h-3.5" />
- </button>
+ {isOwner && (
+   <button onClick={() => setStockInProduct(product)} title="Quick Stock-In">
+     <ArrowDownCircle className="w-3.5 h-3.5" />
+   </button>
+ )}
```
Submit handler এও extra guard যোগ করা হয়েছে (`!isOwner` হলে early return) — শুধু button hide করাই যথেষ্ট না, handler নিজেও check করা উচিত।

**কেন দুই জায়গায় fix লাগলো:** Frontend এ বাটন লুকানো শুধু UI cosmetic — backend handler role check না করলে staff তবুও raw IPC call দিয়ে stock বাড়াতে পারতো। Security সবসময় backend/server-side এ enforce করতে হয়, frontend hide শুধু UX এর জন্য।

## এখন staff এর actual access (final)

- ✅ POS — sell, checkout, invoice print, hold sale
- ✅ Sales History — দেখতে পারবে
- ✅ Customers — lookup, due collection
- ✅ Products — শুধু **দেখতে** পারবে (নাম, stock qty, sell price) — stock-in/edit/delete/cost-price সব বন্ধ
- ❌ Suppliers, Reports (profit data), Users, Settings, Audit, Dashboard — hidden বা restricted

আলাদা login লাগছে না — same session এ role অনুযায়ী UI + backend দুটোই automatically restrict হচ্ছে, যেটা তুমি চেয়েছিলে।

## এখনো clean-up বাকি (optional, urgent না)

`src/components/products/StockInModal.tsx` আর `StockAdjustmentModal.tsx` — এই দুইটা component কোথাও import/use হচ্ছে না (dead code)। ভবিষ্যতে বাদ দিতে পারো, কোনো functional impact নাই।

## Changed Files (এই zip এ আছে)
- `electron/ipc/handlers.ts`
- `src/components/products/ProductsView.tsx`
