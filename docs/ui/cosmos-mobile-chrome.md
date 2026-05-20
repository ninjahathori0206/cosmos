# Cosmos mobile chrome — safe modals and top toasts

Applies to all modules that load [`cosmos-ui-polish.css`](../../src/public/css/cosmos-ui-polish.css) and [`cosmos-ui-polish.js`](../../src/public/js/cosmos-ui-polish.js).

## Problem

Mobile browsers (especially iOS Safari) show a floating bottom toolbar that overlaps fixed UI at the bottom of the viewport. `100vh` is taller than the visible area.

## Solution

### Dynamic viewport (`cosmos-ui-polish.js`)

- `--cosmos-vvh` — visible height from `visualViewport` (fallback `100dvh`).
- `--cosmos-vv-bottom` — gap between layout bottom and visible bottom (Safari toolbar).

### Modals (≤768px)

- Overlays align as **bottom sheets**; modal `max-height` uses `min(92dvh, 92vh, 92% of --cosmos-vvh)`.
- Modal body scrolls; footers use safe-area + `--cosmos-vv-bottom`.
- Bucket scan reference: [`cosmos-bucket-scan.md`](cosmos-bucket-scan.md).

### Toasts

- `#cosmos-toast-container` is anchored to **`top: var(--cosmos-toast-top)`**, not the footer.
- `cosmosUpdateToastTopOffset()` measures `.topbar` (page) or `.overlay.open .mh` / `.modal-head` (modal) and updates on resize, orientation, overlay open/close.

### Viewport meta

Shell HTML should include `viewport-fit=cover` so `env(safe-area-inset-*)` works.

## Native app scroll shell (ERP prototypes)

Foundry, StorePilot, Finance, CX, and Command Unit use a **single scroll region** (Command Unit also uses hamburger + off-canvas sidebar on ≤768px — see [`command-unit-mobile.md`](command-unit-mobile.md)) so the topbar (and CX `.cx-mob-bar`) stay fixed while only page content scrolls — similar to a native app.

### Markup

- `<body class="cosmos-app-shell">`
- Inside `<main class="main">`, after `.topbar` / `.cx-mob-bar`:
  - `<div class="cosmos-app-scroll" id="cosmos-app-scroll">` … all `.page` blocks … `</div>`
- Modals stay **outside** `.cosmos-app-scroll` (StorePilot: close the wrapper before in-main overlays such as handover; other shells: before `</main>`).

### CSS / JS

- [`cosmos-ui-polish.css`](../../src/public/css/cosmos-ui-polish.css) — `body.cosmos-app-shell`, `.cosmos-app-scroll`, `.main { overflow: hidden }`
- [`cosmos-ui-polish.js`](../../src/public/js/cosmos-ui-polish.js) — `cosmosResetAppScroll()`, `cosmosLockAppBodyScroll()`, MutationObserver on `.page.active`
- Module CSS: [`foundry-prototype.css`](../../src/public/css/foundry-prototype.css), [`command-unit.css`](../../src/public/css/command-unit.css)
- Load polish **after** inline `<style>` on prototypes that override `.main` overflow.

### Sidebar

`openSidebar` / `closeSidebar` in Foundry and StorePilot call `cosmosLockAppBodyScroll()` so `body` stays `overflow: hidden` when the shell is active.

Cache-bust polish assets with `?v=20260522-app-scroll` (or newer) on prototype HTML.

## Out of scope

Eyewoot Go ([`go.css`](../../src/public/css/go.css)) uses its own bottom `.go-toast-wrap`. POS ([`POS_Prototype.html`](../../POS_Prototype.html)) uses a separate layout; full scroll shell not applied there unless extended.
