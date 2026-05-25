# Label print formats (named presets)

**Modal:** `#modal-barcode-print` in [`Foundry_Prototype.html`](../../Foundry_Prototype.html)  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `bcLoadLabelFormats`, `bcApplyLabelFormat`, `bcUpdateLabelFormat`  
**Pencil frame:** `foundry/barcode-print` (format picker + geometry controls; no unit list)

## Purpose

Operators always print **QR codes** encoding the 7-digit **unit barcode**. Physical labels come in **two sizes** (small sticker vs large roll), each stored as a **named org-wide format** — set up once, reused on every PC, editable later.

## User flow

1. Select SKUs on Purchase View → **Print selected** / **Print all** (or warehouse publish opens modal with full batch).
2. Modal opens → **Label format** dropdown loads presets from `GET /api/meta/label-print-formats`.
3. Choosing a format applies geometry + QR layout fields and refreshes preview.
4. User with `foundry.label_formats.edit` can **Update format**, **Save as new…**, or **Set as default**.
5. **Print Labels** sends full batch (one QR per unit). USB horizontal calibration stays per browser/printer.

## Modal UI (left column)

| Control | Behaviour |
|---------|-----------|
| Label format | `<select id="bc-format-select">` — named presets from API |
| Helper | “QR encodes unit barcode · text shows SKU code” |
| Update format | PUT current preset with field values from modal |
| Save as new… | Prompt name → POST new `format_key` |
| Set as default | PUT `is_default: true` on current format |
| Geometry / QR / TSPL blocks | Unchanged; values belong to selected format |
| USB calibration | Unchanged; **not** saved in server format |

Edit actions hidden when JWT lacks `foundry.label_formats.edit`.

## API

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/meta/label-print-formats` | `foundry` module + any of `foundry.label_formats.view`, `foundry.digitisation.view`, `foundry.warehouse.view` |
| POST | `/api/foundry/label-print-formats` | `foundry.label_formats.edit` |
| PUT | `/api/foundry/label-print-formats/:formatKey` | `foundry.label_formats.edit` |
| DELETE | `/api/foundry/label-print-formats/:formatKey` | `foundry.label_formats.edit` |

## Seed formats (migration)

| format_key | Name | Size (mm) |
|------------|------|-----------|
| `large_label` | Large label | 40 × 28 (default) |
| `small_label` | Small label | 15 × 15 |
| `eyewear_strip_12x100` | Eyewear strip 12×100 | 100 × 12 (66 mm print + tail) |

Tune names and dimensions in the modal after deploy.

## States

- **Loading formats:** skeleton or disabled dropdown until GET completes.
- **No formats:** toast warn; modal still opens with in-app defaults.
- **Save/update error:** `cosmosToastError` with API message.

## Out of scope

- CODE128 barcode type (encoding is QR only).
- Per-unit selection or qty in modal (see [`purchase-view-barcode-print.md`](purchase-view-barcode-print.md)).
