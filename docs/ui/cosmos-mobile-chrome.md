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

## Out of scope

Eyewoot Go ([`go.css`](../../src/public/css/go.css)) uses its own bottom `.go-toast-wrap`.
