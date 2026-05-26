# Purchase View — barcode print (multi-select)

**Route:** `/foundry/purchase-view` (pipeline stages 4 and 5)  
**Modal:** `#modal-barcode-print` — existing print labels UI  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `openBarcodeModal`, `pvPrint*`

## Purpose

On **Purchase View**, operators can print barcode/QR labels for purchase SKUs without opening the full list every time:

| Action | Where | Behaviour |
|--------|-------|-----------|
| **Print labels (selected)** | Card header | Opens modal for **checked** SKUs only |
| **Print all labels** | Card header | Opens modal for all purchase SKUs |

Stages: **4 — Digitisation** (Generated SKUs table) and **5 — Warehouse** (SKU Details table).

## Table UI

- Checkbox column + header “select all”
- **Print labels (selected)** disabled until at least one row is checked

## Modal behaviour

Operator-first UI: numbered steps, plain **Choose label type** dropdown, job summary (“X labels will be printed”), **Print now** / **Connect label printer**. Technical TSPL controls are under **Show advanced printer settings**.

- **SKU selection happens upstream** on Purchase View (or warehouse publish passes the full SKU list).
- The modal has **no unit list, checkboxes, or quantity controls** — full batch prints from upstream SKU selection.
- **Label type** dropdown loads org-wide presets (`GET /api/meta/label-print-formats`) with friendly names; editable with `foundry.label_formats.edit`.
- Operator guide: [`label-print-trigger.md`](label-print-trigger.md).
- Preview panel shows label layout and batch counts (labels · units · SKUs).
- **One unique label per unit**; legacy SKUs without unit rows print `quantity` labels from stock (fixed, not editable).
- `_bcExpandSkusWithUnits` fetches units via `GET /api/skus/:skuId/units` when needed.
- Empty upstream selection → `cosmosToastWarn`.

## Out of scope

SKU Catalogue, live Digitisation working page, backend/API changes.
