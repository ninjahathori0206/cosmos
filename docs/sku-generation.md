# SKU code generation (Foundry digitisation)

## API

`POST /api/purchases/:headerId/generate-sku` with body `{ item_id, item_colour_id, sale_price }` calls **`dbo.sp_SKUv2_Generate`** ([`sql/sp/pipeline_v2.sql`](../sql/sp/pipeline_v2.sql)).

Requires purchase header **`PENDING_DIGITISATION`**. Permission: `foundry.digitisation.create`.

## Format (four segments)

```
sku_code = BrandCode-CollectionCode-modelno-ColourCode
```

| Segment | Source | Normalization |
|---------|--------|----------------|
| **BrandCode** | `home_brands.brand_code`, else first 3 chars of `product_master.source_brand` | `UPPER(LEFT(..., 4))` |
| **CollectionCode** | `product_master.ew_collection` | Spaces removed; `UPPER(LEFT(..., 6))` |
| **modelno** | `product_master.source_model_number` | Spaces and hyphens removed; `UPPER(LEFT(..., 8))`. If empty after trim, **`UNK`**. |
| **ColourCode** | `purchase_item_colours.colour_code` | Spaces removed; `UPPER(LEFT(..., 4))` |

## PID and barcode

- `pid = sku_code + '-P' + header_id` (with a numeric suffix if `pid` collides).
- New rows set `barcode = pid` (purchase-scoped scan id).

## Verification (after deploying SQL)

Deploy the updated procedure to CosmosERP (run the `sp_SKUv2_Generate` section from [`sql/sp/pipeline_v2.sql`](../sql/sp/pipeline_v2.sql)), then:

1. Use a purchase at **PENDING_DIGITISATION** with `product_master.source_model_number` set (e.g. `VR-01`).
2. Call `POST /api/purchases/{headerId}/generate-sku` with valid `item_id`, `item_colour_id`, `sale_price`.
3. Confirm returned `sku_code` has **four** segments: `Brand-Coll-Model-Colour` (model segment should normalize `VR-01` to `VR01`).
4. Call generate again for the same `item_colour_id` and expect HTTP 422 / “SKU already generated”.
5. If two lines could collide on `pid`, confirm the procedure’s `WHILE EXISTS` loop appends `-2`, `-3`, etc. to `pid` (rare).

No automated test runs in-repo without a live database connection.
