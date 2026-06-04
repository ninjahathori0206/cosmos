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
- **10 digits**, no visitor match, Cx exists → Cx profile bubble; select → fills check-in form (no cart navigation)
- **10 digits**, no visitor match, no Cx → **Create Cx** bubble in check-in search → quick registration (read-only mobile, editable name)
- **FAB panel:** tap visitor bubble → **apply to cart** immediately (link Cx if on file, else cart shows visitor + **Select Cx** + **Create Cx**); highlight + Selected strip + **Clear**; **no** visitor action sheet
- **Create Cx** (cart or picker banner) opens the **Visitor Create Cx** focused picker sheet — not the full **Find Cx** search UI
- Does **not** navigate to `/storeos/order` on bubble tap — updates cart Cx column in place
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

## Lens wizard — Cx step (FAB-first)

**Route:** `/storeos/lens-config` (Add Lens Details) · checkout stage **Cx** (`lensWizard.step === 2`, profile sub-phase).

| Surface | Role |
|---------|------|
| **GatePass FAB** (bottom right) | Today’s visitors — tap bubble applies visitor to **cart Cx**; lens step shows visitor **Shopping for** card (linked Cx uses unified **Who is this pair for?** chips instead) |
| **Change → search** (`#pos-lk-cust-input`) | **Cx profiles only** (`cosmos-cx-search` `queueMode: 'cx-only'`) — no IN STORE / EXITED sections |
| **+ Check In** on FAB | New visitor check-in (not in lens search dropdown) |

Visitor without central Cx: same as cart — visitor pending + **Create Cx** (focused picker); not the lens “Customer not found” modal.

## Live visitor widget (sidebar)

- Embedded below nav in `#pos-sidebar`
- Poll `GET /api/gatepass/queue/:storeId` every 30s
- FAB: tap bubble → apply visitor to cart Cx column; **+ Check In** in footer; **Clear** on Selected strip
- FAB panel auto-closes after **3 seconds** of no pointer/keyboard/scroll activity on the widget
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

## Roadmap (see `gatepass-roadmap.md`)

| Phase | Status |
|-------|--------|
| 3 — SP Visitors page, assign staff, expiry job, CU VMS | Done |
| 4 — SP sidebar widget, `cosmos-cx-search` embed | Done |
| 5 — Self check-in via **Eyewoot Go** (not standalone PWA) | Last |
