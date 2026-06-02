# GatePass Phase 1 — Store OS integration

## Purpose

Live visitor queue per store: staff check-in, search/select visitors via shared `cosmos-cx-search`, and a sidebar widget on Store OS. **Visitors are store-scoped** (`store_visitors.store_id`); **Cx is central** (`pos_customers` by phone). On check-in/search, matching mobile auto-links `customer_id` (migration 85). Phase 1 maps PRD `cx_id` → Cosmos `customer_id` on `pos_customers`.

## Pencil frames

| Frame | Route / context | State |
|-------|-----------------|--------|
| `Store OS — cosmos-cx-search dropdown · embedded` | Customer picker / any CX input | In-store + exited (24h) sections open on focus |
| `Store OS — Check In panel · modal` | Top nav Check In | Name, purpose, notes; phone via search |
| `Store OS — Visitor queue widget · sidebar` | Store OS sidebar | Active queue, action sheet on row tap |

## cosmos-cx-search (global component)

### Sections

1. **In store now** — `waiting` / `in_service`, longest wait first, max 20
2. **Last exited (24h)** — `completed` in rolling 24h IST, max 5
3. **Cx profiles** — when input is a full **10-digit** phone and staff has `pos.customers.view`: parallel `GET /api/pos/customer-search?q=`; badge **Cx profile**, right column **Not in store**. Always shown **alongside** visitor rows when the central Cx phone matches (even if an exited visitor shares the phone — pick **Cx profile** for the registered billing name).

### Row layout (3-column strip)

| Column | Content |
|--------|---------|
| Left | Name (13px semibold); phone (11px tertiary) + status dot (green = `customer_id` set, amber = null) |
| Centre | Purpose badge pill (from meta catalog) |
| Right | In-store: wait minutes (amber if > 20); exited: relative time |

### Behaviours

- Focus with 0 digits → dropdown opens, both visitor sections unfiltered
- Typing → live filter, 150ms debounce, digit highlight
- **10 digits**, no visitor match, Cx exists → Section 3 shows `pos_customers` row(s); select → **link cart + staff check-in** (`POST /api/gatepass/checkin`, then `in_service` if permitted)
- **10 digits**, no visitor match, no Cx → **Check in as new visitor** → opens check-in panel
- Select in-store visitor + linked customer → load CX from `customer-search`, attach to bill, set `in_service`
- Select in-store visitor, phone not in central Cx → Quick Cx registration entry point
- Escape / click outside → close, retain input value

### Loading / error

- Skeleton rows before fetch (`cosmosSkeletonRows`)
- API errors → `cosmosToastError`

## Staff check-in panel

- Trigger: top nav **Check In** or widget / search “new visitor” row
- Fields: phone (via search or direct), name (required), purpose (optional dropdown from meta), notes (optional)
- Submit → `POST /api/gatepass/checkin`; button uses `cosmosBtnLoading` / `cosmosBtnSuccess`
- Duplicate active visitor → show existing card, no second row
- Same-day return → reopen row (`waiting`, new `checkin_at`)

## Live visitor widget (sidebar)

- Embedded below nav in `#pos-sidebar`
- Poll `GET /api/gatepass/queue/:storeId` every 30s
- Row tap → action sheet: **Select**, **Mark In-Service**, **Close Visit**
- Empty: headline + subtext + **Check In** action
- Gated: `gatepass.view` / `gatepass.action`

## Accessibility

- Search input `aria-expanded`, listbox roles on dropdown
- Modal `role="dialog"`, focus trap, dismiss on Escape
- Action sheet buttons with clear `aria-label`

## Implementation files

- `src/public/js/cosmos-cx-search.js`, `src/public/css/cosmos-cx-search.css`
- `POS_Prototype.html`, `src/public/js/pos.js`, `src/public/css/lenskart-pos.css`
- `src/api/gatepass.js`, `sql/migrations/84_gatepass_phase1.sql`

## Deferred (Phase 2+)

- Public self check-in PWA, QR, CX link SP, GatePass module page, StorePilot embed, auto-expiry job
