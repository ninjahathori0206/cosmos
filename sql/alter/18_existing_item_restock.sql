USE [CosmosERP];
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 18: Existing item restock flow
-- Link purchase colours to an existing SKU instead of always creating a new one
-- ─────────────────────────────────────────────────────────────────────────────

IF NOT EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.purchase_item_colours')
    AND name = 'linked_sku_id'
)
BEGIN
  ALTER TABLE dbo.purchase_item_colours ADD linked_sku_id INT NULL;
  PRINT 'Added purchase_item_colours.linked_sku_id';
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_pic_linked_sku'
    AND parent_object_id = OBJECT_ID('dbo.purchase_item_colours')
)
BEGIN
  ALTER TABLE dbo.purchase_item_colours
    ADD CONSTRAINT FK_pic_linked_sku
    FOREIGN KEY (linked_sku_id) REFERENCES dbo.skus(sku_id);
  PRINT 'Added FK_pic_linked_sku';
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_pic_linked_sku'
    AND object_id = OBJECT_ID('dbo.purchase_item_colours')
)
BEGIN
  CREATE INDEX IX_pic_linked_sku ON dbo.purchase_item_colours(linked_sku_id);
  PRINT 'Created IX_pic_linked_sku';
END;
GO

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
    IF NOT EXISTS (
      SELECT 1
      FROM dbo.purchase_headers
      WHERE header_id = @header_id
        AND pipeline_status = 'PENDING_DIGITISATION'
    )
    BEGIN
      RAISERROR('SKU processing only allowed at PENDING_DIGITISATION stage.',16,1);
      RETURN;
    END;

    DECLARE @linked_sku_id INT;

    SELECT @linked_sku_id = pic.linked_sku_id
    FROM dbo.purchase_item_colours pic
    JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
    WHERE pic.colour_id = @item_colour_id
      AND pi.item_id = @item_id
      AND pi.header_id = @header_id;

    IF @linked_sku_id IS NOT NULL
    BEGIN
      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        pi.purchase_rate AS cost_price,
        sk.sale_price,
        sk.status,
        pic.colour_id AS item_colour_id,
        COALESCE(sk.image_url, pic.image_url) AS image_url,
        COALESCE(sk.video_url, pic.video_url) AS video_url,
        pm.product_id AS product_master_id,
        pm.ew_collection,
        pm.style_model,
        pm.product_type AS pm_product_type,
        pm.description,
        pm.frame_width,
        pm.lens_height,
        pm.temple_length,
        pm.frame_material,
        hb.brand_name,
        pic.colour_name,
        pic.colour_code,
        pi.item_id,
        CAST(1 AS BIT) AS is_restock,
        'RESTOCK_EXISTING' AS stock_action
      FROM dbo.purchase_item_colours pic
      JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      WHERE pic.colour_id = @item_colour_id
        AND pi.item_id = @item_id
        AND pi.header_id = @header_id;
      RETURN;
    END;

    IF EXISTS (
      SELECT 1
      FROM dbo.skus
      WHERE header_id = @header_id
        AND item_id = @item_id
        AND item_colour_id = @item_colour_id
    )
    BEGIN
      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        sk.cost_price,
        sk.sale_price,
        sk.status,
        sk.item_colour_id,
        COALESCE(sk.image_url, pic.image_url) AS image_url,
        COALESCE(sk.video_url, pic.video_url) AS video_url,
        pm.product_id AS product_master_id,
        pm.ew_collection,
        pm.style_model,
        pm.product_type AS pm_product_type,
        pm.description,
        pm.frame_width,
        pm.lens_height,
        pm.temple_length,
        pm.frame_material,
        hb.brand_name,
        pic.colour_name,
        pic.colour_code,
        sk.item_id,
        CAST(0 AS BIT) AS is_restock,
        'NEW_SKU' AS stock_action
      FROM dbo.skus sk
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
      WHERE sk.header_id = @header_id
        AND sk.item_id = @item_id
        AND sk.item_colour_id = @item_colour_id;
      RETURN;
    END;

    DECLARE @product_master_id INT;
    DECLARE @maker_master_id INT;
    DECLARE @source_brand VARCHAR(200);
    DECLARE @source_model_number VARCHAR(200);
    DECLARE @cost_price DECIMAL(10,2);
    DECLARE @quantity INT;
    DECLARE @ew_collection VARCHAR(200);
    DECLARE @colour_code VARCHAR(50);
    DECLARE @brand_name VARCHAR(200);
    DECLARE @colour_image_url VARCHAR(500);
    DECLARE @colour_video_url VARCHAR(500);
    DECLARE @existing_sku_id INT;

    SELECT
      @product_master_id = pi.product_master_id,
      @maker_master_id   = pm.maker_master_id,
      @source_brand      = pm.source_brand,
      @source_model_number = pm.source_model_number,
      @cost_price        = pi.purchase_rate,
      @quantity          = pic.quantity,
      @ew_collection     = pm.ew_collection,
      @colour_code       = pic.colour_code,
      @brand_name        = hb.brand_name,
      @colour_image_url  = pic.image_url,
      @colour_video_url  = pic.video_url
    FROM dbo.purchase_items pi
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = @item_colour_id AND pic.item_id = @item_id
    JOIN dbo.product_master pm ON pm.product_id = pi.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    WHERE pi.item_id = @item_id
      AND pi.header_id = @header_id;

    IF @product_master_id IS NULL
      THROW 50001, 'Purchase item not found for SKU processing.', 1;

    SELECT TOP 1
      @existing_sku_id = sk.sku_id
    FROM dbo.skus sk
    JOIN dbo.product_master epm ON epm.product_id = sk.product_master_id
    LEFT JOIN dbo.purchase_item_colours epc ON epc.colour_id = sk.item_colour_id
    WHERE sk.status = 'LIVE'
      AND UPPER(LTRIM(RTRIM(ISNULL(epc.colour_code, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@colour_code, ''))))
      AND (
        sk.product_master_id = @product_master_id
        OR (
          @maker_master_id IS NOT NULL
          AND epm.maker_master_id = @maker_master_id
          AND UPPER(LTRIM(RTRIM(ISNULL(epm.source_brand, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@source_brand, ''))))
          AND UPPER(LTRIM(RTRIM(ISNULL(epm.source_model_number, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@source_model_number, ''))))
        )
      )
    ORDER BY
      CASE WHEN sk.product_master_id = @product_master_id THEN 1 ELSE 0 END DESC,
      sk.updated_at DESC,
      sk.sku_id DESC;

    IF @existing_sku_id IS NOT NULL
    BEGIN
      UPDATE dbo.purchase_item_colours
      SET linked_sku_id = @existing_sku_id
      WHERE colour_id = @item_colour_id;

      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        pi.purchase_rate AS cost_price,
        sk.sale_price,
        sk.status,
        pic.colour_id AS item_colour_id,
        COALESCE(sk.image_url, pic.image_url) AS image_url,
        COALESCE(sk.video_url, pic.video_url) AS video_url,
        pm.product_id AS product_master_id,
        pm.ew_collection,
        pm.style_model,
        pm.product_type AS pm_product_type,
        pm.description,
        pm.frame_width,
        pm.lens_height,
        pm.temple_length,
        pm.frame_material,
        hb.brand_name,
        pic.colour_name,
        pic.colour_code,
        pi.item_id,
        CAST(1 AS BIT) AS is_restock,
        'RESTOCK_EXISTING' AS stock_action
      FROM dbo.purchase_item_colours pic
      JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      WHERE pic.colour_id = @item_colour_id
        AND pi.item_id = @item_id
        AND pi.header_id = @header_id;
      RETURN;
    END;

    DECLARE @brandPfx VARCHAR(10) = UPPER(LEFT(ISNULL(@brand_name, 'GEN'), 3));
    DECLARE @collPfx  VARCHAR(10) = UPPER(LEFT(REPLACE(ISNULL(@ew_collection, 'XX'), ' ', ''), 4));
    DECLARE @colPfx   VARCHAR(6)  = UPPER(LEFT(REPLACE(ISNULL(@colour_code, '00'), ' ', ''), 3));
    DECLARE @seq      INT;

    SELECT @seq = ISNULL(MAX(sku_id), 0) + 1 FROM dbo.skus;

    DECLARE @skuCode VARCHAR(50) = @brandPfx + '-' + @collPfx + '-' + @colPfx + '-' + RIGHT('0000' + CAST(@seq AS VARCHAR), 4);
    DECLARE @barcode VARCHAR(50) = 'EWS-' + @brandPfx + '-' + @colPfx + '-' + RIGHT('0000' + CAST(@seq AS VARCHAR), 4);

    INSERT INTO dbo.skus
      (product_master_id, sku_code, barcode, quantity, cost_price, sale_price,
       status, created_at, updated_at, header_id, item_id, item_colour_id, image_url, video_url)
    VALUES
      (@product_master_id, @skuCode, @barcode, @quantity, @cost_price, @sale_price,
       'LIVE', GETDATE(), GETDATE(), @header_id, @item_id, @item_colour_id, @colour_image_url, @colour_video_url);

    SELECT
      sk.sku_id,
      sk.sku_code,
      sk.barcode,
      pic.quantity,
      sk.cost_price,
      sk.sale_price,
      sk.status,
      sk.item_colour_id,
      COALESCE(sk.image_url, pic.image_url) AS image_url,
      COALESCE(sk.video_url, pic.video_url) AS video_url,
      pm.product_id AS product_master_id,
      pm.ew_collection,
      pm.style_model,
      pm.product_type AS pm_product_type,
      pm.description,
      pm.frame_width,
      pm.lens_height,
      pm.temple_length,
      pm.frame_material,
      hb.brand_name,
      pic.colour_name,
      pic.colour_code,
      sk.item_id,
      CAST(0 AS BIT) AS is_restock,
      'NEW_SKU' AS stock_action
    FROM dbo.skus sk
    JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
    WHERE sk.sku_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_GetSKUs','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_GetSKUs;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_GetSKUs @header_id INT
AS BEGIN
  SET NOCOUNT ON;

  SELECT
    sk.sku_id,
    sk.sku_code,
    sk.barcode,
    pic.quantity,
    sk.cost_price,
    sk.sale_price,
    sk.status,
    sk.item_colour_id,
    COALESCE(sk.image_url, pic.image_url) AS image_url,
    COALESCE(sk.video_url, pic.video_url) AS video_url,
    pm.product_id AS product_master_id,
    pm.ew_collection,
    pm.style_model,
    pm.product_type AS pm_product_type,
    pm.description,
    pm.frame_width,
    pm.lens_height,
    pm.temple_length,
    pm.frame_material,
    hb.brand_name,
    pic.colour_name,
    pic.colour_code,
    sk.item_id,
    CAST(0 AS BIT) AS is_restock,
    'NEW_SKU' AS stock_action
  FROM dbo.skus sk
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  WHERE sk.header_id = @header_id

  UNION ALL

  SELECT
    sk.sku_id,
    sk.sku_code,
    sk.barcode,
    pic.quantity,
    pi.purchase_rate AS cost_price,
    sk.sale_price,
    sk.status,
    pic.colour_id AS item_colour_id,
    COALESCE(sk.image_url, pic.image_url) AS image_url,
    COALESCE(sk.video_url, pic.video_url) AS video_url,
    pm.product_id AS product_master_id,
    pm.ew_collection,
    pm.style_model,
    pm.product_type AS pm_product_type,
    pm.description,
    pm.frame_width,
    pm.lens_height,
    pm.temple_length,
    pm.frame_material,
    hb.brand_name,
    pic.colour_name,
    pic.colour_code,
    pi.item_id,
    CAST(1 AS BIT) AS is_restock,
    'RESTOCK_EXISTING' AS stock_action
  FROM dbo.purchase_item_colours pic
  JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
  JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  WHERE pi.header_id = @header_id
    AND pic.linked_sku_id IS NOT NULL

  ORDER BY item_id, item_colour_id;
END;
GO

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

  SELECT
    pi.*,
    pm.ew_collection,
    pm.style_model,
    pm.source_type,
    pm.branding_required,
    pm.source_brand,
    pm.source_collection,
    pm.home_brand_id,
    pm.description,
    pm.frame_width,
    pm.lens_height,
    pm.temple_length,
    pm.frame_material,
    pm.image_url,
    hb.brand_name,
    mk.maker_name
  FROM dbo.purchase_items pi
  LEFT JOIN dbo.product_master pm ON pi.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mk ON pi.maker_master_id = mk.maker_id
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id;

  SELECT
    pic.*,
    pi.header_id,
    sk.sku_code AS linked_sku_code,
    sk.barcode AS linked_barcode,
    sk.sale_price AS linked_sale_price,
    sk.status AS linked_sku_status,
    ISNULL(sb.qty, 0) AS linked_stock_qty
  FROM dbo.purchase_item_colours pic
  JOIN dbo.purchase_items pi ON pic.item_id = pi.item_id
  LEFT JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
  LEFT JOIN dbo.stock_balances sb
    ON sb.sku_id = pic.linked_sku_id
   AND sb.location_type = 'WAREHOUSE'
  WHERE pi.header_id = @header_id
  ORDER BY pi.item_id, pic.colour_id;
END;
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_WarehouseReady','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_PurchaseHeader_WarehouseReady;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_WarehouseReady @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (
      SELECT 1
      FROM dbo.purchase_headers
      WHERE header_id = @header_id
        AND pipeline_status = 'PENDING_DIGITISATION'
    )
    BEGIN
      RAISERROR('Warehouse ready only allowed at PENDING_DIGITISATION stage.',16,1);
      RETURN;
    END;

    UPDATE dbo.skus
    SET status = 'LIVE',
        updated_at = GETDATE()
    WHERE header_id = @header_id;

    UPDATE dbo.purchase_headers
    SET pipeline_status = 'WAREHOUSE_READY',
        warehouse_at = GETDATE(),
        updated_at = GETDATE()
    WHERE header_id = @header_id;

    -- New SKU lines: create or increase warehouse stock for SKUs created by this purchase.
    UPDATE sb
    SET sb.qty = sb.qty + pic.quantity,
        sb.last_updated = GETDATE()
    FROM dbo.stock_balances sb
    JOIN dbo.skus sk
      ON sk.sku_id = sb.sku_id
     AND sk.header_id = @header_id
     AND sb.location_type = 'WAREHOUSE'
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id;

    INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, qty, last_updated)
    SELECT sk.sku_id, 'WAREHOUSE', 1, pic.quantity, GETDATE()
    FROM dbo.skus sk
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
    WHERE sk.header_id = @header_id
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.stock_balances sb
        WHERE sb.sku_id = sk.sku_id
          AND sb.location_type = 'WAREHOUSE'
      );

    -- Restock lines: increase total purchased qty and warehouse stock on the linked SKU.
    UPDATE sk
    SET sk.quantity = ISNULL(sk.quantity, 0) + pic.quantity,
        sk.updated_at = GETDATE()
    FROM dbo.skus sk
    JOIN dbo.purchase_item_colours pic ON pic.linked_sku_id = sk.sku_id
    JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
    WHERE pi.header_id = @header_id
      AND pic.linked_sku_id IS NOT NULL;

    UPDATE sb
    SET sb.qty = sb.qty + pic.quantity,
        sb.last_updated = GETDATE()
    FROM dbo.stock_balances sb
    JOIN dbo.purchase_item_colours pic
      ON pic.linked_sku_id = sb.sku_id
     AND sb.location_type = 'WAREHOUSE'
    JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
    WHERE pi.header_id = @header_id
      AND pic.linked_sku_id IS NOT NULL;

    INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, qty, last_updated)
    SELECT pic.linked_sku_id, 'WAREHOUSE', 1, pic.quantity, GETDATE()
    FROM dbo.purchase_item_colours pic
    JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
    WHERE pi.header_id = @header_id
      AND pic.linked_sku_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.stock_balances sb
        WHERE sb.sku_id = pic.linked_sku_id
          AND sb.location_type = 'WAREHOUSE'
      );

    SELECT header_id, pipeline_status, warehouse_at
    FROM dbo.purchase_headers
    WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO
