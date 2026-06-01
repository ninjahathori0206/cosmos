# Store OS / POS — Live UI parity checklist

**Module:** Store OS  
**Live app:** [`POS_Prototype.html`](../../POS_Prototype.html), [`src/public/js/pos.js`](../../src/public/js/pos.js)  
**CSS:** [`src/public/css/pos.css`](../../src/public/css/pos.css), [`src/public/css/lenskart-pos.css`](../../src/public/css/lenskart-pos.css)  
**Pencil file:** [`UIX/pencil-new.pen`](../../UIX/pencil-new.pen) (Store OS artboards in monolith)  
**Artboard:** 1024×768 tablet landscape (all frames)

## Design tokens (from `pos.css`)

| Token | Value | Usage |
|-------|--------|--------|
| `--acc` / `--acc2` | `#6366f1` / `#4f46e5` | Primary buttons, links, logo gradient |
| `--pos-bg` / `--bg` | `#f8fafc` / `#f4f7fb` | Page backgrounds |
| `--card` | `#ffffff` | Cards, top bars |
| `--border` | `#e2e8f0` | Dividers, inputs |
| `--text1` | `#0f172a` | Headings |
| `--text2` | `#475569` | Body |
| `--text3` | `#64748b` | Hints, placeholders |
| `--pos-catalogue-rail-width` | `212px` | Catalogue filter rail |

Login card uses indigo gradient on logo icon and primary CTA (`linear-gradient` #6366f1 → #4f46e5).

## Screen inventory → Pencil frames

| Live HTML id | Route | Pencil frame name | Parity status |
|--------------|--------|-------------------|---------------|
| `screen-login-tablet` | `/storeos/login` | `00 Tablet login · /storeos/login` | Done (2026-05-31) |
| `screen-login-staff` | `/storeos/login/staff` | `01 Staff PIN · /storeos/login/staff` | Done |
| `overlay-pos-staff-login` | (modal on catalogue) | `01b Staff PIN modal · /storeos/login/staff` | Optional — not drawn |
| `screen-pos-catalogue` | `/storeos/catalogue` | `02 Catalogue · /storeos/catalogue` | Done |
| `screen-pos-product` | `/storeos/product` | `03 Product · /storeos/product` | Done |
| `screen-pos-order-builder` | `/storeos/cart` | `04b Cart · Cx linked · /storeos/cart` | Done |
| `screen-pos-order-builder` | `/storeos/cart` | `04 Cart · Cx empty · /storeos/cart` | Done |
| `screen-pos-customer` | `/storeos/customer` | `05 Customer picker · /storeos/customer` | Done |
| `screen-pos-lens` | `/storeos/lens-config` | `06 Lens · Type · /storeos/lens-config` | Done |
| `screen-pos-lens` | `/storeos/lens-config` | `06b Lens · Lenses · /storeos/lens-config` | Done |
| `screen-pos-lens` | `/storeos/lens-config` | `06c Lens · Rx · /storeos/lens-config` | Done |
| `screen-pos-payment` | `/storeos/payment` | `07 Payment · /storeos/payment` | Done |
| `screen-pos-confirm` | `/storeos/confirm` | `08 Confirm · /storeos/confirm` | Done |
| `screen-pos-confirm` | `/storeos/confirm` | Lab confirm variant | Optional — single confirm frame |
| `screen-pos-orders` | `/storeos/orders` | `09 Orders · /storeos/orders` | Done |

## Canvas layout (pixels)

| Row | y | Frames (x spacing ~1100) |
|-----|---|---------------------------|
| Login | -600 | Tablet login (0), Staff PIN (1100) |
| Browse | 738 | Catalogue (0), Product (1100), Cart Cx linked (2200), Cart Cx empty (3300) |
| Checkout | 1560 | Lens type (0), Lens selection (1100), Lens power+Rx (2200), Payment (3300), Confirm instant (4400), Confirm lab (5500) |
| Utils | 2428 | Orders (0), Customer picker overlay (1100) |

## Parity rules

- Copy from HTML placeholders and visible labels, not invented text
- 3-column cart: main lines (~464px) | Cx card (~268px) | Bill details + checkout (~292px)
- Catalogue: top search bar + results grid + **right** filter rail 212px
- Full 4×3 numpad on tablet and staff login
- No `type: "note"` nodes on canvas
