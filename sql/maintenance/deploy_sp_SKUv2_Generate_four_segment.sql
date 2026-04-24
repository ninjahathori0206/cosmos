-- One-shot deploy: restock-aware SKU generation with purchase-level restock IDs

IF OBJECT_ID('dbo.purchase_restock_events','U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_restock_events (
    event_id            INT IDENTITY(1,1) PRIMARY KEY,
    purchase_event_id   VARCHAR(80) NOT NULL UNIQUE,
    header_id           INT NOT NULL,
    item_id             INT NOT NULL,
    item_colour_id      INT NOT NULL,
    linked_sku_id       INT NOT NULL,
    sale_price_snapshot DECIMAL(10,2) NOT NULL,
    created_at          DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pre_header FOREIGN KEY (header_id) REFERENCES dbo.purchase_headers(header_id),
    CONSTRAINT FK_pre_item FOREIGN KEY (item_id) REFERENCES dbo.purchase_items(item_id),
    CONSTRAINT FK_pre_colour FOREIGN KEY (item_colour_id) REFERENCES dbo.purchase_item_colours(colour_id),
    CONSTRAINT FK_pre_sku FOREIGN KEY (linked_sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT UQ_pre_header_item_colour UNIQUE (header_id, item_id, item_colour_id)
  );
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
    DECLARE @purchase_event_id VARCHAR(80) = CONCAT('PRE-', @header_id, '-', @item_id, '-', @item_colour_id);

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
      IF NOT EXISTS (
        SELECT 1
        FROM dbo.purchase_restock_events
        WHERE header_id = @header_id
          AND item_id = @item_id
          AND item_colour_id = @item_colour_id
      )
      BEGIN
        INSERT INTO dbo.purchase_restock_events (
          purchase_event_id,
          header_id,
          item_id,
          item_colour_id,
          linked_sku_id,
          sale_price_snapshot
        )
        SELECT
          @purchase_event_id,
          @header_id,
          @item_id,
          @item_colour_id,
          pic.linked_sku_id,
          sk.sale_price
        FROM dbo.purchase_item_colours pic
        JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
        WHERE pic.colour_id = @item_colour_id;
      END;

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
        @purchase_event_id AS purchase_event_id,
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

      IF NOT EXISTS (
        SELECT 1
        FROM dbo.purchase_restock_events
        WHERE header_id = @header_id
          AND item_id = @item_id
          AND item_colour_id = @item_colour_id
      )
      BEGIN
        INSERT INTO dbo.purchase_restock_events (
          purchase_event_id,
          header_id,
          item_id,
          item_colour_id,
          linked_sku_id,
          sale_price_snapshot
        )
        SELECT
          @purchase_event_id,
          @header_id,
          @item_id,
          @item_colour_id,
          pic.linked_sku_id,
          sk.sale_price
        FROM dbo.purchase_item_colours pic
        JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
        WHERE pic.colour_id = @item_colour_id;
      END;

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
        @purchase_event_id AS purchase_event_id,
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
        sk.pid AS purchase_event_id,
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
       'LIVE', DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()), @header_id, @item_id, @item_colour_id, @colour_image_url, @colour_video_url);

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
      sk.pid AS purchase_event_id,
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
