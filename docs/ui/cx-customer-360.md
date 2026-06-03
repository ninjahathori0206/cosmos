# CX Customer 360 — UI specification

**Route:** `/cx/customers/:id`  
**Pencil frames:**
- Desktop: `CX — Customer 360 · /cx/customers/:id` (node `zfjWP` in `UIX/pencil-new.pen`)
- **Mobile (native app shell):** `CX Mobile — Customer 360 · /cx/customers/:id` (node `s937oV`) — 390×844
- **Mobile Visits tab:** `CX Mobile — Customer 360 Visits · /cx/customers/:id` (node `BEbxl`)  
**Shell:** [`Cx_Prototype.html`](../../Cx_Prototype.html) + [`cx-prototype.js`](../../src/public/js/cx-prototype.js)

## Purpose

Single staff view of a POS customer: identity, lifestyle, prescriptions, commerce history, membership, coins, assigned offers, and audit trail. Replaces the shallow customer detail modal.

## Navigation

- Customer list row click → `history.pushState` to `/cx/customers/{id}` (default tab: Summary).
- Breadcrumb: Customers › {name}.
- Back control returns to `/cx/customers`.

## Layout — desktop (≥1025px)

- **Header:** avatar initials, name, phone, home store, member-since, active/inactive badge.
- **Stat strip:** orders count, lifetime revenue (currency `cosmosCountUp`), live coins, pending coins.
- **Tab bar:** Summary | Profile | Lifestyle | **Visits** | Prescriptions | Orders | Invoices | Membership | Coins | Offers | Audit.

## Layout — mobile (native app, ≤1024px)

**No sidebar.** Full-screen customer detail; **same visual universe as Eyewoot Go** (`go.css` tokens: `#F7F5F2` canvas, `#5B4FE8` plus, Syne titles, DM Sans body).

| Zone | Pattern |
|------|---------|
| **Top** | **White** sticky bar (Go `topbar`): `‹` back in `#F0EDE8` square, centered **Syne** name + “Customer profile” subtitle |
| **Hero** | White card: 56px **plus** avatar, phone, store, **pill-green** Active + **pill-plus** tier |
| **Metrics** | **2×2 grid** stat cards (Orders, Revenue, Coins, Pending) — not horizontal scroll |
| **Primary nav** | Segmented control on `#F0EDE8` track; active tab **#5B4FE8** fill (Go plus, not CX purple `#7C3AED`) |
| **Body** | **Grouped list cards** (16px radius): section labels in caps (`MEMBERSHIP`, `RECENT VISIT`), rows with title + subtitle + `›` chevron, 16px row padding |
| **Visits (tab)** | Full-width **visit cards** (not table): date/time, store, purpose, status colour, wait — stack vertically |
| **Actions** | Sticky bottom pair: primary full-width buttons (Grant membership, Adjust coins) with `padding-bottom: env(safe-area-inset-bottom)` |

### Mobile `More` sheet tabs

Profile, Lifestyle, Prescriptions, Invoices, Membership, Coins, Offers, Audit — bottom sheet or full-screen picker (v1: simple overlay list).

### Mobile implementation notes (`cx-prototype.js`)

- Route: `/cx/customers/:id` and `/cx/customers/:id/:tab?`
- `cxIsMobileLayout()` → render `#page-customer-360-mobile` not desktop tab table
- Hide CX sidebar on 360 mobile; use `history.back()` on `‹`
- `cosmosSkeletonRows` for list groups; `cosmosToast*` only
- Visits tab: card list from `GET .../visits`, no `<table>`

## Tabs

| Tab | Data source | RBAC |
|-----|-------------|------|
| Summary | `GET /api/cx/customers/:id/360` + membership card | `cx.customers.view` |
| Profile | `GET/PUT .../profile` | view / `cx.customers.edit` |
| Lifestyle | `GET/PUT .../lifestyle` | view / `cx.customers.edit` |
| Visits | `GET .../visits` — GatePass `store_visitors` by `customer_id` + phone match | `cx.customers.view` |
| Prescriptions | `GET .../prescriptions` | `cx.customers.view` |
| Orders | `GET .../orders` | `cx.customers.view` |
| Invoices | `GET .../invoices` | `cx.customers.view` |
| Membership | existing `GET .../membership` + grant/buddy actions | `cx.membership.manage` |
| Coins | `GET .../coins`; manual adjust `POST .../coins/manual` | view / `cx.coins.manual` |
| Offers | `GET .../offers-assignments`; assign/revoke | `cx.offers.manage` |
| Audit | `GET .../audit` | `cx.audit.view` or `cx.admin` |

### Visits tab (GatePass history)

- **Table columns:** Check-in (IST), Store, Purpose, Status, Wait, Checkout, Channel.
- **Row style:** `.tr-link` (read-only v1; no navigation).
- **Empty state:** headline “No store visits yet”, subtext “Visits appear when this customer checks in via GatePass at any store.”
- **API:** `GET /api/cx/customers/:id/visits` — `store_visitors` where `customer_id` matches or `phone` matches central `pos_customers` row.
- **Summary (optional):** `visit_count` on `GET .../360` header payload.

## States

- **Loading:** `cosmosSkeleton*` per tab (never raw “Loading…”).
- **Empty:** headline + subtext + action where applicable (`ui-polish-rules.mdc`).
- **Errors:** `cosmosToastError` for API failures.

## Pencil approval

HTML implementation starts **after** frame approval in `UIX/pencil-new.pen`. Backend (Track A) may proceed in parallel.

## Out of scope (this spec)

- Rewriting global offers catalog (still Command Unit).
- POS cart layout changes (redemption gate only when engine v2 on).
