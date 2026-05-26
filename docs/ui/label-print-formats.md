# Label print formats (named presets)

**Modal:** `#modal-barcode-print` in [`Foundry_Prototype.html`](../../Foundry_Prototype.html)  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `_bcEnsureLabelFormatsLoaded`, `bcOnFormatSelectChange`, `bcUpdateLabelFormat`  
**Config:** [`foundryLabelFormatReadPerms.js`](../../src/config/foundryLabelFormatReadPerms.js) — shared GET permission keys  
**Pencil frame:** `foundry/barcode-print` (format picker + geometry controls; no unit list)

## Purpose

Operators always print **QR codes** encoding the 7-digit **unit barcode**. Physical labels come in **named org-wide formats** (large roll, small sticker, eyewear strip) — set up once, reused on every PC, editable later.

## User flow

1. Select SKUs on Purchase View → **Print selected** / **Print all** (or warehouse publish opens modal with full batch).
2. Modal opens → **Label format** dropdown shows “Loading formats…” then presets from `GET /api/meta/label-print-formats` (or built-in fallbacks if the request fails).
3. Choosing a format applies geometry + QR layout fields and refreshes preview.
4. User with `foundry.label_formats.edit` can **Update format**, **Save as new…**, or **Set as default**.
5. **Print Labels** sends full batch (one QR per unit). USB horizontal calibration stays per browser/printer.

## Modal UI (left column)

| Control | Behaviour |
|---------|-----------|
| Label format | `<select id="bc-format-select">` — named presets from API + client fallbacks |
| Helper | Layout-specific hint (grid / compact / strip) |
| Update format | PUT current preset with field values from modal |
| Save as new… | Prompt name → POST new `format_key` |
| Set as default | PUT `is_default: true` on current format |
| Geometry / QR / TSPL blocks | Unchanged; values belong to selected format |
| USB calibration | Unchanged; **not** saved in server format |

Edit actions hidden when JWT lacks `foundry.label_formats.edit`.

## API

| Method | Route | Permission |
|--------|-------|------------|
| GET | `/api/meta/label-print-formats` | `foundry` module + **any one** of: `foundry.label_formats.view`, `foundry.purchases.view`, `foundry.bill_verification.view`, `foundry.branding.view`, `foundry.digitisation.view`, `foundry.warehouse.view`, `foundry.stock.view` (see `FOUNDRY_LABEL_FORMAT_READ_PERMS`) |
| POST | `/api/foundry/label-print-formats` | `foundry.label_formats.edit` |
| PUT | `/api/foundry/label-print-formats/:formatKey` | `foundry.label_formats.edit` |
| DELETE | `/api/foundry/label-print-formats/:formatKey` | `foundry.label_formats.edit` |

## Seed formats (migration)

| format_key | Name | Size (mm) |
|------------|------|-----------|
| `large_label` | Large label | 40 × 28 (default) |
| `small_label` | Small label | 15 × 15 compact (1 per row, brand + price) |
| `small_15x15_continuous_109` | 15×15mm Label — Continuous Roll | 15 × 15 · **6 columns** · 109 mm roll width |
| `eyewear_strip_12x100` | Eyewear strip 12×100 | 100 × 12 (66 mm print + tail) |

Deploy: `npm run migrate:64-label-print-formats`, `migrate:65-eyewear-strip-label`, `migrate:66-qr-15x15-compact-label`, `migrate:68-small-15x15-continuous-roll-109`.

Grant `foundry.label_formats.view` to existing roles (optional, for explicit catalogue key):  
[`sql/maintenance/grant_label_formats_view_from_purchase_roles.sql`](../../sql/maintenance/grant_label_formats_view_from_purchase_roles.sql) — **re-login** after run.

## States

- **Loading formats:** dropdown disabled with “Loading formats…” until GET completes.
- **API error:** toast warns; dropdown still lists **built-in presets** (`large_label`, `small_label`, `eyewear_strip_12x100`) so printing is never blocked.
- **Save/update error:** `cosmosToastError` with API message.

## Out of scope

- CODE128 barcode type (encoding is QR only).
- Per-unit selection or qty in modal (see [`purchase-view-barcode-print.md`](purchase-view-barcode-print.md)).
