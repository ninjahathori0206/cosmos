-- Migration 64: expose reading_power on SKU list procs (label print {power} token)
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_SKU_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKU_GetAll;
GO

CREATE PROCEDURE dbo.sp_SKU_GetAll
  @q            VARCHAR(200) = NULL,
  @brand_id     INT          = NULL,
  @product_type VARCHAR(50)  = NULL,
  @status       VARCHAR(30)  = NULL
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    sk.sku_id, sk.sku_code, sk.barcode,
    sk.quantity AS total_qty, sk.cost_price, sk.sale_price,
    sk.status, sk.created_at,
    sk.reading_power,
    pm.product_id, pm.ew_collection, pm.style_model,
    pm.product_type AS pm_product_type,
    pm.description, pm.frame_width, pm.lens_height,
    pm.temple_length, pm.frame_material,
    COALESCE(
      NULLIF(LTRIM(RTRIM(sk.image_url)), ''),
      NULLIF(LTRIM(RTRIM(pic.image_url)), ''),
      pm.image_url
    ) AS image_url,
    COALESCE(
      NULLIF(LTRIM(RTRIM(sk.video_url)), ''),
      NULLIF(LTRIM(RTRIM(pic.video_url)), ''),
      NULL
    ) AS video_url,
    hb.brand_id,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    pic.colour_name, pic.colour_code,
    ISNULL(sb.qty, 0) AS warehouse_qty,
    ISNULL(sb.qty, 0) AS stock_qty
  FROM dbo.skus sk
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mm ON pm.maker_master_id = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sk.sku_id = sb.sku_id
   AND sb.location_type = N'WAREHOUSE'
   AND sb.location_id = dbo.fn_Foundry_PrimaryWarehouseLocationId()
  WHERE (ISNULL(@status,'') = '' OR sk.status = @status)
    AND (ISNULL(@q,'') = ''
         OR sk.sku_code        LIKE '%'+@q+'%'
         OR pm.ew_collection   LIKE '%'+@q+'%'
         OR pm.style_model     LIKE '%'+@q+'%'
         OR ISNULL(hb.brand_name,'') LIKE '%'+@q+'%'
         OR ISNULL(pm.source_brand,'') LIKE '%'+@q+'%'
         OR ISNULL(mm.maker_name,'') LIKE '%'+@q+'%')
    AND (ISNULL(@brand_id,0) = 0 OR pm.home_brand_id = @brand_id)
    AND (ISNULL(@product_type,'') = '' OR pm.product_type = @product_type)
  ORDER BY sk.sku_id DESC;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_GetSKUs', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_GetSKUs;
GO

CREATE PROCEDURE dbo.sp_PurchaseHeader_GetSKUs @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    sk.sku_id, sk.item_colour_id, sk.sku_code, sk.pid, sk.barcode, sk.sale_price, sk.status,
    sk.reading_power,
    pic.colour_name, pic.colour_code, pic.quantity,
    pi.item_id,
    CASE WHEN pi.quantity > 0 AND pi.finance_payable_amt IS NOT NULL
      THEN ROUND(pi.finance_payable_amt / pi.quantity, 2) ELSE NULL END AS purchase_rate,
    pi.quantity AS item_qty,
    pm.ew_collection, pm.style_model,
    pm.product_type AS pm_product_type,
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
  WHERE sk.header_id = @header_id
  UNION ALL
  SELECT
    sk.sku_id, pic.colour_id AS item_colour_id, sk.sku_code, sk.pid, sk.barcode, sk.sale_price, sk.status,
    sk.reading_power,
    pic.colour_name, pic.colour_code, pic.quantity,
    pi.item_id,
    CASE WHEN pi.quantity > 0 AND pi.finance_payable_amt IS NOT NULL
      THEN ROUND(pi.finance_payable_amt / pi.quantity, 2) ELSE NULL END AS purchase_rate,
    pi.quantity AS item_qty,
    pm.ew_collection, pm.style_model,
    pm.product_type AS pm_product_type,
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
  WHERE pre.header_id = @header_id
  ORDER BY item_id, item_colour_id;
END;
GO
