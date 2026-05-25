# QR 15×15 compact label (eyewear)

**Modal:** `#modal-barcode-print` — replaces preset **`small_label`**  
**Route:** Foundry Purchase View batch print (stages 4–5, warehouse publish)  
**JS (planned):** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `layoutType: 'compact'`  
**Pencil frame (planned):** `foundry/barcode-print` — compact 15×15 preview state

## Purpose

Small **15×15 mm** square sticker for **eyewear** units: dense QR + human-readable unit id + brand/price at a glance. Replaces the legacy Small label layout (centered QR + SKU code below).

## Physical layout (15 × 15 mm)

```
┌────────────────┬──┐
│                │ 1│
│      QR        │ 2│  ← unit barcode, vertical (90° CW)
│                │ 3│
├────────────────┴──┤
│    MAR - 800      │  ← brand + price, horizontal, centred
└───────────────────┘
```

| Zone | Approx. area | Content |
|------|----------------|---------|
| **QR** | Top-left, ~11×11 mm | QR encoding **7-digit unit barcode** |
| **Right rail** | ~3 mm wide × ~11 mm tall | Same **unit barcode** as text, rotated vertical |
| **Bottom band** | Full width × ~3–4 mm | **`{brand} - {price}`** |

No non-print tail. One label per unit; one label per print row (`labelsPerRow: 1`).

## Data mapping

| Field | Source | Notes |
|-------|--------|--------|
| QR payload | `unit_barcode` (7 digits) or unit PID | Same as eyewear strip / existing batch expand |
| Right column | `unit_barcode` | Duplicate of QR payload for human read at arm’s length |
| Bottom — brand | `home_brands.brand_code` via product `home_brand_id` | Uppercase as stored |
| Bottom — brand fallback | First **3 letters** of `brand_name`, uppercase | When `brand_code` empty/missing (**decision B**) |
| Bottom — price | `sale_price` as **integer** | No ₹, no decimals in label text (e.g. `800`) |
| Bottom — price missing | `—` or omit price segment | TBD at implementation: prefer `MAR - —` vs `MAR` only |

### Brand resolution chain (bottom line)

1. `brand_code` from `home_brands` (join via SKU → `product_master.home_brand_id`)
2. Else first 3 chars of `brand_name` (uppercase), from purchase item merge / SKU API enrichment (same chain as eyewear strip)
3. If still empty: show `—` for brand segment → `— - 800`

### Bottom line format

- Template: **`{brand} - {price}`**
- Example: `MAR - 800`
- Max brand segment: **6 chars** (truncate with ellipsis in preview if needed)
- Separator: space-hyphen-space (` - `)

## User flow

1. Purchase View → select SKUs (eyewear) → **Print selected** / **Print all**
2. **Label format** → **Small label** (15×15 — compact QR layout; same preset key `small_label`, new layout)
3. Preview shows compact square rows; **Print Labels** sends TSPL batch (TSC P210)

Warehouse publish path (`handleWarehouseReady`) uses the same modal and format dropdown.

## Print stack

- **USB:** TSPL2 (TSC P210) — `SIZE 15 mm, 15 mm`
- **Preview:** HTML/CSS mm layout in modal (`layoutType: 'compact'`)
- **Fallback:** Browser print HTML (same as other formats)

### TSPL notes (implementation)

- `QRCODE` top-left with tight margins (~0.5 mm)
- `TEXT` rotation **90°** for right-rail unit barcode
- Bottom band: single `TEXT` line, centred or left-aligned within bottom zone
- Font: smallest readable TSC built-in (font id 2, x/y mul 1) — tune in calibration

## Format preset

- **Replace** existing seed `small_label` — same `format_key`, new `config_json` with `layoutType: 'compact'` and zone mm fields (e.g. `qrZoneWidthMm`, `rightRailWidthMm`, `bottomBandHeightMm`).
- **Do not** add a second 15×15 preset; operators keep selecting “Small label”.
- Eyewear-only is **documented intent**; enforcement is by operator choice (no category gate in v1).

## States

| State | Preview |
|-------|---------|
| Default | Sample row with QR, vertical unit id, `MAR - 800` |
| Loading | Skeleton rows in preview panel (existing polish) |
| Empty batch | “No labels in batch” (existing) |
| Missing brand | `ABC - 800` (3-letter fallback) or `— - 800` |
| Missing price | `MAR - —` (or brand only — pick at implement) |

## Out of scope (v1)

- ZPL / Zebra
- SKU code on label (unit barcode only)
- Per-label editing in modal
- Non–Purchase View entry points (SKU catalogue, POS)
- New DB column for brand abbrev (`brand_code` already exists)

## Approval checklist

- [x] This spec approved
- [ ] Pencil frame approved (`foundry/barcode-print` compact preview) — skipped (Pencil MCP unavailable); approved from spec + mockup
- [x] Schema + migration update `small_label`, JS preview + TSPL, cache bust
