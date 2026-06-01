-- Stock Transfer Stored Procedures
USE [CosmosERP];
GO

-- ==============================================================================
-- sp_StockTransfer_ListAvailable
-- Returns SKUs that have warehouse stock available for transfer, with optional
-- filters on search text, brand, and product type.
-- ==============================================================================
IF OBJECT_ID('dbo.sp_StockTransfer_ListAvailable','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_StockTransfer_ListAvailable;
GO
CREATE PROCEDURE dbo.sp_StockTransfer_ListAvailable
  @q            VARCHAR(200) = NULL,
  @brand_id     INT          = NULL,
  @product_type VARCHAR(50)  = NULL
AS BEGIN
  SET NOCOUNT ON;
  DECLARE @wh INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
  IF @wh IS NULL
    RAISERROR('Primary warehouse is not configured.', 16, 1);

  DECLARE @trim VARCHAR(200) = LTRIM(RTRIM(ISNULL(@q, '')));
  DECLARE @unit_code CHAR(7) = NULL;
  IF LEN(@trim) > 0 AND @trim NOT LIKE '%[^0-9]%' AND LEN(@trim) <= 7
    SET @unit_code = RIGHT(REPLICATE('0', 7) + @trim, 7);

  SELECT
    sk.sku_id,
    sk.sku_code,
    sk.barcode,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    pm.ew_collection,
    pm.style_model,
    pm.product_type,
    hb.brand_id,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    pic.colour_name,
    pic.colour_code,
    ISNULL(sb.qty, 0) AS warehouse_qty,
    sk.sale_price,
    sk.status
  FROM dbo.skus sk
  JOIN dbo.product_master pm         ON sk.product_master_id  = pm.product_id
  LEFT JOIN dbo.home_brands hb       ON pm.home_brand_id      = hb.brand_id
  LEFT JOIN dbo.maker_master mm      ON pm.maker_master_id   = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sk.sku_id = sb.sku_id AND sb.location_type = 'WAREHOUSE' AND sb.location_id = @wh
  WHERE sk.status IN ('LIVE', 'ACTIVE')
    AND ISNULL(sb.qty, 0) > 0
    AND (ISNULL(@brand_id,0) = 0 OR pm.home_brand_id = @brand_id)
    AND (ISNULL(@product_type,'') = '' OR pm.product_type = @product_type)
    AND (
      ISNULL(@q,'') = ''
      OR sk.sku_code          LIKE '%'+@q+'%'
      OR sk.barcode           LIKE '%'+@q+'%'
      OR pm.ew_collection     LIKE '%'+@q+'%'
      OR pm.style_model       LIKE '%'+@q+'%'
      OR ISNULL(hb.brand_name,'') LIKE '%'+@q+'%'
      OR ISNULL(mm.maker_name,'') LIKE '%'+@q+'%'
      OR ISNULL(pm.source_brand,'') LIKE '%'+@q+'%'
      OR ISNULL(pm.source_collection,'') LIKE '%'+@q+'%'
      OR ISNULL(pm.source_model_number,'') LIKE '%'+@q+'%'
      OR ISNULL(pic.colour_name,'') LIKE '%'+@q+'%'
      OR (
        @unit_code IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM dbo.sku_units u
          WHERE u.sku_id = sk.sku_id
            AND u.unit_barcode = @unit_code
            AND u.status = N'AVAILABLE'
            AND u.location_type = N'WAREHOUSE'
            AND u.location_id = @wh
        )
      )
    )
  ORDER BY brand_name, pm.ew_collection, pic.colour_name;
END;
GO

-- ==============================================================================
-- sp_StockTransfer_LookupByCode
-- Resolves a QR / barcode / SKU code to a single transferable SKU row.
-- Used when a user scans a label.
-- ==============================================================================
IF OBJECT_ID('dbo.sp_StockTransfer_LookupByCode','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_StockTransfer_LookupByCode;
GO
CREATE PROCEDURE dbo.sp_StockTransfer_LookupByCode
  @code VARCHAR(200)
AS BEGIN
  SET NOCOUNT ON;
  DECLARE @wh INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
  IF @wh IS NULL
    RAISERROR('Primary warehouse is not configured.', 16, 1);

  DECLARE @wh_display VARCHAR(200) = LEFT(CAST(dbo.fn_Foundry_WarehouseDisplayName() AS VARCHAR(200)), 200);
  DECLARE @trim VARCHAR(200) = LTRIM(RTRIM(ISNULL(@code, '')));
  DECLARE @unit_code CHAR(7) = RIGHT(REPLICATE('0', 7) + @trim, 7);

  IF LEN(@trim) <= 7 AND @unit_code LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
     AND EXISTS (SELECT 1 FROM dbo.sku_units u WHERE u.unit_barcode = @unit_code)
  BEGIN
    DECLARE @open_doc_id INT;
    DECLARE @open_doc_status VARCHAR(20);
    DECLARE @open_to_name NVARCHAR(200);

    SELECT TOP 1
      @open_doc_id = d.doc_id,
      @open_doc_status = d.status,
      @open_to_name = ISNULL(NULLIF(LTRIM(RTRIM(st.store_name)), N''), N'store #' + CAST(d.to_store_id AS VARCHAR(20)))
    FROM dbo.sku_units u
    INNER JOIN dbo.stock_transfer_doc_units du ON du.unit_id = u.unit_id
    INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
    LEFT JOIN dbo.stores st ON st.store_id = d.to_store_id
    WHERE u.unit_barcode = @unit_code
      AND d.status IN (N'DISPATCHED', N'ACCEPTED')
    ORDER BY d.doc_id DESC;

    IF @open_doc_id IS NOT NULL
    BEGIN
      RAISERROR(
        'Unit %s is already on transfer Doc #%d (%s) to %s. Receive or rollback that shipment before scanning again.',
        16, 1, @unit_code, @open_doc_id, @open_doc_status, @open_to_name);
      RETURN;
    END;

    IF EXISTS (
      SELECT 1
      FROM dbo.sku_units u
      WHERE u.unit_barcode = @unit_code
        AND u.status = N'SOLD'
    )
    BEGIN
      RAISERROR('Unit %s has already been sold and cannot be transferred.', 16, 1, @unit_code);
      RETURN;
    END;

    IF EXISTS (
      SELECT 1
      FROM dbo.sku_units u
      WHERE u.unit_barcode = @unit_code
        AND u.status = N'AVAILABLE'
        AND u.location_type = N'WAREHOUSE'
        AND u.location_id <> @wh
    )
    BEGIN
      RAISERROR(
        'Unit %s is at a non-primary warehouse location. Save Inventory hub in Command Unit or run warehouse alignment.',
        16, 1, @unit_code);
      RETURN;
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM dbo.sku_units u
      WHERE u.unit_barcode = @unit_code
        AND u.status = N'AVAILABLE'
        AND u.location_type = N'WAREHOUSE'
        AND u.location_id = @wh
    )
    BEGIN
      DECLARE @unit_status VARCHAR(20) = N'unknown';
      DECLARE @unit_loc_type VARCHAR(20) = N'unknown';
      SELECT TOP 1
        @unit_status = ISNULL(u.status, N'unknown'),
        @unit_loc_type = ISNULL(u.location_type, N'unknown')
      FROM dbo.sku_units u
      WHERE u.unit_barcode = @unit_code;

      RAISERROR(
        'Unit %s is not available at %s (status: %s, location: %s).',
        16, 1,
        @unit_code,
        @wh_display,
        @unit_status,
        @unit_loc_type);
      RETURN;
    END;

    SELECT TOP 1
      sk.sku_id,
      sk.sku_code,
      sk.barcode,
      u.unit_id,
      u.unit_no,
      u.unit_barcode,
      u.status AS unit_status,
      u.location_type AS unit_location_type,
      u.location_id AS unit_location_id,
      ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
      pm.ew_collection,
      pm.style_model,
      pm.product_type,
      CAST(ISNULL(ptc.requires_unit_barcode, 1) AS BIT) AS requires_unit_barcode,
      LTRIM(RTRIM(COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
        ''
      ))) AS brand_name,
      pic.colour_name,
      pic.colour_code,
      ISNULL(sb.qty, 0) AS warehouse_qty,
      sk.sale_price,
      sk.status
    FROM dbo.sku_units u
    JOIN dbo.skus sk ON sk.sku_id = u.sku_id
    JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
    LEFT JOIN dbo.pos_product_type_config ptc ON ptc.product_type_key = pm.product_type
    LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
    LEFT JOIN dbo.maker_master mm ON pm.maker_master_id = mm.maker_id
    LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
    LEFT JOIN dbo.stock_balances sb
      ON sk.sku_id = sb.sku_id AND sb.location_type = N'WAREHOUSE' AND sb.location_id = @wh
    WHERE u.unit_barcode = @unit_code;
    RETURN;
  END;

  SELECT TOP 1
    sk.sku_id,
    sk.sku_code,
    sk.barcode,
    CAST(NULL AS INT) AS unit_id,
    CAST(NULL AS INT) AS unit_no,
    CAST(NULL AS CHAR(7)) AS unit_barcode,
    CAST(NULL AS VARCHAR(20)) AS unit_status,
    CAST(NULL AS VARCHAR(20)) AS unit_location_type,
    CAST(NULL AS INT) AS unit_location_id,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    pm.ew_collection,
    pm.style_model,
    pm.product_type,
    CAST(ISNULL(ptc.requires_unit_barcode, 1) AS BIT) AS requires_unit_barcode,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    pic.colour_name,
    pic.colour_code,
    ISNULL(sb.qty, 0) AS warehouse_qty,
    sk.sale_price,
    sk.status
  FROM dbo.skus sk
  JOIN dbo.product_master pm         ON sk.product_master_id  = pm.product_id
  LEFT JOIN dbo.pos_product_type_config ptc ON ptc.product_type_key = pm.product_type
  LEFT JOIN dbo.home_brands hb       ON pm.home_brand_id      = hb.brand_id
  LEFT JOIN dbo.maker_master mm      ON pm.maker_master_id    = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sk.sku_id = sb.sku_id AND sb.location_type = N'WAREHOUSE' AND sb.location_id = @wh
  WHERE sk.sku_code = @trim OR sk.barcode = @trim;
END;
GO

-- ==============================================================================
-- sp_StockTransfer_Create
-- Moves stock from HQ Warehouse to a destination store for one or more SKUs.
-- Accepts a JSON array of transfer lines: [{ sku_id, qty }]
-- Validates warehouse availability per line, decrements WAREHOUSE balance,
-- upserts STORE balance, and writes stock_movements audit rows.
-- ==============================================================================
IF OBJECT_ID('dbo.sp_StockTransfer_Create','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_StockTransfer_Create;
GO
CREATE PROCEDURE dbo.sp_StockTransfer_Create
  @lines_json  NVARCHAR(MAX),  -- [{"sku_id":1,"qty":2}, ...]
  @to_store_id INT,
  @notes       VARCHAR(500) = NULL,
  @created_by  INT          = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;
  BEGIN TRY

    -- Validate destination store exists and is active
    IF NOT EXISTS (
      SELECT 1 FROM dbo.stores WHERE store_id = @to_store_id AND status = 'ACTIVE'
    )
      RAISERROR('Destination store not found or inactive', 16, 1);

    -- Parse lines into temp table
    CREATE TABLE #lines (
      sku_id INT NOT NULL,
      qty    INT NOT NULL
    );

    INSERT INTO #lines (sku_id, qty)
    SELECT
      CAST(j.sku_id AS INT),
      CAST(j.qty    AS INT)
    FROM OPENJSON(@lines_json)
      WITH (sku_id INT '$.sku_id', qty INT '$.qty') j
    WHERE CAST(j.qty AS INT) > 0;

    IF NOT EXISTS (SELECT 1 FROM #lines)
      RAISERROR('No valid transfer lines provided', 16, 1);

    DECLARE @wh_id INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
    IF @wh_id IS NULL
      RAISERROR('Primary warehouse is not configured.', 16, 1);

    -- Validate and apply each line
    DECLARE
      @sku_id        INT,
      @qty           INT,
      @wh_qty        INT,
      @store_name    VARCHAR(200);

    SELECT @store_name = store_name FROM dbo.stores WHERE store_id = @to_store_id;

    DECLARE line_cursor CURSOR LOCAL FAST_FORWARD FOR
      SELECT sku_id, qty FROM #lines;

    OPEN line_cursor;
    FETCH NEXT FROM line_cursor INTO @sku_id, @qty;

    WHILE @@FETCH_STATUS = 0
    BEGIN
      -- Check warehouse balance
      SELECT @wh_qty = ISNULL(qty, 0)
      FROM dbo.stock_balances
      WHERE sku_id = @sku_id AND location_type = 'WAREHOUSE' AND location_id = @wh_id;

      IF ISNULL(@wh_qty, 0) < @qty
        RAISERROR('Insufficient warehouse stock for one or more items', 16, 1);

      -- Decrement warehouse
      UPDATE dbo.stock_balances
      SET qty = qty - @qty, last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE sku_id = @sku_id AND location_type = 'WAREHOUSE' AND location_id = @wh_id;

      -- Upsert store balance
      IF EXISTS (
        SELECT 1 FROM dbo.stock_balances
        WHERE sku_id = @sku_id AND location_type = 'STORE' AND location_id = @to_store_id
      )
        UPDATE dbo.stock_balances
        SET qty = qty + @qty, last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE sku_id = @sku_id AND location_type = 'STORE' AND location_id = @to_store_id;
      ELSE
        INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, location_name, qty, last_updated)
        VALUES (@sku_id, 'STORE', @to_store_id, @store_name, @qty, DATEADD(MINUTE, 330, SYSUTCDATETIME()));

      -- Audit movement
      INSERT INTO dbo.stock_movements
        (sku_id, from_location_type, from_location_id, to_location_type, to_location_id,
         qty, movement_type, reference_id, notes, created_by)
      VALUES
        (@sku_id, 'WAREHOUSE', @wh_id, 'STORE', @to_store_id,
         @qty, 'HQ_TO_STORE', NULL, @notes, @created_by);

      FETCH NEXT FROM line_cursor INTO @sku_id, @qty;
    END;

    CLOSE line_cursor;
    DEALLOCATE line_cursor;

    DROP TABLE #lines;
    COMMIT TRANSACTION;

    -- Return transfer summary row
    SELECT
      @to_store_id  AS to_store_id,
      @store_name   AS to_store_name,
      DATEADD(MINUTE, 330, SYSUTCDATETIME())     AS transferred_at,
      @created_by   AS created_by;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    IF OBJECT_ID('tempdb..#lines') IS NOT NULL DROP TABLE #lines;
    DECLARE @msg NVARCHAR(500) = ERROR_MESSAGE();
    RAISERROR(@msg, 16, 1);
  END CATCH;
END;
GO

-- ==============================================================================
-- sp_StockTransfer_History
-- Returns recent HQ-to-store stock movement rows with SKU and store details.
-- ==============================================================================
IF OBJECT_ID('dbo.sp_StockTransfer_History','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_StockTransfer_History;
GO
CREATE PROCEDURE dbo.sp_StockTransfer_History
  @top_n       INT = 100,
  @to_store_id INT = NULL
AS BEGIN
  SET NOCOUNT ON;
  SELECT TOP (@top_n)
    sm.movement_id,
    sm.sku_id,
    sk.sku_code,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    pic.colour_name,
    sm.qty,
    sm.to_location_id  AS to_store_id,
    st.store_name      AS to_store_name,
    st.store_code      AS to_store_code,
    sm.notes,
    u.full_name        AS transferred_by,
    sm.created_at
  FROM dbo.stock_movements sm
  JOIN dbo.skus sk                        ON sm.sku_id = sk.sku_id
  JOIN dbo.product_master pm              ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb            ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mm           ON pm.maker_master_id = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stores st                 ON sm.to_location_id = st.store_id
  LEFT JOIN dbo.users u                   ON sm.created_by = u.user_id
  WHERE sm.movement_type = 'HQ_TO_STORE'
    AND (ISNULL(@to_store_id,0) = 0 OR sm.to_location_id = @to_store_id)
  ORDER BY sm.created_at DESC, sm.movement_id DESC;
END;
GO

-- ==============================================================================
-- sp_StockTransfer_PickWarehouseUnits
-- FIFO pick of AVAILABLE units at primary warehouse (excludes open transfer docs).
-- @exclude_json — JSON array of unit_id integers already chosen (scans).
-- ==============================================================================
IF OBJECT_ID('dbo.sp_StockTransfer_PickWarehouseUnits','P') IS NOT NULL
  DROP PROCEDURE dbo.sp_StockTransfer_PickWarehouseUnits;
GO
CREATE PROCEDURE dbo.sp_StockTransfer_PickWarehouseUnits
  @sku_id       INT,
  @pick_count   INT,
  @exclude_json NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @wh INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
  IF @wh IS NULL
    RAISERROR('Primary warehouse is not configured.', 16, 1);

  IF @pick_count IS NULL OR @pick_count < 1
    RETURN;

  CREATE TABLE #exclude (unit_id INT PRIMARY KEY);
  IF @exclude_json IS NOT NULL AND LTRIM(RTRIM(@exclude_json)) NOT IN (N'', N'[]')
  BEGIN
    INSERT INTO #exclude (unit_id)
    SELECT DISTINCT CAST(u.value AS INT)
    FROM OPENJSON(@exclude_json) u
    WHERE CAST(u.value AS INT) > 0;
  END

  SELECT TOP (@pick_count)
    u.unit_id,
    u.unit_barcode,
    u.unit_no
  FROM dbo.sku_units u
  WHERE u.sku_id = @sku_id
    AND u.status = N'AVAILABLE'
    AND u.location_type = N'WAREHOUSE'
    AND u.location_id = @wh
    AND NOT EXISTS (SELECT 1 FROM #exclude e WHERE e.unit_id = u.unit_id)
    AND NOT EXISTS (
      SELECT 1
      FROM dbo.stock_transfer_doc_units du
      INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
      WHERE du.unit_id = u.unit_id
        AND d.status IN (N'DISPATCHED', N'ACCEPTED')
    )
  ORDER BY u.unit_id ASC;
END;
GO
