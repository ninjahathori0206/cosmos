USE [CosmosERP];
GO

-- sp_SKU_GetAll (Foundry / StorePilot SKU Catalogue): display brand matches POS —
-- home brand when set; else source_brand (branding bypass / pre-branded); else maker.
-- Deploy: npm run migrate:39-sku-getall-display-brand

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
    pm.product_id, pm.ew_collection, pm.style_model,
    pm.product_type AS pm_product_type,
    pm.description, pm.frame_width, pm.lens_height,
    pm.temple_length, pm.frame_material,
    ISNULL(sk.image_url, pm.image_url) AS image_url,
    ISNULL(sk.video_url, pic.video_url) AS video_url,
    hb.brand_id,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    pic.colour_name, pic.colour_code,
    ISNULL(sb.qty, 0) AS stock_qty
  FROM dbo.skus sk
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mm ON pm.maker_master_id = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sk.sku_id = sb.sku_id AND sb.location_type = 'WAREHOUSE'
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
