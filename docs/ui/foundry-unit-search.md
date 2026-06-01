# Foundry — Unit Search (trace by unit code)

**Route:** `/foundry/unit-search`  
**Pencil frame:** `FY — Unit Search · /foundry/unit-search`  
**Permission:** `foundry.units.trace`  
**API:** `GET /api/skus/units/trace?q={7-digit}`

## Purpose

HQ staff scan or type a **7-digit unit code** (label QR / barcode) to see where that physical piece is now, how it moved through warehouse → transfer → store, and sale summary when sold.

Read-only trace — no custody edits from this screen.

## User flow

1. Open **Catalogue → Unit Search** in Foundry sidebar.
2. Enter or scan 7-digit unit code; press Enter or **Search**.
3. Results show unit header, SKU context, timeline, and optional sale card.
4. Invalid / unknown code → field error + toast; empty search → field validation.

## Screen states

| State | UI |
|-------|-----|
| Default (empty) | Search bar + empty state: headline “Trace a unit by code”, subtext “Enter the 7-digit code from the product label or scan with a wedge scanner.” |
| Loading | Skeleton rows in timeline panel; search button uses `cosmosBtnLoading` |
| Found | Unit header card + SKU strip + timeline + sale card (if sold) |
| Not found | Toast error; clear result panels; keep search value |
| API error | `cosmosToastError` |

## Layout (desktop)

```
┌──────────────────────────────────────────────────────────────┐
│ Unit Search                                                  │
├──────────────────────────────────────────────────────────────┤
│ [ 🔍  Unit code (7 digits)                    ] [ Search ]   │
├──────────────────────────────────────────────────────────────┤
│ ┌─ Unit header ────────────────────────────────────────────┐ │
│ │ 0010447          [Available]                             │ │
│ │ Current location: Primary Warehouse (HQ)                 │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌─ SKU ────────────────────────────────────────────────────┐ │
│ │ Brand · Collection · Model · SKU-123 · PID · Colour      │ │
│ └──────────────────────────────────────────────────────────┘ │
│ ┌─ History ────────────────┐ ┌─ Selling details (if sold) ┐ │
│ │ ● Created 01 Jun 2026    │ │ Invoice EW-INV-…             │ │
│ │ ● Dispatched Doc #12 …   │ │ Store · Date · Amount        │ │
│ │ ● Stocked at Store ABC   │ │ Order status                 │ │
│ └──────────────────────────┘ └──────────────────────────────┘ │
```

## Copy

- Page title: **Unit Search**
- Search placeholder: **Unit code (7 digits)**
- Empty headline: **Trace a unit by code**
- Empty subtext: **Enter the 7-digit code from the product label or scan with a wedge scanner.**
- Timeline section title: **History**
- Sale section title: **Selling details** (hidden when unit not sold)
- Location label prefix: **Current location:**

## Data mapping

| UI field | API field |
|----------|-----------|
| Unit code | `unit.unit_barcode` |
| Status badge | `unit.status` → label from `GET /api/meta/sku-unit-statuses` |
| Location | `unit.current_location_label` |
| SKU line | brand, sku_code, pid, colour_name, product_name |
| Timeline rows | `timeline[]` — `event_at`, `title`, `detail` |
| Sale block | `sale` — invoice_no, store_name, sold_at, line_total, order_status |

## Accessibility

- Search input: `aria-label="Unit code"`, `inputmode="numeric"`, autofocus on page load
- Search button: `aria-label="Search unit trace"`
- Timeline: ordered list semantics (`<ol>` or role=list)
- Status badge: text label, not colour-only

## Polish checklist

- `cosmosSkeletonRows` before fetch
- `cosmosBtnLoading` / `cosmosBtnDone` on Search
- `cosmosFieldError` / `cosmosFieldClear` on input
- `cosmosToastError` for API errors
- IST dates via `cosmosFmtDateTime`
- CSS variables only — no hardcoded hex

## Out of scope (v1)

- Batch barcode / SKU text search
- Customer PII on sale card
- Edit custody or transfer actions from this page
