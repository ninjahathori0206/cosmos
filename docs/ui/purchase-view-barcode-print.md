# Purchase View — barcode print (multi-select)

**Route:** `/foundry/purchase-view` (pipeline stages 4 and 5)  
**Modal:** `#modal-barcode-print` — existing print labels UI  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `openBarcodeModal`, `pvPrint*`

## Purpose

On **Purchase View**, operators can print barcode/QR labels for purchase SKUs without opening the full list every time:

| Action | Where | Behaviour |
|--------|-------|-----------|
| **Print selected** | Card header | Opens modal for **checked** SKUs only |
| **Print all** | Card header | Opens modal for all purchase SKUs (all rows checked by default) |

Stages: **4 — Digitisation** (Generated SKUs table) and **5 — Warehouse** (SKU Details table).

## Table UI

- Checkbox column + header “select all”
- **Print selected** disabled until at least one row is checked

## Modal behaviour

- **Print selected** passes a filtered SKU list to `window.openBarcodeModal` (all modal rows checked by default).
- Unit-tracked SKUs: `_bcExpandSkusWithUnits` — one label row per physical unit (same as warehouse publish flow).
- Empty selection → `cosmosToastWarn`.

## Out of scope

SKU Catalogue, live Digitisation working page, backend/API changes.
