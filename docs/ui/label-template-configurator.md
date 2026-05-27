# Label Template Configurator

**Route:** `/command-unit/label-templates`  
**Shell:** [`CommandUnit_Prototype.html`](../../CommandUnit_Prototype.html) — `#page-label-templates`  
**JS:** [`label-template-configurator.js`](../../src/public/js/label-template-configurator.js)  
**API:** `GET|PUT|POST|DELETE /api/foundry/label-print-formats`  
**Pencil frame:** `command-unit/label-templates`

## Purpose

Admins configure org-wide label print templates: page/roll geometry, grid (columns/gaps), and draggable **zones** (QR, text, tail). Foundry’s print modal loads the same records and prints via zone-driven TSPL + HTML preview.

## RBAC

| Action | Permission | Module |
|--------|------------|--------|
| View page / list | `foundry.label_formats.view` | `command_unit` or `foundry` |
| Save / create / delete | `foundry.label_formats.edit` | `command_unit` or `foundry` |

No new catalogue keys — reuse existing Foundry label format permissions.

## User flow

1. Open **Command Unit → Foundry Masters → Label Templates**.
2. Pick a template from the left list (loads via API).
3. **Step 1 — Page & label size:** name, type preset, roll width, margins, label W×H, width proof (`margin + cols×label + gaps = page`).
4. **Step 2 — Grid:** columns, col/row gap, top margin, **Print orientation** (USB TSPL preset); SVG roll preview.
5. **Step 3 — Zone designer:** drag/resize zones; property panel; live TSPL panel; **Save** (PUT), **New template** (POST), **Delete** (hard delete).
6. Foundry operators select the same `format_key` in barcode print modal.

## Zone types

| `zone_type` | Preview | TSPL |
|-------------|---------|------|
| `qr` | Dark placeholder | `QRCODE` |
| `text` | Content preview in zone box | `TEXT` (left/top) or `BLOCK` (other alignments) |
| `tail` | Dashed grey | Skipped (non-print) |

## Text alignment (text zones)

| Field | Values | Notes |
|-------|--------|--------|
| `text_align_h` | `left`, `center`, `right` | Horizontal in zone box |
| `text_align_v` | `top`, `middle`, `bottom` | Vertical in zone box |
| `writing_mode` | `horizontal`, `vertical` | Rotation (separate from align) |

Default: **left** + **top** (same as legacy TSPL `TEXT` at X,Y). Other combinations use TSPL `BLOCK` inside the zone W×H.

## Save template (Command Unit)

1. Open **Command Unit → Foundry Masters → Label Templates** (`/command-unit/label-templates`).
2. Edit steps 1–3; configure zones (content, alignment, position).
3. Click **Save template** (requires `foundry.label_formats.edit`).
4. API: `PUT /api/foundry/label-print-formats/{format_key}` — stores `zones_json` + page geometry on the server.
5. Toast **“Template saved”** confirms persistence.

**New template:** **+ New** → name → `POST /api/foundry/label-print-formats`.  
**Delete:** **Delete** → hard delete via `DELETE`.

## Use in label printing (Foundry)

1. Open **Foundry** (e.g. Purchase view or stock with barcode print).
2. Open the **barcode / label print** modal (`#modal-barcode-print`).
3. In **Label format**, pick the same template you saved (dropdown loads `GET /api/meta/label-print-formats`).
4. Select units/SKUs to print; preview uses your **zones** (QR, text, alignment).
5. Print via **USB (TSPL)** or browser print — zone layout and tokens apply automatically.

Operators do **not** reconfigure zones in Foundry unless they have edit permission and use **Update format** in the modal. Day-to-day printing only requires choosing the saved format name.

**USB print orientation (BarTender Page Setup):** Set once in **Step 2 → Print orientation**. Stored as `config.printOrientation` in `config_json` (no DB migration). Foundry USB jobs emit TSPL `DIRECTION` from this preset — **not** from Chrome/Edge Portrait/Landscape.

| Preset | TSPL `DIRECTION` | Use when |
|--------|------------------|----------|
| Portrait (default) | `0` | Wide roll row (e.g. BarTender **QR 110×15 mm**, Portrait) |
| Portrait 180° | `1` | BarTender Portrait 180° |
| Landscape / Landscape 180° | `0` / `1` | Strip or alternate layouts |

Catalog: `GET /api/meta/label-print-orientations`. Legacy `compact-fixed` seeds default to **Portrait 180°** when unset.

**Roll width:** Match BarTender stock in **Step 1 → Page width** (e.g. **110 mm** for `QR (110.0 × 15.0 mm)`; Cosmos SQUARE preset was 109 mm).

**Default format:** In CU or Foundry, set one template as default (`is_default`) so the modal pre-selects it.

## Sample preview data (step 3)

The **Sample preview data** bar above the canvas fills tokens while designing:

| Field | Default | Token |
|-------|---------|--------|
| Unit | `1234567` | `{unit_id}` |
| SKU | `SKU-MAR-001` | `{sku_code}` |
| Brand | `MAR` | `{brand}` |
| Model | `Aviator Classic` | `{model}` |
| MRP | `4000` | `{mrp}` |

Canvas and **TSPL preview** show resolved values; **Content** on each zone still stores tokens (e.g. `{unit_id}`). QR zones render a real sample QR when the library loads. **Reset** restores defaults.

## Content tokens (print-time)

In the zone panel, use **Insert data token** chips or **presets** (also from `GET /api/meta/label-zone-content-tokens`).

| Token | Replaced with |
|-------|----------------|
| `{unit_id}` | 7-digit unit barcode |
| `{sku_code}` | SKU code |
| `{brand}` | Brand code (uppercase) |
| `{model}` | Model name |
| `{mrp}` | Integer sale price |

**Presets:** Unit ID only · SKU only · Brand-MRP · 3-line strip (`{brand}` / `{model}` / `MRP {mrp}`).

## Seeded templates (migration 70)

| `format_key` | Type | Notes |
|--------------|------|--------|
| `small_15x15` | SQUARE | Spec: QR + vertical unit rail + brand footer |
| `small_15x15_fixed` | SQUARE | Brand rail + unit footer (TSPL-aligned) |
| `small_15x15_alt` | SQUARE | Brand rail + unit band |
| `strip_104x12` | STRIP | 33+33+34 mm zones, 108 mm roll |
| `large_label` | — | Legacy `config_json` only (no zones) |

Legacy keys (`small_label`, `small_15x15_continuous_109`, `eyewear_strip_12x100`, etc.) deactivated after migration.

## States

- **Loading:** `cosmosSkeletonRows` on template list; skeleton on canvas until GET completes.
- **Width proof fail:** warning banner; PUT blocked client-side.
- **Save:** `cosmosBtnLoading` on Save; `cosmosToastSuccess` / `cosmosToastError`.
- **Empty list:** headline + “Create template” when user has edit permission.

## Visual theme

Match **Command Unit** (light cards, `--acc` blues, navy sidebar) — **not** the dark/gold Downloads prototype.

## Out of scope

- Per-browser USB offset (stays in Foundry modal localStorage).
- CODE128-only labels (QR only for unit ids).
