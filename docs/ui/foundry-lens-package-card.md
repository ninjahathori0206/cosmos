# Foundry — Lens package card (POS Lenses step)

## Purpose

HQ configures how each **lens package** appears on the Store OS checkout **Lenses** step (package picker cards). Title and selling price already come from POS Brand, POS Name, and Price; this spec adds marketing copy and optional warranty for the card body.

## Pencil

- **Foundry admin:** frame `FD — Lens config · Packages · /foundry/lens-packages` (`Dy6bb`), node `detail` (`L0sUq0`) — Package detail panel.
- **POS reference:** `Order Creation - Lens Selection · /storeos/lens-config` (`me1ef1192fd`) — `lensCard1` / `lensCard2`.

## Foundry fields (Package detail)

| Field | DB column | Max | POS use |
|-------|-----------|-----|---------|
| POS Brand | `pos_brand` | 100 | Card title (with POS Name); brand filter chips |
| POS Name | `pos_name` | 100 | Card title (required) |
| Internal brand / name | `internal_*` | 100 | Foundry only |
| Price (₹) | `price` | — | Card selling price |
| Sort / Active | `sort_order`, `is_active` | — | List order; hide when inactive |
| **Feature line 1** | `card_feat_line1` | 250 | Grey bullet line on card; omit if empty |
| **Feature line 2** | `card_feat_line2` | 250 | Second line; omit if empty |
| **Warranty label** | `card_warranty_label` | 40 | Pill under thumb, e.g. `1Y warranty`; hidden if empty |
| **Warranty tone** | `card_warranty_tone` | 1–5 | Pill colour (same palette as category wizard tones) |

**Not in v1:** compare-at / strikethrough MRP, thumb image, `Frame + Lens` caption (fixed in POS).

## POS card layout (unchanged structure)

```
[ thumb 👓 ] [ title: POS Brand · POS Name ]
[ warranty ] [ feat line 1, feat line 2 ]     [ Frame + Lens ]
                                              [ ₹ price ]
```

## Empty / legacy states

- Both feature lines empty → no feature block.
- Warranty label empty → no warranty pill.
- Null DB columns (pre-migration rows) → same as empty; no hardcoded fallback bullets or fake MRP.

## API

- Admin: `GET/POST/PUT /api/foundry/lens-config/packages` — includes card fields.
- Store OS: `GET /api/pos/lens-catalog` — packages in `categories[].packages[]` include card fields.

## RBAC

Existing `foundry.catalogue.view` / `foundry.catalogue.edit`; no new permission keys.
