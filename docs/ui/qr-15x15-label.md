# QR 15×15 compact label (eyewear)

**Modal:** `#modal-barcode-print` — presets **`small_label`**, **`small_15x15_continuous_109`**  
**Route:** Foundry Purchase View batch print (stages 4–5, warehouse publish)  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `layoutType: 'compact'`  
**Design preview:** [`compact-15x15-alignment-preview.html`](compact-15x15-alignment-preview.html) · Pencil frame `foundry/barcode-print`

## Purpose

Small **15×15 mm** square sticker for **eyewear** units: dense QR + human-readable unit id + brand/price at a glance.

## Physical layout (15 × 15 mm)

**Gaps:** `textGapFromQrMm = 1` (fixed in JS as `BC_COMPACT_TEXT_GAP_MM`).

```
┌──────────┬─┬──┐
│          │1│0 │  ← unit: vertical, left-aligned in rail (toward QR)
│   QR     │m│0 │
│  10mm    │m│6 │
│          │ │1 │
├──────────┴─┴──┤  ← brand top = QR bottom + 1 mm
│ MAR-4000      │  ← bottom band, top-aligned (not centred)
└───────────────┘
```

| Zone | Size / rule | Content |
|------|-------------|---------|
| **QR** | `qrInset` (0.4 mm) + `qrVisualSizeMm` (10 mm) | 7-digit unit barcode |
| **Gap** | **1 mm** between QR right edge and unit text | — |
| **Unit rail** | Remaining width to label edge | Same 7-digit code, **vertical**, **top/left** aligned toward QR |
| **Brand band** | `bottomBandHeightMm` (~4 mm) | `{brand}-{price}` (no spaces); text top at **QR bottom + 1 mm** |

Applies to **single** (`small_label`, 1 per row) and **6-up continuous** (`small_15x15_continuous_109` on 109 mm roll).

**Operator tuning (15×15 formats):** In the print modal, **15×15 label spacing & text** exposes **left/right margin (mm)** per sticker and **font size (pt)** — default **6 pt**. Same values sync to advanced **Inset left/right** and **Preview font (pt)**. Roll-level sheet margins (6-up) still use those insets on each 15 mm cell plus row padding on the 109 mm roll.

## Data mapping

| Field | Source | Notes |
|-------|--------|--------|
| QR payload | `unit_barcode` — **exactly 7 digits** | No PID/SKU fallback |
| Right column | Same 7-digit `unit_barcode` | Vertical, 1 mm from QR |
| Bottom — brand | `home_brands.brand_code` via `home_brand_id` | Uppercase |
| Bottom — brand fallback | First **3 letters** of `brand_name`, uppercase | When `brand_code` missing |
| Bottom — price | `sale_price` as **integer** | e.g. `4000` |
| Bottom line | `{brand}-{price}` | e.g. `MAR-4000` |

## Print stack

- **USB:** TSPL2 (TSC P210) — `SIZE 15 mm, 15 mm` (or 109 mm × 15 mm per row for 6-up)
- **Preview:** HTML/CSS mm in modal
- **Fallback:** Browser print with roll-sized `@page`

### QR encoding

- 7-digit numeric only; `QRCode.toDataURL` EC-L, version 1, margin 2, width 120 px
- TSPL: `QRCODE …,L,<cell>,A,0,"1234567"`

### TSPL alignment

- `QRCODE` at `(qrInset, qrInset)`
- Unit `TEXT` rotation **90°** at `X = qrInset + qrVisualSizeMm + 1 mm`, `Y = qrInset` (top-aligned with QR)
- Brand `TEXT` rotation **0°** at `Y = qrInset + qrVisualSizeMm + 1 mm`, `X ≈ 0.5 mm` from cell left

## Approval checklist

- [x] Spec + alignment preview HTML
- [ ] Pencil frame (optional when MCP available)
- [x] JS preview + TSPL + cache bust after layout approval
