# Store OS — Cart page (`/storeos/cart`)

## Purpose

Tablet-landscape cart / order builder: review line items, link a Cx, apply offers, and proceed to checkout.

## Pencil frames

| Frame | Route | State |
|-------|-------|--------|
| `Store OS Cart · /storeos/cart · Cx linked` | `/storeos/cart` | Cx selected, offer applied, coins visible |
| `Store OS Cart · /storeos/cart · Cx empty` | `/storeos/cart` | No Cx — amber required card, no offer chip |
| `Store OS Cart · /storeos/cart · Lab line configured` | `/storeos/cart` | LAB line with lens package, patient row, **Edit lenses & power →** footer |

Legacy: `Order Creation - Cart (legacy) · /pos/order` (superseded).

## Layout (optimised 3-column)

1. **Left (flex)** — Toolbar (`‹ Back` + `Cart · N items`) → scrollable item cards → `+ Add another product`
2. **Mid (268px)** — Single **Cx** card only (no duplicate offers rail)
3. **Right (292px)** — Bill Details summary → Apply Coupon → Offer applied (when set) → Insurance → Proceed → Save draft

## Cx card states

- **Empty:** amber border, “Cx required at checkout”, primary **Select Cx**
- **Linked (minimal):** name, **phone · ID** on one line, optional coins line; footer actions are text links only — **Change · Buddies (n/m) · Clear** (no bordered button row). Empty state keeps a single **Select Cx** CTA.

## Optimisations vs legacy Pencil / app

- Toolbar above items (not below)
- Removed mid-column Offers card (coupons live in right rail only)
- Single Cx action row aligned with live app (Change + Clear)
- Tighter item cards: thumb + metadata + fulfillment chip + line total
- **Line card spacing (May 2026):** 6px copy rhythm, dashed divider 6px/2px margins, total row directly below unit input, footer meta with top border (**Select lenses →** when lens setup pending)
- **Lab line patient row (Jun 2026):** when `patient_name` on a LAB line differs from linked primary Cx, show muted **`For · {name}`** chip (`.pos-lk-cart-patient-row`) after product tags, before lens status / package rows
- **Configured lab line (Jun 2026):** when LAB line has `lens_bundle`, one mint **lab breakdown** panel (`.pos-lk-cart-lab-breakdown`): spec, single power status, **Lens** price — no dashed divider below the panel, no duplicate rx foot. Footer **Edit lenses & power** is a centered text link with SVG chevron (`.pos-lk-cart-edit-link`). **Select lenses** / **Add lenses** use the same chevron pattern. Lines **without** bundle keep **Lens · pending setup** and **Select lenses**.
- **Cart actions stack:** `+ Add another product` and **+ Lenses on customer frame** share 10px vertical gap (`.pos-ob-section--cart-actions`).
- **DUAL eyeglasses (Jun 2026):** lines added as **INSTANT** pickup may still show **Add lenses →** and a pending lens hint until staff runs the wizard (frame-only choice hides the CTA).
- **Customer-owned frame:** [`pos-customer-frame-lens.md`](pos-customer-frame-lens.md) — **+ Lenses on customer frame**, required frame photo on lens Step 2, lab handover thumbnail.
- Offer-applied chip uses green surface on bill rail

## Implementation

**Implemented** — `POS_Prototype.html`, `src/public/css/lenskart-pos.css`, `src/public/js/pos.js` aligned to approved Pencil frames (May 2026). Lab line **Edit lenses & power →** (Jun 2026).
