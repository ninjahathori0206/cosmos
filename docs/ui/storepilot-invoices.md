# StorePilot — Invoices View

**Route:** `/storepilot/invoices`  
**Permission:** `storepilot.invoices.view`  
**Mobile-first:** yes — primary use case is staff looking up and sharing invoices on phone

---

## Purpose

Give store staff a fast, searchable list of recent invoices (default: last 7 days) so they can:
- Find a customer's invoice by name or mobile number without navigating to Lab Orders.
- View a receipt-style invoice summary.
- Share the invoice as an image (WhatsApp, Messages, etc.) via the device Web Share API.

---

## User flows

### Flow 1 — Browse recent invoices

1. Tap **Invoices** in the StorePilot sidebar.
2. Page loads with a skeleton, then shows a card list of the last 7 days' completed/invoiced orders for this store.
3. Each card shows: invoice no, customer name, mobile, order total, date+time, and a **Share** button.

### Flow 2 — Search

1. Type in the global search bar (customer name or 10-digit mobile).
2. Results are fetched live (debounced 400 ms) across all invoices for the store (not just 7 days when a search term is active).
3. Search clears → reverts to last-7-days view.

### Flow 3 — Share as image

1. Tap **Share** on an invoice card.
2. App fetches full order detail and renders a receipt frame (off-screen `<canvas>`).
3. Canvas is converted to a PNG Blob.
4. `navigator.share({ files: [imageFile], title: 'Invoice …' })` opens native share sheet.
5. Fallback (desktop / unsupported browser): offers a **Download PNG** link.

---

## Screen states

| State | Description |
|-------|-------------|
| **Loading** | 4-column skeleton cards (`cosmosSkeletonCards`) |
| **Results** | List of invoice cards, newest first |
| **Empty — no invoices** | Icon + "No invoices in the last 7 days" + subtext |
| **Empty — search no match** | Icon + "No invoices matching '…'" |
| **Error** | `cosmosToastError` + retry button |
| **Sharing** | Share button shows spinner via `cosmosBtnLoading`, then resets |

---

## Layout (mobile-first)

### Page header (sticky)
```
[ ← ] Invoices                           [↻ Refresh]
[ 🔍 Search customer name or mobile…         ]
```
- Search bar spans full width, single row
- On mobile: header padding 16px; search bar 44 px tall (comfortable tap target)

### Invoice card (full width, stacked vertically on mobile)
```
┌──────────────────────────────────────────┐
│ EW-INV-2627-SRT01-00002   25 May 2026   │
│                              10:32 AM   │
│ Rahul Sharma                            │
│ +91 98765 43210                         │
│                         ₹ 2,000        │
│                    [↗ Share as image]   │
└──────────────────────────────────────────┘
```
- Invoice no: bold, accent color
- Date/time: right-aligned, subtle
- Customer name: 15px medium
- Phone: 13px text2 color
- Total: 17px semi-bold, right side
- Share button: full-width on mobile, secondary style with share icon

### Desktop / tablet
- Cards are 2-column grid on ≥ 640 px

---

## Receipt image (shared)

A `<canvas>` renders an A5-proportion receipt:
```
 ╔══════════════════════════════╗
 ║    STORE NAME                ║
 ║    Invoice: EW-INV-…         ║
 ║    Date: 25 May 2026         ║
 ║──────────────────────────────║
 ║  Customer: Rahul Sharma      ║
 ║  Phone: +91 98765 43210      ║
 ║──────────────────────────────║
 ║  Total:           ₹ 2,000   ║
 ║  Paid:            ₹ 2,000   ║
 ║  Balance:         ₹ 0       ║
 ║──────────────────────────────║
 ║  Thank you for your visit!   ║
 ╚══════════════════════════════╝
```
- White background, dark text — readable after screenshot share
- Store name from session JWT (`store_name`)
- Powered-by footer: small "Cosmos ERP"

---

## API

### Existing (reuse)
- `GET /api/pos/orders?queue=INVOICED` — supports `invoicedSinceDays=7`, customer name/phone search via `q=` param.
- `GET /api/pos/orders/:id` — full order detail for receipt canvas render.

### New (add to `src/api/pos.js`)
- `GET /api/pos/invoices?q=&days=7` — thin wrapper over `fetchStoreOrders` with `invoicedQueue=true`, `search=q`, `invoicedSinceDays=days`. Avoids mixing invoice context into the lab-orders queue.

---

## Permissions

- `storepilot.invoices.view` — new key, add to `permissionsCatalogue.js` under **StorePilot — Billing**.
- Gate: `requireModule('storepilot') + requirePermission('storepilot.invoices.view')`.
- Nav item hidden when permission absent (RBAC-strict).

---

## Files to create / edit

| Area | File |
|------|------|
| UI spec | `docs/ui/storepilot-invoices.md` (this file) |
| Permissions | `src/config/permissionsCatalogue.js` |
| API | `src/api/pos.js` — new `GET /api/pos/invoices` |
| HTML | `StorePilot_Prototype.html` — new `#page-invoices` |
| JS | `src/public/js/storepilot-prototype.js` — `loadSpInvoices`, `shareSpInvoice`, canvas render |
| CSS | existing variables sufficient; minor `.sp-invoice-card` styles inline or in `foundry-prototype.css` |
| Permissions catalogue | add `storepilot.invoices.view` |

---

## Out of scope (phase 1)

- PDF export
- Email/SMS dispatch
- GST breakdown per line item on the image
- Pagination beyond 7-day default (search always queries all)

---

## Accessibility

- Search input: `aria-label="Search invoices by customer name or mobile"`, `role="search"`.
- Cards: `role="article"`, Share button has `aria-label="Share invoice EW-INV-…"`.
- Share fallback download link accessible via keyboard.
