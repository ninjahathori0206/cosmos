# Product Types — Single Source of Truth (Command Unit)

## Purpose
One authoritative list in `dbo.pos_product_type_config` drives Foundry purchase dropdowns, POS checkout rules, and unit-barcode behaviour. Command Unit **Foundry Settings → Product Types** tab is the only admin surface.

## Screen
- **Frame:** Command Unit → Foundry Settings (`page-foundry-settings`)
- **Route label:** `command-unit/foundry-settings`

## Removed
- Standalone card **“POS product types — unit barcode”** (merged into Product Types table).

## Product Types tab — table columns
| Column | Source field |
|--------|----------------|
| # | row index |
| Key | `product_type_key` |
| Label | `label` |
| Description | `description` |
| Order | `display_order` |
| Fulfillment | `fulfillment_mode` (INSTANT / LAB / DUAL) |
| Unit scan | `requires_unit_barcode` (checkbox in edit modal) |
| Lens wizard | `lens_wizard_policy` (NEVER / OPTIONAL / REQUIRED) |
| Status | `is_active` |
| Action | Edit |

## Add / Edit modal (product_type only)
Extra fields below standard lookup fields:
- **Fulfillment mode** — select INSTANT | LAB | DUAL
- **Requires unit scan** — checkbox
- **Lens wizard policy** — select NEVER | OPTIONAL | REQUIRED

## Customer-owned frame (`CUSTOMER_FRAME`)

Seeded by migration `89_customer_frame_lens.sql`: **LAB**, lens wizard **REQUIRED**, unit scan **off**. Store OS uses a virtual SKU (`pos.customer_frame_sku_id` in app settings). See [`pos-customer-frame-lens.md`](pos-customer-frame-lens.md).

## API
- List (admin): `GET /api/foundry-lookups` (includes product types from `pos_product_type_config`)
- Foundry forms: same endpoint; active types only when `?type=product_type`
- Create/update/deactivate: `POST|PUT|DELETE /api/foundry-lookups` with `lookup_type: product_type`

## States
- **Loading:** skeleton on tbody
- **Empty:** headline + “+ Add Value”
- **Error:** toast + inline row message
