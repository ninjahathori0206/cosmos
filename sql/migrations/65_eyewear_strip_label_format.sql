/*
  Migration 65 — Eyewear strip label format + brand_name on purchase SKUs

  Deploy: npm run migrate:65-eyewear-strip-label
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 65: eyewear_strip label + GetSKUs brand_name';
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.label_print_formats WHERE format_key = N'eyewear_strip_12x100')
BEGIN
  INSERT INTO dbo.label_print_formats (format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at)
  VALUES (
    N'eyewear_strip_12x100',
    N'Eyewear strip 12×100',
    N'Frame wrap — 66 mm print (QR + brand) + 34 mm tail',
    N'{"v":1,"marginTop":0,"marginBottom":0,"marginLeft":0,"marginRight":0,"gapRow":0,"gapCol":0,"labelWidthMm":100,"labelHeightMm":12,"labelsPerRow":1,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0.06,"textTopRatio":0.72,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":4,"layoutType":"strip","printWidthMm":66,"zone1WidthMm":33,"zone2WidthMm":33,"tailWidthMm":34}',
    0,
    30,
    1,
    @now,
    @now
  );
  PRINT N'Migration 65: seeded eyewear_strip_12x100';
END
ELSE
  PRINT N'Migration 65: eyewear_strip_12x100 already exists — skipped seed';
GO

IF OBJECT_ID(N'dbo.sp_PurchaseHeader_GetSKUs', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_GetSKUs;
GO

CREATE PROCEDURE dbo.sp_PurchaseHeader_GetSKUs @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    sk.sku_id, sk.item_colour_id, sk.sku_code, sk.pid, sk.barcode, sk.sale_price, sk.status,
    pic.colour_name, pic.colour_code, pic.quantity,
    pi.item_id,
    CASE WHEN pi.quantity > 0 AND pi.finance_payable_amt IS NOT NULL
      THEN ROUND(pi.finance_payable_amt / pi.quantity, 2) ELSE NULL END AS purchase_rate,
    pi.quantity AS item_qty,
    pm.ew_collection, pm.style_model,
    COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mk.maker_name, ''))), '')
    ) AS brand_name,
    sk.pid AS purchase_event_id,
    CAST(0 AS BIT) AS is_restock,
    'NEW_SKU' AS stock_action,
    COALESCE(
      NULLIF(LTRIM(RTRIM(sk.image_url)), ''),
      NULLIF(LTRIM(RTRIM(pic.image_url)), ''),
      pm.image_url
    ) AS image_url,
    COALESCE(
      NULLIF(LTRIM(RTRIM(sk.video_url)), ''),
      NULLIF(LTRIM(RTRIM(pic.video_url)), ''),
      NULL
    ) AS video_url
  FROM dbo.skus sk
  JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  JOIN dbo.purchase_items pi         ON pic.item_id = pi.item_id
  JOIN dbo.product_master pm         ON pi.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb       ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mk      ON pi.maker_master_id = mk.maker_id
  WHERE sk.header_id = @header_id
  UNION ALL
  SELECT
    sk.sku_id, pic.colour_id AS item_colour_id, sk.sku_code, sk.pid, sk.barcode, sk.sale_price, sk.status,
    pic.colour_name, pic.colour_code, pic.quantity,
    pi.item_id,
    CASE WHEN pi.quantity > 0 AND pi.finance_payable_amt IS NOT NULL
      THEN ROUND(pi.finance_payable_amt / pi.quantity, 2) ELSE NULL END AS purchase_rate,
    pi.quantity AS item_qty,
    pm.ew_collection, pm.style_model,
    COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mk.maker_name, ''))), '')
    ) AS brand_name,
    pre.purchase_event_id,
    CAST(1 AS BIT) AS is_restock,
    'RESTOCK_EXISTING' AS stock_action,
    COALESCE(
      NULLIF(LTRIM(RTRIM(sk.image_url)), ''),
      NULLIF(LTRIM(RTRIM(pic.image_url)), ''),
      pm.image_url
    ) AS image_url,
    COALESCE(
      NULLIF(LTRIM(RTRIM(sk.video_url)), ''),
      NULLIF(LTRIM(RTRIM(pic.video_url)), ''),
      NULL
    ) AS video_url
  FROM dbo.purchase_restock_events pre
  JOIN dbo.purchase_item_colours pic ON pic.colour_id = pre.item_colour_id
  JOIN dbo.purchase_items pi ON pi.item_id = pre.item_id
  JOIN dbo.skus sk ON sk.sku_id = pre.linked_sku_id
  JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mk ON pi.maker_master_id = mk.maker_id
  WHERE pre.header_id = @header_id
  ORDER BY item_id, item_colour_id;
END;
GO

PRINT N'Migration 65: complete.';
GO
