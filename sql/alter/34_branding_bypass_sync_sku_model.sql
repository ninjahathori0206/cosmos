USE [CosmosERP];
GO

-- Migration 34: Branding bypass product_master sync + SKU model segment in sp_SKUv2_Generate
-- Canonical: sql/sp/pipeline_v2.sql

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_PurchaseHeader_BrandingBypass  (Stage 3 – Bypass branding)
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_PurchaseHeader_BrandingBypass','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_BrandingBypass;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_BrandingBypass
  @header_id     INT,
  @bypass_reason VARCHAR(500)
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status IN ('PENDING_BRANDING','BILL_DISCREPANCY'))
    BEGIN RAISERROR('Bypass only allowed at PENDING_BRANDING stage.',16,1); RETURN; END;
    IF @bypass_reason IS NULL OR LEN(TRIM(@bypass_reason)) = 0
    BEGIN RAISERROR('Bypass reason is required.',16,1); RETURN; END;
    UPDATE dbo.purchase_headers SET
      bypass_reason   = @bypass_reason,
      pipeline_status = 'PENDING_DIGITISATION',
      updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

    DECLARE @pm_id INT;
    DECLARE @src_brand VARCHAR(200);
    DECLARE @src_coll  VARCHAR(200);
    DECLARE @match_brand_id INT;
    DECLARE @raw_brand_name VARCHAR(200);
    DECLARE @slug VARCHAR(32);
    DECLARE @try_code VARCHAR(10);
    DECLARE @code_n INT;

    DECLARE @pm_work TABLE (product_id INT PRIMARY KEY);
    INSERT INTO @pm_work (product_id)
    SELECT DISTINCT pi.product_master_id
    FROM dbo.purchase_items pi
    WHERE pi.header_id = @header_id;

    WHILE EXISTS (SELECT 1 FROM @pm_work)
    BEGIN
      SELECT TOP (1) @pm_id = product_id FROM @pm_work ORDER BY product_id;
      DELETE FROM @pm_work WHERE product_id = @pm_id;

      SET @src_brand = NULL;
      SET @src_coll  = NULL;
      SELECT @src_brand = pm.source_brand, @src_coll = pm.source_collection
      FROM dbo.product_master pm
      WHERE pm.product_id = @pm_id;

      IF NULLIF(LTRIM(RTRIM(ISNULL(@src_coll, ''))), '') IS NOT NULL
      BEGIN
        UPDATE dbo.product_master
        SET ew_collection = @src_coll,
            updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE product_id = @pm_id;
      END;

      IF NULLIF(LTRIM(RTRIM(ISNULL(@src_brand, ''))), '') IS NOT NULL
      BEGIN
        SET @match_brand_id = NULL;
        SELECT TOP (1) @match_brand_id = hb.brand_id
        FROM dbo.home_brands hb
        WHERE LOWER(LTRIM(RTRIM(hb.brand_name))) = LOWER(LTRIM(RTRIM(@src_brand)));

        IF @match_brand_id IS NULL
        BEGIN
          SET @raw_brand_name = LTRIM(RTRIM(@src_brand));
          SET @slug = @raw_brand_name;
          WHILE PATINDEX('%[^a-zA-Z0-9]%', @slug) > 0
            SET @slug = STUFF(@slug, PATINDEX('%[^a-zA-Z0-9]%', @slug), 1, '');
          IF NULLIF(LTRIM(RTRIM(ISNULL(@slug, ''))), '') IS NULL
            SET @slug = N'AUTO';
          SET @slug = UPPER(LEFT(@slug, 10));
          SET @try_code = LEFT(@slug, 10);
          SET @code_n = 0;
          WHILE EXISTS (SELECT 1 FROM dbo.home_brands WHERE brand_code = @try_code)
          BEGIN
            SET @code_n = @code_n + 1;
            SET @try_code = LEFT(@slug, 7) + RIGHT('000' + CAST(@code_n AS VARCHAR(3)), 3);
          END;
          INSERT INTO dbo.home_brands (brand_name, brand_code, brand_description, is_active, created_by, created_at, updated_at)
          VALUES (@raw_brand_name, @try_code, NULL, 1, NULL, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));
          SET @match_brand_id = CAST(SCOPE_IDENTITY() AS INT);
        END;

        UPDATE dbo.product_master
        SET home_brand_id = @match_brand_id,
            updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE product_id = @pm_id;
      END;
    END;

    SELECT header_id, pipeline_status FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_SKUv2_Generate  (Stage 4 – per colour per item)
-- ══════════════════════════════════════════════════════════════════════════════
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
    DECLARE @source_model_number VARCHAR(200);
    DECLARE @style_model VARCHAR(200);
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
      @source_model_number = pm.source_model_number,
      @style_model = pm.style_model,
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
    DECLARE @modelSrc VARCHAR(200) = LTRIM(RTRIM(ISNULL(@source_model_number, '')));
    IF @modelSrc = '' SET @modelSrc = LTRIM(RTRIM(ISNULL(@style_model, '')));
    DECLARE @modelRaw VARCHAR(200) = NULLIF(@modelSrc, '');
    DECLARE @modelPfx VARCHAR(12) = UPPER(LEFT(REPLACE(REPLACE(ISNULL(@modelRaw, ''), '-', ''), ' ', ''), 8));
    IF NULLIF(LTRIM(RTRIM(ISNULL(@modelPfx, ''))), '') IS NULL
      SET @modelPfx = 'UNK';
    DECLARE @colPfx   VARCHAR(6)  = UPPER(LEFT(REPLACE(ISNULL(@colour_code, '00'), ' ', ''), 3));

    DECLARE @skuCode VARCHAR(100) = @brandPfx + '-' + @collPfx + '-' + @modelPfx + '-' + @colPfx;

    -- Purchase-scoped PID (NOT NULL on dbo.skus); must be unique (UQ_skus_pid).
    DECLARE @pidBase VARCHAR(120) = @skuCode + '-P' + CAST(@header_id AS VARCHAR(20));
    DECLARE @pid VARCHAR(120) = @pidBase;
    DECLARE @pidSuffix INT = 1;
    WHILE EXISTS (SELECT 1 FROM dbo.skus WHERE pid = @pid)
    BEGIN
      SET @pid = @pidBase + '-' + CAST(@pidSuffix AS VARCHAR(10));
      SET @pidSuffix = @pidSuffix + 1;
    END;

    -- Barcode = pid so scans stay unique without a trailing global sequence digit block.
    DECLARE @barcode VARCHAR(100) = @pid;

    INSERT INTO dbo.skus
      (product_master_id, sku_code, barcode, pid, quantity, cost_price, sale_price,
       status, created_at, updated_at, header_id, item_id, item_colour_id, image_url, video_url)
    VALUES
      (@product_master_id, @skuCode, @barcode, @pid, @quantity, @cost_price, @sale_price,
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
