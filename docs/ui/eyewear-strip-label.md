# Eyewear strip label (12 × 100 mm)

**Modal:** `#modal-barcode-print` — format preset `eyewear_strip_12x100`  
**JS:** [`foundry-prototype.js`](../../src/public/js/foundry-prototype.js) — `_bcGetLayoutType`, strip preview/TSPL  
**Pencil frame:** `foundry/barcode-print` (strip preview state)

## Purpose

Frame-wrap eyewear labels: **100 mm** total length × **12 mm** height. **66 mm** printable (two zones) + **34 mm** non-print tail.

| Zone | Width | Content |
|------|-------|---------|
| **1 — QR** | 33 mm | QR (7-digit unit barcode) left · **unit text** right |
| **2 — Brand** | 33 mm | **Brand** (bold/larger) · model · MRP |
| **3 — Tail** | 34 mm | Non-print (dashed in preview only) |

## Data mapping

| Field | Source |
|-------|--------|
| QR + unit text | `unit_barcode` (7 digits) |
| Brand | `brand_name` (from purchase SKU API) |
| Model | `ew_collection · style_model` |
| MRP | `MRP ₹…` from `sale_price` |

## Print stack

- **USB:** TSPL2 (TSC P210) — `SIZE 100 mm, 12 mm`; content in 0–66 mm only  
- **Preview:** HTML/CSS mm layout in modal  
- **Fallback:** Browser print HTML

## User flow

1. Purchase View → select SKUs → **Print selected** / **Print all**
2. **Label format** → **Eyewear strip 12×100**
3. Preview shows strip rows; **Print Labels** sends TSPL batch (one strip per unit)

## Format preset

Seeded as `eyewear_strip_12x100`. Operators can **Save as new…** with a custom name; `layoutType: "strip"` must stay in saved config.

## Out of scope

- ZPL / Zebra
- SKU code in Zone 1 (unit text only)
- Per-label editing in modal
