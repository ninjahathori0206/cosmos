# StorePilot — Day Store Report

**Route:** `/storepilot/reports`  
**Pencil frame:** `SP — Day Store Report · /storepilot/reports` (mobile 375×900, cluster with other SP frames ~x=-11890)  
**Permission:** `storepilot.reports.view`

## Purpose

Daily store snapshot for the signed-in store: invoiced sales, **product-only** bookings, product collections (cash vs bank), membership collection (cash vs bank), and memberships sold — filterable by IST calendar date, shareable as a PNG via the device share sheet.

## Metric rules (IST calendar date)

| Section | Source | Rules |
|---------|--------|--------|
| **Invoiced** | `pos_invoices` joined to orders | Sum/count invoice `total_amount` for the store on the report date |
| **Product booking** | `pos_orders` / `oe_orders` | Exclude `order_kind = 'MEMBERSHIP'`. For mixed carts, sum `total_amount - sold_membership_amount` per order |
| **Collection — products** | `pos_payments` on product orders | Exclude `order_kind = 'MEMBERSHIP'`; bank = UPI + CARD, cash = CASH |
| **Membership collection** | `pos_membership_payments` | Paid membership sales only |
| **Memberships sold** | `pos_membership_sales` + legacy product-row membership | Count of memberships sold that day |

Membership-only checkouts and membership amounts on combined orders **do not** appear in product booking or product collection.

## Layout

- **Page title:** Store reports (existing page head: Refresh, Print)
- **Card** (white, 12px radius, 3px accent top `#1D6FD4`):
  - Title + subtitle
  - **Controls row:** date input · **Generate report** (primary) · **Share** (outline, ↗)
  - Meta: `{store_name} · {DD/MM/YYYY}`
  - Tinted sections (`#F4F7FB` inner panels):
    1. Invoiced — revenue, bill count, avg invoice
    2. Product booking — product booking total, product order count, avg product booking
    3. Collection — products — total, bank (UPI+card), cash
    4. Membership collection — collected, bank, cash, memberships sold
- Empty banner (gold) when all metrics zero for the selected date

## Share flow

1. User generates report (required before share).
2. Tap **Share** → `cosmosBuildDayStoreReportCanvas(data)` → PNG → `navigator.share({ files })` or download fallback (same as invoice share).

## API

`GET /api/storepilot/reports/day-store?date=YYYY-MM-DD`

## Files

| Layer | Path |
|-------|------|
| API | `src/api/storepilotReports.js` |
| SP | `sql/sp/storepilot_day_store_report.sql` |
| Share canvas | `src/public/js/cosmos-day-store-report-share-canvas.js` |
| UI | `StorePilot_Prototype.html`, `storepilot-prototype.js`, `storepilot-theme.css` |
