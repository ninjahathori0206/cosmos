# CX — iOS shell navigation

**Live:** [`Cx_Prototype.html`](../../Cx_Prototype.html) · routes `/cx/*`  
**Pencil frames:** `CX Topnav Desktop · /cx`, `CX Bottom Tabs Mobile · /cx` in [`UIX/pencil-new.pen`](../../UIX/pencil-new.pen)  
**Reference:** StorePilot iOS shell (same layout; CX uses purple active accent)

## Shell

| Breakpoint | Chrome |
|------------|--------|
| Desktop (≥769px) | Fixed white top bar: wordmark **CX**, 4 tabs, user avatar + name + sign-out, `#cosmos-module-switch-footer` in user cluster |
| Mobile (≤768px) | Compact title bar (`#cx-bc`); bottom tab bar (4 tabs); no sidebar, no hamburger |

**Background:** `#F2F2F7` (iOS grouped) on shell; page content may use CX `--bg` (`#F5F3FF`).

**Active tab colour:** `var(--acc2)` (`#8B5CF6`) via `body.cosmos-shell-cx`.

## Tabs (RBAC)

| `data-cx-page` | Label | Permission |
|----------------|-------|------------|
| `dashboard` | Dashboard | `cx.dashboard.view` |
| `customers` | Customers | `cx.customers.view` |
| `offers` | Customer Offers | `cx.offers.view` or `cx.offers.manage` |
| `settings` | CX Settings | `cx.customers.view` + `cx.admin` (hidden by default) |

No **More** sheet — four items fit on mobile bottom bar.

## Icons (inline SVG, `currentColor`)

- Dashboard — 2×2 grid  
- Customers — dual user silhouettes  
- Offers — gift box  
- Settings — gear  

## Customer 360 (`/cx/customers/:id`)

Not a tab. Deep link from Customers.

- **Mobile:** Hide shared top nav + bottom tabs; existing `cx360-mob-nav` + `#cx-bc` title when needed  
- **Desktop:** Top nav remains; in-page `cx360-bc` back control to Customers  

## Copy

No static `.ps` instructional subtitles on list pages. Empty states: headline only (no “how to” subtext).

## Shared CSS

[`src/public/css/cosmos-ios-shell.css`](../../src/public/css/cosmos-ios-shell.css) — `.cosmos-topnav`, `.cosmos-tab`, `.cosmos-bottom-tabs`, `.cosmos-btab`, optional `.cosmos-more-sheet` (unused on CX).
