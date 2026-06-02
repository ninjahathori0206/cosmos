# StorePilot — Day Store Report

**Route:** `/storepilot/reports`  
**Pencil frame:** `SP — Day Store Report · /storepilot/reports` (mobile 375×900, cluster with other SP frames ~x=-11890)  
**Permission:** `storepilot.reports.view`

## Purpose

Daily store snapshot for the signed-in store: invoiced sales, bookings, collections (cash vs bank), and memberships sold — filterable by IST calendar date, shareable as a PNG via the device share sheet.

## Layout

- **Page title:** Store reports (existing page head: Refresh, Print)
- **Card** (white, 12px radius, 3px accent top `#1D6FD4`):
  - Title + subtitle
  - **Controls row:** date input · **Generate report** (primary) · **Share** (outline, ↗)
  - Meta: `{store_name} · {DD/MM/YYYY}`
  - Four tinted sections (`#F4F7FB` inner panels):
    1. Invoiced — revenue, bill count, avg invoice
    2. Booking — booking total, order count, avg booking
    3. Collection — total, bank (UPI+card), cash
    4. Membership — total sold count
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
