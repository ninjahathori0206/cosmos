# Command Unit — mobile shell & dashboard

**Route:** `/command-unit/dashboard` (and all `/command-unit/*` pages share the same shell)

**Pencil frame (target):** `Command Unit Dashboard · /command-unit/dashboard (mobile)` — 390×844, navy sidebar off-canvas, fixed top bar with hamburger, scrollable content only.

## Goals

- Native app feel: `body.cosmos-app-shell` + `#cosmos-app-scroll` (content scroll only; topbar fixed).
- Mobile nav: hamburger opens off-canvas sidebar + dim overlay; nav tap closes drawer.
- Safe areas: `viewport-fit=cover`, modal footers respect Safari bottom inset via `--cosmos-vv-bottom`.
- Dashboard: stat cards 2×2 then 1-col; `main-side` stacks; tables horizontal scroll.

## Chrome

| Zone | Mobile behaviour |
|------|------------------|
| Sidebar | `translateX(-100%)` until `.open`; z-index 200 |
| Overlay | `#cu-sidebar-overlay` tap closes |
| Topbar | Hamburger + truncated breadcrumb; actions wrap |
| User footer | Sign-out icon beside name; **module switcher** below role ([`sidebar-module-switcher.md`](sidebar-module-switcher.md)) |

## States

- Default: sidebar hidden, dashboard scrolls inside `.cosmos-app-scroll`
- Nav open: overlay visible, body scroll locked
- Modal open: bottom sheet ≤768px; toast top offset from topbar (polish JS)

## Parity

Matches Foundry / StorePilot mobile patterns in `command-unit.css` + shared `cosmos-ui-polish`.
