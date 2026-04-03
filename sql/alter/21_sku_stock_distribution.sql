USE [CosmosERP];

-- sp_SKU_StockSearch: search live SKUs for the Stock Distribution picker
IF OBJECT_ID('dbo.sp_SKU_StockSearch','P') IS NOT NULL DROP PROCEDURE dbo.sp_SKU_StockSearch;
GO
CREATE PROCEDURE dbo.sp_SKU_StockSearch
  @q     VARCHAR(200) = NULL,
  @top_n INT          = 20
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @lim    INT          = CASE WHEN ISNULL(@top_n,0) BETWEEN 1 AND 100 THEN @top_n ELSE 20 END;
  DECLARE @search VARCHAR(202) = CASE
    WHEN ISNULL(LTRIM(RTRIM(@q)),'') = '' THEN NULL
    ELSE '%' + LTRIM(RTRIM(@q)) + '%'
  END;

  SELECT TOP (@lim)
    sk.sku_id,
    sk.sku_code,
    sk.barcode,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    pm.ew_collection,
    pm.style_model,
    pm.product_type,
    ISNULL(hb.brand_name, mm.maker_name) AS brand_name,
    ISNULL(pic.colour_name,'') AS colour_name,
    ISNULL(pic.colour_code,'') AS colour_code,
    sk.sale_price,
    sk.status,
    ISNULL((SELECT SUM(sb2.qty) FROM dbo.stock_balances sb2 WHERE sb2.sku_id = sk.sku_id), 0)                          AS total_stock,
    ISNULL((SELECT sb3.qty FROM dbo.stock_balances sb3 WHERE sb3.sku_id = sk.sku_id AND sb3.location_type = 'WAREHOUSE'), 0) AS warehouse_qty
  FROM dbo.skus sk
  JOIN  dbo.product_master       pm  ON sk.product_master_id  = pm.product_id
  LEFT JOIN dbo.home_brands      hb  ON pm.home_brand_id      = hb.brand_id
  LEFT JOIN dbo.maker_master     mm  ON pm.maker_master_id    = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  WHERE sk.status IN ('LIVE','ACTIVE')
    AND (
      @search IS NULL
      OR sk.sku_code              LIKE @search
      OR sk.barcode               LIKE @search
      OR pm.ew_collection         LIKE @search
      OR pm.style_model           LIKE @search
      OR ISNULL(hb.brand_name,'') LIKE @search
      OR ISNULL(pic.colour_name,'') LIKE @search
    )
  ORDER BY
    ISNULL((SELECT SUM(sb2.qty) FROM dbo.stock_balances sb2 WHERE sb2.sku_id = sk.sku_id), 0) DESC,
    sk.sku_id DESC;
END;
GO

-- sp_SKU_StockDistribution: returns full per-location stock breakdown for one SKU
IF OBJECT_ID('dbo.sp_SKU_StockDistribution','P') IS NOT NULL DROP PROCEDURE dbo.sp_SKU_StockDistribution;
GO
CREATE PROCEDURE dbo.sp_SKU_StockDistribution
  @sku_id INT
AS
BEGIN
  SET NOCOUNT ON;

  -- Result set 1: SKU header
  SELECT
    sk.sku_id,
    sk.sku_code,
    sk.barcode,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    pm.ew_collection,
    pm.style_model,
    pm.product_type,
    ISNULL(hb.brand_name, mm.maker_name) AS brand_name,
    ISNULL(pic.colour_name,'') AS colour_name,
    ISNULL(pic.colour_code,'') AS colour_code,
    sk.sale_price,
    sk.cost_price,
    sk.status,
    ISNULL((SELECT SUM(sb2.qty) FROM dbo.stock_balances sb2 WHERE sb2.sku_id = sk.sku_id), 0) AS total_stock
  FROM dbo.skus sk
  JOIN  dbo.product_master       pm  ON sk.product_master_id  = pm.product_id
  LEFT JOIN dbo.home_brands      hb  ON pm.home_brand_id      = hb.brand_id
  LEFT JOIN dbo.maker_master     mm  ON pm.maker_master_id    = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  WHERE sk.sku_id = @sku_id;

  -- Result set 2: per-location balances (only locations with qty > 0)
  SELECT
    sb.balance_id,
    sb.location_type,
    sb.location_id,
    ISNULL(sb.location_name,
      CASE sb.location_type
        WHEN 'WAREHOUSE' THEN 'HQ Warehouse'
        ELSE sb.location_type + ' ' + CAST(sb.location_id AS VARCHAR(20))
      END
    ) AS location_name,
    sb.qty,
    CONVERT(VARCHAR(20), sb.last_updated, 106) AS last_updated
  FROM dbo.stock_balances sb
  WHERE sb.sku_id = @sku_id
    AND sb.qty > 0
  ORDER BY
    CASE sb.location_type WHEN 'WAREHOUSE' THEN 0 ELSE 1 END,
    sb.location_name;
END;
GO
