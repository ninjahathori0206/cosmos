USE [CosmosERP];
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 19: Prefer active duplicate product + duplicate-tolerant restock
-- ─────────────────────────────────────────────────────────────────────────────

IF OBJECT_ID('dbo.sp_ProductMaster_CheckRepeat', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_CheckRepeat;
GO
CREATE PROCEDURE dbo.sp_ProductMaster_CheckRepeat
  @ew_collection VARCHAR(200) = NULL,
  @style_model   VARCHAR(200) = NULL,
  @home_brand_id INT          = NULL,
  @source_brand  VARCHAR(200) = NULL,
  @source_model_number VARCHAR(200) = NULL,
  @maker_master_id INT        = NULL
AS
BEGIN
  SET NOCOUNT ON;

  SELECT TOP 1
    pm.product_id,
    pm.ew_collection,
    pm.style_model,
    pm.source_model_number,
    pm.source_collection,
    pm.branding_required,
    s.vendor_name AS maker_name,
    hb.brand_name,
    lp.last_rate,
    lp.last_qty,
    lp.last_purchase_date,
    ISNULL(pc.total_purchases, 0) AS total_purchases,
    ISNULL(ls.live_sku_count, 0) AS live_sku_count
  FROM dbo.product_master pm
  LEFT JOIN dbo.suppliers s ON pm.maker_id = s.supplier_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  OUTER APPLY (
    SELECT TOP 1
      p.purchase_rate AS last_rate,
      p.quantity AS last_qty,
      p.purchase_date AS last_purchase_date
    FROM dbo.purchases p
    WHERE p.product_master_id = pm.product_id
    ORDER BY p.purchase_date DESC, p.purchase_id DESC
  ) lp
  OUTER APPLY (
    SELECT COUNT(1) AS total_purchases
    FROM dbo.purchases p
    WHERE p.product_master_id = pm.product_id
  ) pc
  OUTER APPLY (
    SELECT COUNT(1) AS live_sku_count
    FROM dbo.skus sk
    WHERE sk.product_master_id = pm.product_id
      AND sk.status = 'LIVE'
  ) ls
  WHERE (
      @source_brand IS NOT NULL
      AND @source_model_number IS NOT NULL
      AND UPPER(LTRIM(RTRIM(ISNULL(pm.source_brand, '')))) = UPPER(LTRIM(RTRIM(@source_brand)))
      AND UPPER(LTRIM(RTRIM(ISNULL(pm.source_model_number, '')))) = UPPER(LTRIM(RTRIM(@source_model_number)))
      AND (@maker_master_id IS NULL OR pm.maker_master_id = @maker_master_id)
    )
    OR (
      @ew_collection IS NOT NULL
      AND @style_model IS NOT NULL
      AND pm.ew_collection = @ew_collection
      AND pm.style_model   = @style_model
      AND (
        (@home_brand_id IS NOT NULL AND pm.home_brand_id = @home_brand_id)
        OR (@source_brand IS NOT NULL AND pm.source_brand = @source_brand)
      )
    )
  ORDER BY
    ISNULL(ls.live_sku_count, 0) DESC,
    ISNULL(pc.total_purchases, 0) DESC,
    ISNULL(lp.last_purchase_date, pm.updated_at) DESC,
    pm.product_id DESC;
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

    DECLARE @product_master_id INT;
    DECLARE @maker_master_id INT;
    DECLARE @source_brand_match VARCHAR(200);
    DECLARE @source_model_match VARCHAR(200);
    DECLARE @cost_price DECIMAL(10,2);
    DECLARE @quantity INT;
    DECLARE @ew_collection VARCHAR(200);
    DECLARE @colour_code VARCHAR(50);
    DECLARE @brand_name VARCHAR(200);
    DECLARE @colour_image_url VARCHAR(500);
    DECLARE @colour_video_url VARCHAR(500);

    SELECT
      @product_master_id = pi.product_master_id,
      @maker_master_id = pm.maker_master_id,
      @source_brand_match = pm.source_brand,
      @source_model_match = pm.source_model_number,
      @cost_price = pi.purchase_rate,
      @quantity = pic.quantity,
      @ew_collection = pm.ew_collection,
      @colour_code = pic.colour_code,
      @brand_name = hb.brand_name,
      @colour_image_url = pic.image_url,
      @colour_video_url = pic.video_url
    FROM dbo.purchase_items pi
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = @item_colour_id AND pic.item_id = @item_id
    JOIN dbo.product_master pm ON pm.product_id = pi.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    WHERE pi.item_id = @item_id
      AND pi.header_id = @header_id;

    IF @product_master_id IS NULL
      THROW 50001, 'Purchase item not found for SKU processing.', 1;

    SELECT TOP 1
      @linked_sku_id = sk.sku_id
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
          AND UPPER(LTRIM(RTRIM(ISNULL(epm.source_brand, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@source_brand_match, ''))))
          AND UPPER(LTRIM(RTRIM(ISNULL(epm.source_model_number, '')))) = UPPER(LTRIM(RTRIM(ISNULL(@source_model_match, ''))))
        )
      )
    ORDER BY
      CASE WHEN sk.product_master_id = @product_master_id THEN 1 ELSE 0 END DESC,
      sk.updated_at DESC,
      sk.sku_id DESC;

    IF @linked_sku_id IS NOT NULL
    BEGIN
      UPDATE dbo.purchase_item_colours
      SET linked_sku_id = @linked_sku_id
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
