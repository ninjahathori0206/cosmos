USE [CosmosERP];

-- Add per-colour video URL to purchase_item_colours
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='purchase_item_colours' AND COLUMN_NAME='video_url')
  ALTER TABLE dbo.purchase_item_colours ADD video_url VARCHAR(500) NULL;

-- Add per-SKU video URL to skus (copied from purchase_item_colours at generation)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='skus' AND COLUMN_NAME='video_url')
  ALTER TABLE dbo.skus ADD video_url VARCHAR(500) NULL;

GO

-- ═══ sp_PurchaseItemColour_SetMedia — saves image_url and/or video_url for a colour ═══
IF OBJECT_ID('dbo.sp_PurchaseItemColour_SetMedia','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseItemColour_SetMedia;
GO
CREATE PROCEDURE dbo.sp_PurchaseItemColour_SetMedia
  @colour_id INT,
  @image_url VARCHAR(500) = NULL,
  @video_url VARCHAR(500) = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.purchase_item_colours SET
      image_url = ISNULL(@image_url, image_url),
      video_url = ISNULL(@video_url, video_url)
    WHERE colour_id = @colour_id;
    SELECT colour_id, colour_name, colour_code, image_url, video_url
    FROM dbo.purchase_item_colours WHERE colour_id = @colour_id;
  END TRY
  BEGIN CATCH THROW; END CATCH;
END;
GO

-- ═══ sp_SKUv2_Generate — carry video_url from purchase_item_colours ═══
IF OBJECT_ID('dbo.sp_SKUv2_Generate','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKUv2_Generate;
GO
CREATE PROCEDURE dbo.sp_SKUv2_Generate
  @header_id      INT,
  @item_id        INT,
  @item_colour_id INT,
  @sale_price     DECIMAL(10,2)
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.skus WHERE header_id=@header_id AND item_id=@item_id AND item_colour_id=@item_colour_id)
    BEGIN
      SELECT * FROM dbo.skus WHERE header_id=@header_id AND item_id=@item_id AND item_colour_id=@item_colour_id;
      RETURN;
    END

    DECLARE @product_master_id INT, @cost_price DECIMAL(10,2), @quantity INT;
    DECLARE @ew_collection VARCHAR(200), @style_model VARCHAR(200), @colour_code VARCHAR(50);
    DECLARE @brand_name VARCHAR(200), @colour_image_url VARCHAR(500), @colour_video_url VARCHAR(500);

    SELECT
      @product_master_id = pi.product_master_id,
      @cost_price        = pi.purchase_rate,
      @quantity          = pic.quantity,
      @ew_collection     = pm.ew_collection,
      @style_model       = pm.style_model,
      @colour_code       = pic.colour_code,
      @brand_name        = hb.brand_name,
      @colour_image_url  = pic.image_url,
      @colour_video_url  = pic.video_url
    FROM dbo.purchase_items pi
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = @item_colour_id AND pic.item_id = @item_id
    JOIN dbo.product_master pm ON pm.product_id = pi.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    WHERE pi.item_id = @item_id AND pi.header_id = @header_id;

    IF @product_master_id IS NULL
      THROW 50001, 'Purchase item not found for SKU generation.', 1;

    DECLARE @brandPfx VARCHAR(10) = UPPER(LEFT(ISNULL(@brand_name,'GEN'), 3));
    DECLARE @collPfx  VARCHAR(10) = UPPER(LEFT(REPLACE(ISNULL(@ew_collection,'XX'),' ',''), 4));
    DECLARE @colPfx   VARCHAR(6)  = UPPER(LEFT(REPLACE(ISNULL(@colour_code,'00'),' ',''), 3));
    DECLARE @seq      INT;
    SELECT @seq = ISNULL(MAX(sku_id),0)+1 FROM dbo.skus;
    DECLARE @skuCode VARCHAR(50) = @brandPfx + '-' + @collPfx + '-' + @colPfx + '-' + RIGHT('0000'+CAST(@seq AS VARCHAR),4);
    DECLARE @barcode VARCHAR(50) = 'EWS-' + @brandPfx + '-' + @colPfx + '-' + RIGHT('0000'+CAST(@seq AS VARCHAR),4);

    INSERT INTO dbo.skus
      (product_master_id, sku_code, barcode, quantity, cost_price, sale_price,
       status, created_at, header_id, item_id, item_colour_id, image_url, video_url)
    VALUES
      (@product_master_id, @skuCode, @barcode, @quantity, @cost_price, @sale_price,
       'LIVE', GETDATE(), @header_id, @item_id, @item_colour_id, @colour_image_url, @colour_video_url);

    SELECT * FROM dbo.skus WHERE sku_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH THROW; END CATCH;
END;
GO

-- ═══ sp_PurchaseHeader_GetSKUs — include video_url ═══
IF OBJECT_ID('dbo.sp_PurchaseHeader_GetSKUs','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_GetSKUs;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetSKUs @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    sk.sku_id, sk.sku_code, sk.barcode, sk.quantity, sk.cost_price, sk.sale_price,
    sk.status, sk.item_colour_id, sk.image_url, sk.video_url,
    pm.product_id AS product_master_id, pm.ew_collection, pm.style_model,
    pm.description, pm.frame_width, pm.lens_height, pm.temple_length, pm.frame_material,
    hb.brand_name,
    pic.colour_name, pic.colour_code, pic.image_url AS colour_image_url, pic.video_url AS colour_video_url
  FROM dbo.skus sk
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  WHERE sk.header_id = @header_id
  ORDER BY sk.sku_id;
END;
GO

-- ═══ sp_PurchaseHeader_GetById — include video_url in RS2 (colours) ═══
IF OBJECT_ID('dbo.sp_PurchaseHeader_GetById','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_GetById;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetById @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT h.*, s.vendor_name AS supplier_name
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
  WHERE h.header_id = @header_id;

  SELECT pi.*, pm.ew_collection, pm.style_model, pm.source_type, pm.branding_required,
         pm.source_brand, pm.source_collection, pm.home_brand_id,
         pm.description, pm.frame_width, pm.lens_height, pm.temple_length, pm.frame_material, pm.image_url,
         hb.brand_name, mk.maker_name
  FROM dbo.purchase_items pi
  LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb    ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mk   ON pi.maker_master_id = mk.maker_id
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id;

  SELECT pic.*, pi.header_id
  FROM dbo.purchase_item_colours pic
  JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id, pic.colour_id;
END;
GO

-- ═══ sp_SKU_GetAll — include video_url (prefer sku-level, fallback to colour) ═══
IF OBJECT_ID('dbo.sp_SKU_GetAll','P') IS NOT NULL
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
    hb.brand_id, hb.brand_name,
    pic.colour_name, pic.colour_code,
    ISNULL(sb.qty, 0) AS stock_qty
  FROM dbo.skus sk
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sk.sku_id = sb.sku_id AND sb.location_type = 'WAREHOUSE'
  WHERE (ISNULL(@status,'') = '' OR sk.status = @status)
    AND (ISNULL(@q,'') = ''
         OR sk.sku_code        LIKE '%'+@q+'%'
         OR pm.ew_collection   LIKE '%'+@q+'%'
         OR pm.style_model     LIKE '%'+@q+'%'
         OR ISNULL(hb.brand_name,'') LIKE '%'+@q+'%')
    AND (ISNULL(@brand_id,0) = 0 OR pm.home_brand_id = @brand_id)
    AND (ISNULL(@product_type,'') = '' OR pm.product_type = @product_type)
  ORDER BY sk.sku_id DESC;
END;
GO
