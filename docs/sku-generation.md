# SKU code generation (Foundry digitisation)

## API

`POST /api/purchases/:headerId/generate-sku` with body `{ item_id, item_colour_id, sale_price }` calls **`dbo.sp_SKUv2_Generate`** ([`sql/sp/pipeline_v2.sql`](../sql/sp/pipeline_v2.sql)).

Requires purchase header **`PENDING_DIGITISATION`**. Permission: `foundry.digitisation.create`.

## Format (three segments — no trailing sequence)

Generation is entirely in **`sp_SKUv2_Generate`**. There is **no** `MAX(sku_id)+1` suffix on **`sku_code`**.

```
sku_code = BrandPrefix-CollectionPrefix-ColourPrefix
```

| Segment | Source | Normalization (as in SQL) |
|---------|--------|---------------------------|
| **Brand** | `home_brands.brand_name` (via `product_master.home_brand_id`) | `UPPER(LEFT(ISNULL(brand_name,'GEN'), 3))` |
| **Collection** | `product_master.ew_collection` | `UPPER(LEFT(REPLACE(ISNULL(ew_collection,'XX'),' ',''), 4))` |
| **Colour** | `purchase_item_colours.colour_code` | `UPPER(LEFT(REPLACE(ISNULL(colour_code,'00'),' ',''), 3))` |

The same **brand + collection + colour** string can appear on more than one row; **`pid`** (below) is the purchase-scoped unique key. `dbo.sku_code` is not required to be globally unique after [`add_pid_to_skus.sql`](../sql/maintenance/add_pid_to_skus.sql).

## PID and barcode

- **`pid`** = `sku_code + '-P' + header_id`, with a numeric suffix (`-1`, `-2`, …) only if that `pid` already exists.
- **`barcode`** = **`pid`** (scan id stays unique without a separate sequence block).

## Verification (after deploying SQL)

Deploy the `sp_SKUv2_Generate` section from [`sql/sp/pipeline_v2.sql`](../sql/sp/pipeline_v2.sql) or run [`sql/maintenance/deploy_sp_SKUv2_Generate_four_segment.sql`](../sql/maintenance/deploy_sp_SKUv2_Generate_four_segment.sql), then:

1. Use a purchase at **PENDING_DIGITISATION**.
2. Call `POST /api/purchases/{headerId}/generate-sku` with valid `item_id`, `item_colour_id`, `sale_price`.
3. Confirm **`sku_code`** has **three** hyphen-separated parts (no numeric tail).
4. Confirm **`barcode`** equals **`pid`** (e.g. `ABC-COLL-RED-P42`).
5. Call generate again for the same `item_colour_id` and expect HTTP 422 / “SKU already generated”.

No automated test runs in-repo without a live database connection.

## Older deployments

If you still see a **fourth** numeric segment on `sku_code` or `EWS-…-dddd` barcodes, the database is running an **older** `sp_SKUv2_Generate` — redeploy from `pipeline_v2.sql` or the maintenance script above.
