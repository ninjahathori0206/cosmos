-- One-shot deploy: four-segment SKU (Brand-Coll-Model-Colour) + PID barcode.
-- Source of truth: sql/sp/pipeline_v2.sql (sp_SKUv2_Generate).
-- Run this against CosmosERP after pulling latest; no app restart required.

IF OBJECT_ID('dbo.sp_SKUv2_Generate','P') IS NOT NULL DROP PROCEDURE dbo.sp_SKUv2_Generate;
GO
CREATE PROCEDURE dbo.sp_SKUv2_Generate
  @header_id          INT,
  @item_id            INT,
  @item_colour_id     INT,
  @sale_price         DECIMAL(10,2)
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    -- Validate
    IF NOT EXISTS (SELECT 1 FROM dbo.purchase_headers WHERE header_id=@header_id AND pipeline_status='PENDING_DIGITISATION')
    BEGIN RAISERROR('SKU generation only allowed at PENDING_DIGITISATION stage.',16,1); RETURN; END;
    IF EXISTS (SELECT 1 FROM dbo.skus WHERE item_colour_id=@item_colour_id)
    BEGIN RAISERROR('SKU already generated for this colour variant.',16,1); RETURN; END;

    -- Fetch product_master_id, cost_price, colour_qty, brand / collection / model / colour parts
    DECLARE @brand_part VARCHAR(6), @coll_part VARCHAR(8), @model_part VARCHAR(8), @clr_part VARCHAR(6);
    DECLARE @product_master_id INT, @cost_price DECIMAL(10,2), @colour_qty INT;

    SELECT TOP 1
      @product_master_id = pm.product_id,
      @cost_price        = pi.purchase_rate,
      @colour_qty        = pic.quantity,
      @brand_part = UPPER(LEFT(ISNULL(hb.brand_code, LEFT(ISNULL(pm.source_brand,'UNK'),3)),4)),
      @coll_part  = UPPER(LEFT(REPLACE(ISNULL(pm.ew_collection,''),' ',''),6)),
      @model_part = CASE
        WHEN LEN(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(pm.source_model_number,''))),' ',''),'-','')) < 1 THEN 'UNK'
        ELSE UPPER(LEFT(REPLACE(REPLACE(LTRIM(RTRIM(ISNULL(pm.source_model_number,''))),' ',''),'-',''), 8))
      END,
      @clr_part   = UPPER(LEFT(REPLACE(ISNULL(pic.colour_code,''),' ',''),4))
    FROM dbo.purchase_item_colours pic
    JOIN dbo.purchase_items pi     ON pic.item_id = pi.item_id
    JOIN dbo.product_master pm     ON pi.product_master_id = pm.product_id
    LEFT JOIN dbo.home_brands hb   ON pm.home_brand_id = hb.brand_id
    WHERE pic.colour_id = @item_colour_id AND pi.item_id = @item_id;

    IF @product_master_id IS NULL
      BEGIN RAISERROR('Could not resolve product for the given item/colour.',16,1); RETURN; END;

    -- SKU = stable product identifier: BRAND-COLL-MODEL-COLOUR (same product+colour across purchases)
    DECLARE @sku_code VARCHAR(100) = @brand_part + '-' + @coll_part + '-' + @model_part + '-' + @clr_part;

    -- PID = purchase identifier: SKU-P{header_id} (unique per purchase batch)
    DECLARE @pid VARCHAR(120) = @sku_code + '-P' + CAST(@header_id AS VARCHAR);

    -- Ensure PID is unique (safety: if same header somehow generates duplicate colour)
    DECLARE @pid_seq INT = 1;
    WHILE EXISTS (SELECT 1 FROM dbo.skus WHERE pid = @pid)
    BEGIN
      SET @pid_seq = @pid_seq + 1;
      SET @pid = @sku_code + '-P' + CAST(@header_id AS VARCHAR) + '-' + CAST(@pid_seq AS VARCHAR);
    END;

    INSERT INTO dbo.skus (
      product_master_id, purchase_colour_id,
      header_id, item_id, item_colour_id,
      sku_code, barcode, pid, quantity, cost_price, sale_price, status
    )
    VALUES (
      @product_master_id, NULL,
      @header_id, @item_id, @item_colour_id,
      @sku_code, @pid, @pid, @colour_qty, @cost_price, @sale_price, 'PENDING'
    );

    SELECT SCOPE_IDENTITY() AS sku_id, @sku_code AS sku_code, @pid AS pid, @pid AS barcode, @colour_qty AS quantity;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO
