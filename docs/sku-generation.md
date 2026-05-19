# SKU code generation (Foundry digitisation)

**Related:** [QR, PID, and SKU structure](./qr-pid-sku-structure.md) — field formats, QR encoding priority (`unit_barcode` → `pid` → `sku_code`), scan resolution, and worked examples.

## API

`POST /api/purchases/:headerId/generate-sku` with body `{ item_id, item_colour_id, sale_price }` calls **`dbo.sp_SKUv2_Generate`** ([`sql/sp/pipeline_v2.sql`](../sql/sp/pipeline_v2.sql)).

Requires purchase header **`PENDING_DIGITISATION`**. Permission: `foundry.digitisation.create`.

## Branding bypass side effects (`sp_PurchaseHeader_BrandingBypass`)

When branding is **bypassed** (stage moves to `PENDING_DIGITISATION`), the procedure also updates every **`product_master`** row referenced by that purchase’s line items:

| Field | Rule |
|-------|------|
| **`ew_collection`** | If **`source_collection`** is non-empty, set **`ew_collection = source_collection`** (source wins). If source collection is blank, **`ew_collection` is left unchanged**. |
| **`home_brand_id`** | If **`source_brand`** is non-empty: resolve a **`home_brands`** row whose **`brand_name`** or **`brand_code`** matches (case-insensitive, trimmed). If none exists, **INSERT** a new `home_brands` row (`brand_name` = trimmed source brand, **`brand_code`** = alphanumeric prefix up to 10 chars, with a numeric suffix until `brand_code` is unique), then set **`home_brand_id`** to that id. |

This runs **before** digitisation SKU generation so the **brand** segment of the SKU can use the linked home brand name.

Deploy: **`npm run migrate:34-branding-bypass-sync-sku-model`** (or run [`sql/alter/34_branding_bypass_sync_sku_model.sql`](../sql/alter/34_branding_bypass_sync_sku_model.sql)).

**Brand code prefix (migration 57):** **`npm run migrate:57-sku-brand-code-prefix`** — uses `home_brands.brand_code` for the SKU prefix when `home_brand_id` is set; resolves catalog match by code or name before falling back to **`GEN`**.

## Format (four body segments — no global numeric tail on `sku_code`)

Generation is entirely in **`sp_SKUv2_Generate`**. There is **no** `MAX(sku_id)+1` suffix on **`sku_code`**.

```
sku_code = BrandPrefix-CollectionPrefix-ModelPrefix-ColourPrefix
```

| Segment | Source | Normalization (as in SQL) |
|---------|--------|---------------------------|
| **Brand** | `home_brands.brand_code` when linked, else `brand_name`, else `source_brand`, else `maker_name` | `UPPER(LEFT(..., 3))`; **`GEN`** only when all are blank. Example: **`BLNK`** home brand → prefix **`BLN`** (3 chars). |
| **Collection** | `product_master.ew_collection` | `UPPER(LEFT(REPLACE(ISNULL(ew_collection,'XX'),' ',''), 4))` |
| **Model** | `product_master.source_model_number`, else **`style_model`** | Trim; strip spaces and hyphens; `UPPER(LEFT(..., 8))`; if empty **`UNK`** |
| **Colour** | `purchase_item_colours.colour_code` | `UPPER(LEFT(REPLACE(ISNULL(colour_code,'00'),' ',''), 3))` |

The same **brand + collection + model + colour** string can appear on more than one row; **`pid`** (below) is the purchase-scoped unique key. `dbo.skus.sku_code` is not required to be globally unique after [`add_pid_to_skus.sql`](../sql/maintenance/add_pid_to_skus.sql).

## PID and barcode

- **`pid`** = `sku_code + '-P' + header_id`, with a numeric suffix (`-1`, `-2`, …) only if that `pid` already exists.
- **`barcode`** = **`pid`** (batch-level scan; not printed on per-unit labels when units exist).

The **`-P{n}`** suffix is the **purchase header id** (`purchase_headers.header_id`), not a separate sequence. Example: `GEN-OLD-E800-STD-P38` means purchase **#38**. After a full purchase wipe with ID reseed, the next purchase is **#1** and new barcodes use **`-P1`**.

## Per-unit barcodes (`dbo.sku_units`)

After each new SKU insert (and on restock quantity), **`sp_SKUv2_AllocateUnits`** creates **`quantity`** rows:

- **`unit_barcode`**: `FORMAT(NEXT VALUE FOR dbo.seq_sku_unit_barcode, 'D7')` → `0000001` … `9999999`
- **`status`**: `AVAILABLE` until sold at POS

**Deploy / migrate:**

- `npm run migrate:50-sku-units`
- `npm run deploy:sp-sku-units` (SPs + migration procs)
- `npm run maintenance:backfill-sku-units` (existing SKUs)

**API:** `POST .../generate-sku` response includes **`units: [{ unit_no, unit_barcode }, …]`**. Print modal loads **`GET /api/skus/:skuId/units`**.

## Verification (after deploying SQL)

Deploy from [`sql/sp/pipeline_v2.sql`](../sql/sp/pipeline_v2.sql) or run:

- **`npm run migrate:34-branding-bypass-sync-sku-model`**

Then:

1. Use a purchase at **PENDING_DIGITISATION** (optionally after a **branding bypass** to exercise product sync).
2. Call `POST /api/purchases/{headerId}/generate-sku` with valid `item_id`, `item_colour_id`, `sale_price`.
3. Confirm **`sku_code`** has **four** hyphen-separated body segments (no old global sequence block).
4. Confirm **`barcode`** equals **`pid`** (e.g. `ABC-COLL-MODEL-RED-P42`).
5. Confirm **`units`** length equals purchase **quantity**; each **`unit_barcode`** is 7 numeric digits.
6. Call generate again for the same `item_colour_id` and expect HTTP 422 / “SKU already generated”.

No automated test runs in-repo without a live database connection.

## Legacy row remediation (3-segment → 4-segment)

If a row was generated **before** the model segment shipped (`sku_code` like `GEN-OLD-STD` with `pid` / `barcode` `GEN-OLD-STD-P38`), run:

- **`npm run maintenance:fix-sku-gen-old-std-p38`**

Source: [`sql/maintenance/fix_sku_GEN_OLD_STD_P38_four_segment.sql`](../sql/maintenance/fix_sku_GEN_OLD_STD_P38_four_segment.sql) — edit `@match_sku_code` / `@match_pid` if you need a different row.

## Older deployments

If you still see **only three** body segments (no model) or `EWS-…-dddd` barcodes, the database is running an **older** `sp_SKUv2_Generate` — redeploy from `pipeline_v2.sql` or the migration above.
