# Store OS — Reader power variant (2-layer: Colour × Power)

## Purpose

**Readers** (`product_type = READERS`) are sold **power-wise**: each SKU is a unique **colour + reading power** pair (e.g. Black · +1.50). POS must let staff pick **colour first**, then **power**, before add-to-cart — mirroring how stock is held per SKU.

Non-reader products are unchanged (colour-only variants).

## Pencil frames

| Frame | Route | State |
|-------|-------|--------|
| `Store OS Product · /storeos/product/:id · Readers` | `/storeos/product/:productId/:skuId` | Colour swatches + power pill strip |
| `Store OS Catalogue · Readers card` | `/storeos/catalogue` | Colour swatches + `N colours · M powers` badge |
| `Store OS Cart · Reader line` | `/storeos/cart` | Chip: `Black · +1.50` |

## User flow

1. **Catalogue** — Reader card shows colour swatches (deduped by colour name). Badge: `3 colours · 13 powers`. Card click opens PDP with first in-stock colour + power.
2. **PDP** — **COLOUR** block (existing swatches, deduped). **POWER** block appears below when product is READERS and a colour is selected. Horizontal pills: `+1.00` … `+4.00`; OOS pills disabled/greyed; active pill highlighted.
3. **Selection** — Changing colour keeps current power when that combo exists; else first in-stock power for that colour. `selectedProductId` remains `[product_id, sku_id]`.
4. **Add to cart** — Requires in-stock colour **and** power. Cart line chip shows `Colour · Power`.

## States

| State | Behaviour |
|-------|-----------|
| Default | First in-stock colour; first in-stock power for that colour |
| Single colour | Colour block hidden if only one colour; power block still shown for readers |
| OOS power | Pill `.pos-pdp-power-pill--oos`; toast on tap |
| Non-reader | No power block; existing colour-only flow |

## Copy

- Power label: **POWER**
- Power selected hint (aria-live): e.g. `+1.50 selected`
- OOS toast: `This power is not available at this store.`
- Catalogue badge: `{n} colours · {m} powers`

## Accessibility

- Power pills: `role="group"` / `role="button"`, `tabindex="0"`, `aria-label="+1.50 selected"` / `+2.00 — out of stock at this store`
- Colour block unchanged

## Data contract

Catalogue API `product.colours[]` entries include `power` (from `skus.reading_power`, null for non-readers).

Standard powers (SSOT): `src/config/readingPowersCatalog.js` — `+1.00` through `+4.00` in 0.25 steps.

## Implementation

**Pencil:** Design intent captured in this spec; Pencil MCP unavailable in session — implementation follows spec directly per user execute request.

**Code:** `POS_Prototype.html`, `src/public/js/pos.js`, `src/public/css/lenskart-pos.css`, `Foundry_Prototype.html`, `src/public/js/foundry-prototype.js`, DB/API per plan.
