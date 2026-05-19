-- Remap sku_code / pid / barcode for rows that used GEN fallback but product can resolve a home brand.
-- Uses same 4-segment rules as sp_SKUv2_Generate (brand_code preferred for prefix).
--
-- Run: npm run maintenance:remap-gen-sku-prefix
-- Applies UPDATE and prints changed rows via OUTPUT.

USE [CosmosERP];
GO

SET NOCOUNT ON;

;WITH sku_ctx AS (
  SELECT
    sk.sku_id,
    sk.header_id,
    sk.sku_code AS old_sku_code,
    sk.pid AS old_pid,
    pm.product_id,
    pm.source_brand,
    pm.home_brand_id,
    pm.ew_collection,
    pm.source_model_number,
    pm.style_model,
    pic.colour_code,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_code, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      ''
    ))) AS brand_for_prefix
  FROM dbo.skus sk
  JOIN dbo.purchase_items pi ON pi.item_id = sk.item_id AND pi.header_id = sk.header_id
  JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
  JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
  LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
  WHERE sk.sku_code LIKE 'GEN-%'
),
resolved AS (
  SELECT
    c.*,
    COALESCE(
      NULLIF(c.brand_for_prefix, ''),
      (
        SELECT TOP (1) LTRIM(RTRIM(COALESCE(
          NULLIF(LTRIM(RTRIM(ISNULL(hx.brand_code, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(hx.brand_name, ''))), ''),
          ''
        )))
        FROM dbo.home_brands hx
        WHERE hx.is_active = 1
          AND (
            UPPER(LTRIM(RTRIM(hx.brand_code))) = UPPER(LTRIM(RTRIM(c.source_brand)))
            OR LOWER(LTRIM(RTRIM(hx.brand_name))) = LOWER(LTRIM(RTRIM(c.source_brand)))
          )
      )
    ) AS resolved_brand
  FROM sku_ctx c
),
calc AS (
  SELECT
    r.sku_id,
    r.header_id,
    r.old_sku_code,
    r.old_pid,
    r.resolved_brand,
    UPPER(LEFT(COALESCE(NULLIF(r.resolved_brand, ''), 'GEN'), 3)) AS brand_pfx,
    UPPER(LEFT(REPLACE(ISNULL(r.ew_collection, 'XX'), ' ', ''), 4)) AS coll_pfx,
    UPPER(LEFT(REPLACE(REPLACE(
      COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(r.source_model_number, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(r.style_model, ''))), ''),
        'UNK'
      ), '-', ''), ' ', ''), 8)) AS model_pfx,
    UPPER(LEFT(REPLACE(ISNULL(r.colour_code, '00'), ' ', ''), 3)) AS col_pfx
  FROM resolved r
  WHERE NULLIF(r.resolved_brand, '') IS NOT NULL
    AND UPPER(LEFT(COALESCE(NULLIF(r.resolved_brand, ''), 'GEN'), 3)) <> 'GEN'
)
UPDATE sk
SET
  sku_code   = c.brand_pfx + '-' + c.coll_pfx + '-' + c.model_pfx + '-' + c.col_pfx,
  pid        = c.brand_pfx + '-' + c.coll_pfx + '-' + c.model_pfx + '-' + c.col_pfx + '-P' + CAST(c.header_id AS VARCHAR(20)),
  barcode    = c.brand_pfx + '-' + c.coll_pfx + '-' + c.model_pfx + '-' + c.col_pfx + '-P' + CAST(c.header_id AS VARCHAR(20)),
  updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
OUTPUT
  inserted.sku_id,
  deleted.sku_code AS old_sku_code,
  inserted.sku_code AS new_sku_code,
  deleted.pid AS old_pid,
  inserted.pid AS new_pid
FROM dbo.skus sk
JOIN calc c ON c.sku_id = sk.sku_id;

GO
