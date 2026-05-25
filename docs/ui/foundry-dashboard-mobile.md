# Foundry Dashboard — native mobile layout

**Route:** `/foundry/dashboard`  
**Pencil frame:** `Foundry Dashboard · /foundry/dashboard (mobile)` — 390×844 — node `0RJs9v129S3D2WBREfZd5`  
**Shell parity:** [`command-unit-mobile.md`](command-unit-mobile.md), [`cosmos-mobile-chrome.md`](cosmos-mobile-chrome.md)

## Problem (current mobile)

- Stat grid is 2×2 but cards feel desktop-cramped; no quick actions.
- **Recent Purchases**, **Low Stock**, and **Pipeline** use wide tables with horizontal scroll — not native-app feel.
- Recent Purchases / Pipeline never populate in JS (stuck on “Loading…”).
- Page title duplicates breadcrumb; no mobile-specific section rhythm or safe-area bottom padding.

## Goals — native app feel

| Zone | Mobile behaviour |
|------|------------------|
| Chrome | Existing `cosmos-app-shell` + hamburger + fixed topbar (no change) |
| Hero | Compact greeting row: “Good morning, {name}” + IST date; subtitle “Procurement overview” |
| Stats | 2×2 tap-friendly cards, 14px padding, accent top bar, count-up numbers |
| Quick actions | Horizontal scroll chips: **+ New Purchase**, **Bill Verify**, **Goods Request**, **Lab Orders** (RBAC-gated) |
| Recent purchases | **Card list** (not table): ID, brand line, qty, stage badge, chevron — max 5, “View all” |
| Low stock | **Compact alert cards**: SKU mono, product name, qty pill (red/gold), threshold |
| Pipeline | **Stage-grouped cards** or stacked cards with purchase ID, supplier, days open, stage badge — max 8 active |
| Empty states | Headline + subtext + action per [`ui-polish-rules.mdc`](../../.cursor/rules/ui-polish-rules.mdc) |
| Loading | `cosmosSkeletonCards` / `cosmosSkeletonRows` — no raw “Loading…” |

## Layout sketch (390px)

```
┌─────────────────────────────┐
│ ☰  Foundry › Dashboard      │  ← fixed topbar
├─────────────────────────────┤
│ Good morning, Lukman        │
│ Mon 25 May · Overview       │
│                             │
│ ┌──────────┐ ┌──────────┐   │
│ │ Active   │ │ SKUs     │   │  2×2 stats
│ │ Purchases│ │ Catalogue│   │
│ └──────────┘ └──────────┘   │
│ ┌──────────┐ ┌──────────┐   │
│ │ Warehouse│ │ Suppliers│   │
│ └──────────┘ └──────────┘   │
│                             │
│ [+ New Purchase][Bill Verify]…│  scroll chips
│                             │
│ Recent Purchases    View all│
│ ┌─────────────────────────┐ │
│ │ #142 · IKON Classic     │ │
│ │ 24 pcs · Pending bill  ›│ │
│ └─────────────────────────┘ │
│                             │
│ Low Stock Alerts      3 SKUs│
│ ┌─────────────────────────┐ │
│ │ EW-SKU-001 · Ray frame  │ │
│ │ Qty 2 · threshold 5     │ │
│ └─────────────────────────┘ │
│                             │
│ Pipeline — Active           │
│ ┌─────────────────────────┐ │
│ │ #138 · Gandhi · 12 days │ │
│ │ Pending digitisation   ›│ │
│ └─────────────────────────┘ │
│         (safe area)         │
└─────────────────────────────┘
```

## States

| State | Behaviour |
|-------|-----------|
| Default | Scroll inside `#cosmos-app-scroll` only |
| Loading | Skeleton stat grid + 3 skeleton list rows per section |
| Empty recent | “No purchases yet” + **+ New Purchase** (if permitted) |
| Empty pipeline | “No active pipeline items” + link to Purchases |
| Error | `cosmosToastError` on fetch failure; sections show last good data or empty |

## Data / API (no schema change)

- Stats: existing `GET /api/purchases/dashboard-stats`
- Low stock: existing `GET /api/stock-transfers/available` (filter qty ≤ threshold)
- Recent + pipeline: `GET /api/purchases?` — active non-terminal stages, sort by `header_id` desc, slice for mobile

## Implementation files (after approval)

- `Foundry_Prototype.html` — mobile card containers alongside desktop tables (show/hide via CSS)
- `src/public/css/foundry-prototype.css` — `#page-dashboard` mobile block ≤768px
- `src/public/js/foundry-prototype.js` — `loadDashboard()` renders both table (desktop) and card (mobile) targets; wire missing data

## Accessibility

- Quick-action chips: `min-height: 44px`, `touch-action: manipulation`
- Card rows: `.tr-link` + keyboard focus ring
- Stage badges: existing `.b` colour tokens only (`var(--*)`)

## Out of scope

- PWA install prompt, pull-to-refresh gesture, bottom tab bar (Foundry keeps sidebar nav)
- Other Foundry pages (Purchases list, New Purchase) — separate passes if needed
