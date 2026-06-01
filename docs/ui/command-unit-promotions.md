# Command Unit — Membership & promotions (priority screens)

**Module:** Command Unit  
**Live app:** `src/public/command-unit.html`, `src/public/js/command-unit-prototype.js`  
**Pencil file:** `UIX/pencil-new.pen` (CU frames — search `CU —`)  
**Artboard:** **1280×800** desktop admin (sidebar + main)

## Routes (`COMMAND_UNIT_PAGE_PATHS`)

| Page key | Route | Pencil frame name |
|----------|--------|-------------------|
| `membership-plans` | `/command-unit/membership-plans` | `CU — Membership Plans · /command-unit/settings/membership-plans` |
| (modal) | same | `CU — Membership Plans · New Plan Modal · /command-unit/settings/membership-plans` |
| `promotion` | `/command-unit/promotion` | `CU — Customer Offers · /command-unit/promotions/offers` |
| (modal) | same | `CU — Create Offer Modal · /command-unit/promotions/offers` |

Note: JS map uses `membership-plans` and `promotion` keys; URLs above match historical Pencil names.

## Layout pattern (from implementation)

- **Sidebar:** dark `#1E293B`, module nav, Command Unit branding
- **Main:** white content, page title, filters/actions row, data table or cards
- **Modals:** full-viewport dim `#0000004D`, centered white shell, form sections

## Membership Plans screen

- Table: plan name, duration, price, benefits summary, active toggle, actions
- Primary: “+ New Plan”
- Empty state: headline + subtext + create button

## New Plan Modal

- Fields: name, code, duration, price, description, benefit bullets, active flag
- Footer: Cancel (secondary) + Save (primary)

## Customer Offers screen

- Table: offer name, type, validity, stores, status
- Filters: status, store scope
- Primary: “+ Create Offer”

## Create Offer Modal

- Multi-section form: basics, eligibility, discount rules, date range, store assignment
- Footer actions aligned with `cosmosBtn*` patterns in app

## Additional CU pages (future frames)

Full nav from `COMMAND_UNIT_PAGE_PATHS`: dashboard, stores, users, roles, tablets, label-templates, audit, etc. Add separate `.pen` pages or frames only when designing those flows.

## Canvas layout

Place 4 priority frames at x=0, 1400, 2800, 4200 (y=0), width 1280, height 800; modals can overlap at same x with dim overlay.
