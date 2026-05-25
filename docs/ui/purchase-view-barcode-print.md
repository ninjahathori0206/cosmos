# Purchase View — barcode print (multi-select)

**Route:** `/foundry/purchase-view` (pipeline stages 4 and 5)  
**Modal:** `#modal-barcode-print` — existing print labels UI  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `openBarcodeModal`, `pvPrint*`

## Purpose

On **Purchase View**, operators can print barcode/QR labels for purchase SKUs without opening the full list every time:

| Action | Where | Behaviour |
|--------|-------|-----------|
| **Print selected** | Card header | Opens modal for **checked** SKUs only |
| **Print all** | Card header | Opens modal for all purchase SKUs |

Stages: **4 — Digitisation** (Generated SKUs table) and **5 — Warehouse** (SKU Details table).

## Table UI

- Checkbox column + header “select all”
- **Print selected** disabled until at least one row is checked

## Modal behaviour

- **SKU selection happens upstream** on Purchase View (or warehouse publish passes the full SKU list).
- The modal has **no unit list, checkboxes, or quantity controls** — full batch prints from upstream SKU selection.
- **Label format** dropdown loads org-wide presets (`GET /api/meta/label-print-formats`) — e.g. small 15×15 mm vs large 40×28 mm; editable with `foundry.label_formats.edit`.
- Preview panel shows label layout and batch counts (labels · units · SKUs).
- **One unique label per unit**; legacy SKUs without unit rows print `quantity` labels from stock (fixed, not editable).
- `_bcExpandSkusWithUnits` fetches units via `GET /api/skus/:skuId/units` when needed.
- Empty upstream selection → `cosmosToastWarn`.

## Out of scope

SKU Catalogue, live Digitisation working page, backend/API changes.
