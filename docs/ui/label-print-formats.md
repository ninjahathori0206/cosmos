# Label print formats (named presets + zones)

**Modal:** `#modal-barcode-print` in [`Foundry_Prototype.html`](../../Foundry_Prototype.html)  
**Configurator:** Command Unit → **Label Templates** (`/command-unit/label-templates`)  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) · [`label-template-configurator.js`](../../src/public/js/label-template-configurator.js)  
**Schema:** [`labelPrintFormatSchema.js`](../../src/config/labelPrintFormatSchema.js)  
**API:** `GET|PUT|POST|DELETE /api/foundry/label-print-formats` · meta `GET /api/meta/label-print-formats`

## Purpose

Operators print **7-digit unit QR** labels using org-wide **named formats**. Admins design layouts in Command Unit (page geometry + draggable **zones**); Foundry loads the same records at print time.

## Permissions

| Action | Key |
|--------|-----|
| View formats / configurator | `foundry.label_formats.view` |
| Edit / create / delete | `foundry.label_formats.edit` |

Command Unit nav uses the same keys (module: `command_unit` or `foundry`).

## Zone templates (migration 70)

| `format_key` | Description |
|--------------|-------------|
| `small_15x15` | 15×15 · 6-up · QR + vertical unit + brand footer |
| `small_15x15_fixed` | Brand rail + unit footer (TSPL-aligned) |
| `small_15x15_alt` | Brand rail + unit band |
| `strip_104x12` | 104×12 frame wrap · 33+33+34 zones |
| `large_label` | Legacy grid (no zones — imperative layout) |

Legacy keys (`small_label`, `small_15x15_continuous_109`, `eyewear_strip_12x100`, …) are deactivated after migration 70.

## Data model

- **`config_json`** — printer globals: `dotsPerMm`, `qrCellSize`, `textFontId`, `textXMul`, `textYMul`, `layoutType` fallback
- **`zones_json`** — declarative zones (`qr`, `text`, `tail`) with mm geometry and content tokens
- Denormalized mm columns on `dbo.label_print_formats` for the configurator UI

## Content tokens

| Token | Print value |
|-------|-------------|
| `{unit_id}` | 7-digit unit barcode |
| `{sku_code}` | SKU code |
| `{brand}` | Brand segment |
| `{model}` | Model line |
| `{mrp}` | Integer MRP |

## Deploy

```bash
npm run migrate:70-label-print-formats-zones
```

Re-login if role permissions changed. Operators re-select default format in the barcode modal once.

## Related

- [`label-template-configurator.md`](label-template-configurator.md)
- [`qr-15x15-label.md`](qr-15x15-label.md)
