USE [CosmosERP];

-- Add product detail / catalogue fields to product_master
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='product_master' AND COLUMN_NAME='description')
  ALTER TABLE dbo.product_master ADD description VARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='product_master' AND COLUMN_NAME='frame_width')
  ALTER TABLE dbo.product_master ADD frame_width DECIMAL(5,1) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='product_master' AND COLUMN_NAME='lens_height')
  ALTER TABLE dbo.product_master ADD lens_height DECIMAL(5,1) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='product_master' AND COLUMN_NAME='temple_length')
  ALTER TABLE dbo.product_master ADD temple_length DECIMAL(5,1) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='product_master' AND COLUMN_NAME='frame_material')
  ALTER TABLE dbo.product_master ADD frame_material VARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='product_master' AND COLUMN_NAME='image_url')
  ALTER TABLE dbo.product_master ADD image_url VARCHAR(500) NULL;

GO

-- ═══ sp_ProductMaster_UpdateDetails  (called during Digitisation stage) ═══
IF OBJECT_ID('dbo.sp_ProductMaster_UpdateDetails','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_UpdateDetails;
GO
CREATE PROCEDURE dbo.sp_ProductMaster_UpdateDetails
  @product_id     INT,
  @description    VARCHAR(500) = NULL,
  @frame_width    DECIMAL(5,1) = NULL,
  @lens_height    DECIMAL(5,1) = NULL,
  @temple_length  DECIMAL(5,1) = NULL,
  @frame_material VARCHAR(100) = NULL,
  @image_url      VARCHAR(500) = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    UPDATE dbo.product_master SET
      description    = @description,
      frame_width    = @frame_width,
      lens_height    = @lens_height,
      temple_length  = @temple_length,
      frame_material = @frame_material,
      image_url      = ISNULL(@image_url, image_url),
      updated_at     = GETDATE()
    WHERE product_id = @product_id;
    SELECT product_id, description, frame_width, lens_height, temple_length, frame_material, image_url
    FROM dbo.product_master WHERE product_id = @product_id;
  END TRY
  BEGIN CATCH THROW; END CATCH;
END;
GO

-- ═══ sp_SKU_GetAll  (SKU Catalogue page) ═══
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
    pm.temple_length, pm.frame_material, pm.image_url,
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

-- ═══ Update sp_PurchaseHeader_GetById to include new product detail fields ═══
IF OBJECT_ID('dbo.sp_PurchaseHeader_GetById','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_GetById;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetById @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  -- RS0: header
  SELECT h.*, s.vendor_name AS supplier_name
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON h.supplier_id = s.supplier_id
  WHERE h.header_id = @header_id;
  -- RS1: items (includes new product detail fields)
  SELECT pi.*, pm.ew_collection, pm.style_model, pm.source_type, pm.branding_required,
         pm.source_brand, pm.source_collection, pm.home_brand_id,
         pm.description, pm.frame_width, pm.lens_height, pm.temple_length, pm.frame_material,
         hb.brand_name, mk.maker_name
  FROM dbo.purchase_items pi
  LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb    ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mk   ON pi.maker_master_id = mk.maker_id
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id;
  -- RS2: colours
  SELECT pic.*, pi.header_id
  FROM dbo.purchase_item_colours pic
  JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id, pic.colour_id;
END;
GO
