# Store OS — Cart page (`/storeos/cart`)

## Purpose

Tablet-landscape cart / order builder: review line items, link a Cx, apply offers, and proceed to checkout.

## Pencil frames

| Frame | Route | State |
|-------|-------|--------|
| `Store OS Cart · /storeos/cart · Cx linked` | `/storeos/cart` | Cx selected, offer applied, coins visible |
| `Store OS Cart · /storeos/cart · Cx empty` | `/storeos/cart` | No Cx — amber required card, no offer chip |

Legacy: `Order Creation - Cart (legacy) · /pos/order` (superseded).

## Layout (optimised 3-column)

1. **Left (flex)** — Toolbar (`‹ Back` + `Cart · N items`) → scrollable item cards → `+ Add another product`
2. **Mid (268px)** — Single **Cx** card only (no duplicate offers rail)
3. **Right (292px)** — Bill Details summary → Apply Coupon → Offer applied (when set) → Insurance → Proceed → Save draft

## Cx card states

- **Empty:** amber border, “Cx required at checkout”, primary **Select Cx**
- **Linked:** name, mobile, coins pill, Cx ID, **Change Cx** + **Clear Cx**

## Optimisations vs legacy Pencil / app

- Toolbar above items (not below)
- Removed mid-column Offers card (coupons live in right rail only)
- Single Cx action row aligned with live app (Change + Clear)
- Tighter item cards: thumb + metadata + fulfillment chip + line total
- **Line card spacing (May 2026):** 6px copy rhythm, dashed divider 6px/2px margins, total row directly below unit input, footer meta with top border (Frame only / With lenses)
- Offer-applied chip uses green surface on bill rail

## Implementation

**Implemented** — `POS_Prototype.html`, `src/public/css/lenskart-pos.css`, `src/public/js/pos.js` aligned to approved Pencil frames (May 2026).
