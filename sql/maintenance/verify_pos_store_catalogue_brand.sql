/*
  Verify POS Store Catalogue brand resolution (same logic as sp_POS_StoreCatalogue).

  brand_name =
    COALESCE( home_brands.brand_name (if non-empty),
              product_master.source_brand (if non-empty),
              maker_master.maker_name (if non-empty),
              '' )

  If product_master.home_brand_id IS NULL, first branch is skipped → source_brand should appear
  (e.g. BLNK), not a home brand.

  Usage:
    1) Set @store_id to your store (required for join path with stock).
    2) Optional: set @sku_prefix e.g. N'BLN-%' or full sku_code; or leave NULL for all in-stock rows.
*/

DECLARE @store_id INT = 1;          -- <-- change
DECLARE @sku_prefix NVARCHAR(40) = N'BLN-%';  -- <-- change or NULL for all

SELECT
  sk.sku_id,
  sk.sku_code,
  pm.product_id,
  pm.home_brand_id,
  hb.brand_name AS home_brand_name_raw,
  pm.source_brand,
  mm.maker_name,
  LTRIM(RTRIM(COALESCE(
    NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
    NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
    NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
    ''
  ))) AS resolved_brand_name_same_as_pos,
  pm.ew_collection,
  pm.style_model,
  sb.qty AS store_qty
FROM dbo.stock_balances sb
JOIN dbo.skus sk
  ON sk.sku_id = sb.sku_id
 AND sk.status IN ('LIVE', 'ACTIVE')
JOIN dbo.product_master pm
  ON pm.product_id = sk.product_master_id
LEFT JOIN dbo.home_brands hb
  ON hb.brand_id = pm.home_brand_id
LEFT JOIN dbo.maker_master mm
  ON mm.maker_id = pm.maker_master_id
WHERE sb.location_type = 'STORE'
  AND sb.location_id = @store_id
  AND sb.qty > 0
  AND (@sku_prefix IS NULL OR sk.sku_code LIKE @sku_prefix)
ORDER BY sk.sku_code;

-- Compare to procedure output for the same store:
-- EXEC dbo.sp_POS_StoreCatalogue @store_id = 1, @q = NULL, @brand = NULL;
