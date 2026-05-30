-- Migration 63: sp_SKUv2_Generate — reading power in sku_code, barcode/pid, skus.reading_power
-- Patched from live proc; safe for current purchase_items schema (finance_payable_amt, purchase_rate).
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_SKUv2_Generate','P') IS NOT NULL DROP PROCEDURE dbo.sp_SKUv2_Generate;
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

        IF OBJECT_ID(N'dbo.sp_SKUv2_AllocateUnits', N'P') IS NOT NULL
        BEGIN
          DECLARE @restock_qty_a INT;
          SELECT @restock_qty_a = pic.quantity
          FROM dbo.purchase_item_colours pic
          WHERE pic.colour_id = @item_colour_id;
          EXEC dbo.sp_SKUv2_AllocateUnits @sku_id = @linked_sku_id, @qty = @restock_qty_a;
        END;
      END;

      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        CASE WHEN pi.quantity > 0 AND pi.finance_payable_amt IS NOT NULL
          THEN ROUND(pi.finance_payable_amt / pi.quantity, 2) ELSE NULL END AS cost_price,
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
        LTRIM(RTRIM(COALESCE(
          NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
          ''
        ))) AS brand_name,
        pic.colour_name,
        pic.colour_code,
        sk.reading_power,
        pi.item_id,
        @purchase_event_id AS purchase_event_id,
        CAST(1 AS BIT) AS is_restock,
        'RESTOCK_EXISTING' AS stock_action
      FROM dbo.purchase_item_colours pic
      JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
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
    DECLARE @brand_for_prefix VARCHAR(200);
    DECLARE @resolved_home_brand_id INT;
    DECLARE @source_model_number VARCHAR(200);
    DECLARE @style_model VARCHAR(200);
    DECLARE @colour_image_url VARCHAR(500);
    DECLARE @colour_video_url VARCHAR(500);
    DECLARE @reading_power VARCHAR(10);

    SELECT
      @product_master_id = pi.product_master_id,
      @maker_master_id = pm.maker_master_id,
      @source_brand_match = pm.source_brand,
      @source_model_match = pm.source_model_number,
      @cost_price = CASE WHEN pi.quantity > 0 AND pi.finance_payable_amt IS NOT NULL
        THEN ROUND(pi.finance_payable_amt / pi.quantity, 2) ELSE NULL END,
      @quantity = pic.quantity,
      @ew_collection = pm.ew_collection,
      @colour_code = pic.colour_code,
      @reading_power = NULLIF(LTRIM(RTRIM(pic.reading_power)), ''),
      @brand_for_prefix = LTRIM(RTRIM(COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_code, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
        ''
      ))),
      @brand_name = LTRIM(RTRIM(COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_code, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
        ''
      ))),
      @source_model_number = pm.source_model_number,
      @style_model = pm.style_model,
      @colour_image_url = pic.image_url,
      @colour_video_url = pic.video_url
    FROM dbo.purchase_items pi
    JOIN dbo.purchase_item_colours pic ON pic.colour_id = @item_colour_id AND pic.item_id = @item_id
    JOIN dbo.product_master pm ON pm.product_id = pi.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
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
      AND ISNULL(NULLIF(LTRIM(RTRIM(sk.reading_power)), ''), '') = ISNULL(@reading_power, '')
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

        IF OBJECT_ID(N'dbo.sp_SKUv2_AllocateUnits', N'P') IS NOT NULL
        BEGIN
          DECLARE @restock_qty_b INT;
          SELECT @restock_qty_b = pic.quantity
          FROM dbo.purchase_item_colours pic
          WHERE pic.colour_id = @item_colour_id;
          EXEC dbo.sp_SKUv2_AllocateUnits @sku_id = @linked_sku_id, @qty = @restock_qty_b;
        END;
      END;

      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        pic.quantity,
        CASE WHEN pi.quantity > 0 AND pi.finance_payable_amt IS NOT NULL
          THEN ROUND(pi.finance_payable_amt / pi.quantity, 2) ELSE NULL END AS cost_price,
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
        LTRIM(RTRIM(COALESCE(
          NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
          ''
        ))) AS brand_name,
        pic.colour_name,
        pic.colour_code,
        sk.reading_power,
        pi.item_id,
        @purchase_event_id AS purchase_event_id,
        CAST(1 AS BIT) AS is_restock,
        'RESTOCK_EXISTING' AS stock_action
      FROM dbo.purchase_item_colours pic
      JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
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
        LTRIM(RTRIM(COALESCE(
          NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
          ''
        ))) AS brand_name,
        pic.colour_name,
        pic.colour_code,
        sk.reading_power,
        sk.item_id,
        sk.pid AS purchase_event_id,
        CAST(0 AS BIT) AS is_restock,
        'NEW_SKU' AS stock_action
      FROM dbo.skus sk
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
      LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
      WHERE sk.header_id = @header_id
        AND sk.item_id = @item_id
        AND sk.item_colour_id = @item_colour_id;
      RETURN;
    END;

    SET @resolved_home_brand_id = NULL;
    IF NULLIF(@brand_for_prefix, '') IS NULL
       AND NULLIF(LTRIM(RTRIM(ISNULL(@source_brand_match, ''))), '') IS NOT NULL
    BEGIN
      SELECT TOP (1)
        @resolved_home_brand_id = hb.brand_id,
        @brand_for_prefix = LTRIM(RTRIM(COALESCE(
          NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_code, ''))), ''),
          NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
          ''
        )))
      FROM dbo.home_brands hb
      WHERE hb.is_active = 1
        AND (
          UPPER(LTRIM(RTRIM(hb.brand_code))) = UPPER(LTRIM(RTRIM(@source_brand_match)))
          OR LOWER(LTRIM(RTRIM(hb.brand_name))) = LOWER(LTRIM(RTRIM(@source_brand_match)))
        );
    END;

    IF @resolved_home_brand_id IS NOT NULL
    BEGIN
      UPDATE dbo.product_master
      SET home_brand_id = @resolved_home_brand_id,
          updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE product_id = @product_master_id
        AND home_brand_id IS NULL;
    END;

    DECLARE @brandPfx VARCHAR(10) = UPPER(LEFT(COALESCE(NULLIF(@brand_for_prefix, ''), 'GEN'), 3));
    DECLARE @collPfx  VARCHAR(10) = UPPER(LEFT(REPLACE(ISNULL(@ew_collection, 'XX'), ' ', ''), 4));
    DECLARE @modelSrc VARCHAR(200) = LTRIM(RTRIM(ISNULL(@source_model_number, '')));
    IF @modelSrc = '' SET @modelSrc = LTRIM(RTRIM(ISNULL(@style_model, '')));
    DECLARE @modelRaw VARCHAR(200) = NULLIF(@modelSrc, '');
    DECLARE @modelPfx VARCHAR(12) = UPPER(LEFT(REPLACE(REPLACE(ISNULL(@modelRaw, ''), '-', ''), ' ', ''), 8));
    IF NULLIF(LTRIM(RTRIM(ISNULL(@modelPfx, ''))), '') IS NULL
      SET @modelPfx = 'UNK';
    DECLARE @colPfx   VARCHAR(6)  = UPPER(LEFT(REPLACE(ISNULL(@colour_code, '00'), ' ', ''), 3));

    DECLARE @powerPfx VARCHAR(8) = NULL;
    IF @reading_power IS NOT NULL
      SET @powerPfx = 'P' + REPLACE(REPLACE(@reading_power, '+', ''), '.', '');

    DECLARE @skuCode VARCHAR(100) = @brandPfx + '-' + @collPfx + '-' + @modelPfx + '-' + @colPfx
      + CASE WHEN @powerPfx IS NOT NULL THEN '-' + @powerPfx ELSE '' END;

    DECLARE @pidBase VARCHAR(120) = @skuCode + '-P' + CAST(@header_id AS VARCHAR(20));
    DECLARE @pid VARCHAR(120) = @pidBase;
    DECLARE @pidSuffix INT = 1;
    WHILE EXISTS (SELECT 1 FROM dbo.skus WHERE pid = @pid)
    BEGIN
      SET @pid = @pidBase + '-' + CAST(@pidSuffix AS VARCHAR(10));
      SET @pidSuffix = @pidSuffix + 1;
    END;

    DECLARE @barcode VARCHAR(100) = @pid;

    INSERT INTO dbo.skus
      (product_master_id, sku_code, barcode, pid, quantity, cost_price, sale_price,
       status, created_at, updated_at, header_id, item_id, item_colour_id, image_url, video_url, reading_power)
    VALUES
      (@product_master_id, @skuCode, @barcode, @pid, @quantity, @cost_price, @sale_price,
       'LIVE', DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()),
       @header_id, @item_id, @item_colour_id, @colour_image_url, @colour_video_url, @reading_power);

    DECLARE @new_sku_id INT = CAST(SCOPE_IDENTITY() AS INT);
    IF OBJECT_ID(N'dbo.sp_SKUv2_AllocateUnits', N'P') IS NOT NULL
      EXEC dbo.sp_SKUv2_AllocateUnits @sku_id = @new_sku_id, @qty = @quantity;

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
      LTRIM(RTRIM(COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
        ''
      ))) AS brand_name,
      pic.colour_name,
      pic.colour_code,
      sk.reading_power,
      sk.item_id,
      sk.pid AS purchase_event_id,
      CAST(0 AS BIT) AS is_restock,
      'NEW_SKU' AS stock_action
    FROM dbo.skus sk
    JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
    LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
    WHERE sk.sku_id = @new_sku_id;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH;
END;
GO
