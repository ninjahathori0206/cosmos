-- ═══════════════════════════════════════════════════════════════════════════════
-- Stock Transfer Document stored procedures
-- Run AFTER migration 25_stock_transfer_docs.sql
--
-- Lifecycle:  DISPATCHED → ACCEPTED → STOCKED
--   DISPATCH : WAREHOUSE balance decrements (stock leaves HQ)
--   ACCEPTED : store acknowledges receipt — no stock movement
--   STOCKED  : store verifies quantities — STORE balance increments,
--              stock_movements audit rows written
-- ═══════════════════════════════════════════════════════════════════════════════
USE [CosmosERP];
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_StockTransferDoc_Dispatch
-- Creates a transfer document header + lines (from JSON), validates and
-- decrements WAREHOUSE balance per line, returns new doc_id.
--
-- @lines_json : [{"sku_id":1,"qty":2}, ...]
-- @doc_type   : 'DIRECT' or 'REQUEST'
-- @source_request_id : NULL for DIRECT transfers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_StockTransferDoc_Dispatch
  @lines_json                   NVARCHAR(MAX),
  @to_store_id                  INT,
  @doc_type                     VARCHAR(10)   = 'DIRECT',
  @source_request_id            INT           = NULL,
  @notes                        NVARCHAR(500) = NULL,
  @dispatched_by                INT           = NULL,
  @caller_manages_transaction   BIT           = 0
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @started_here BIT = 0;

  IF @@TRANCOUNT = 0
  BEGIN
    BEGIN TRANSACTION;
    SET @started_here = 1;
  END;

  BEGIN TRY

    IF NOT EXISTS (
      SELECT 1 FROM dbo.stores WHERE store_id = @to_store_id AND status = 'ACTIVE'
    )
      RAISERROR('Destination store not found or inactive.', 16, 1);

    IF @doc_type = 'REQUEST'
    BEGIN
      IF @source_request_id IS NULL
        RAISERROR('source_request_id is required for REQUEST transfer documents.', 16, 1);

      IF NOT EXISTS (
        SELECT 1 FROM dbo.transfer_requests WHERE request_id = @source_request_id
      )
        RAISERROR('Transfer request not found for source_request_id.', 16, 1);

      IF NOT EXISTS (
        SELECT 1
        FROM dbo.transfer_requests
        WHERE request_id = @source_request_id
          AND store_id = @to_store_id
      )
        RAISERROR('Destination store does not match the transfer request store.', 16, 1);
    END

    CREATE TABLE #lines (
      sku_id        INT NOT NULL,
      qty           INT NOT NULL,
      unit_ids_json NVARCHAR(MAX) NULL
    );

    INSERT INTO #lines (sku_id, qty, unit_ids_json)
    SELECT
      CAST(j.sku_id AS INT),
      CAST(j.qty AS INT),
      j.unit_ids
    FROM OPENJSON(@lines_json)
      WITH (
        sku_id   INT           '$.sku_id',
        qty      INT           '$.qty',
        unit_ids NVARCHAR(MAX) '$.unit_ids' AS JSON
      ) j
    WHERE CAST(j.qty AS INT) > 0;

    IF NOT EXISTS (SELECT 1 FROM #lines)
      RAISERROR('No valid transfer lines provided.', 16, 1);

    DECLARE @wh_id INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
    IF @wh_id IS NULL
      RAISERROR('Primary warehouse is not configured. Set app_settings.foundry_primary_warehouse_location_id or add an active warehouse hub store.', 16, 1);

    INSERT INTO dbo.stock_transfer_docs
      (doc_type, source_request_id, to_store_id, status, notes, dispatched_by, dispatched_at)
    VALUES
      (@doc_type, @source_request_id, @to_store_id, 'DISPATCHED', @notes, @dispatched_by, DATEADD(MINUTE, 330, SYSUTCDATETIME()));

    DECLARE @doc_id INT = SCOPE_IDENTITY();

    DECLARE @sku_id INT, @qty INT, @unit_ids_json NVARCHAR(MAX), @wh_qty INT, @line_id INT;
    DECLARE @requires_unit BIT, @unit_id INT, @unit_count INT;

    DECLARE line_cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT sku_id, qty, unit_ids_json FROM #lines;
    OPEN line_cur;
    FETCH NEXT FROM line_cur INTO @sku_id, @qty, @unit_ids_json;

    WHILE @@FETCH_STATUS = 0
    BEGIN
      SELECT @requires_unit = CAST(ISNULL(ptc.requires_unit_barcode, 1) AS BIT)
      FROM dbo.skus sk
      INNER JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.pos_product_type_config ptc ON ptc.product_type_key = pm.product_type
      WHERE sk.sku_id = @sku_id;

      IF @requires_unit = 1
      BEGIN
        IF @unit_ids_json IS NULL OR LTRIM(RTRIM(@unit_ids_json)) IN (N'', N'[]')
          RAISERROR('Unit barcodes are required for this product type. Scan each piece to transfer.', 16, 1);
      END

      SELECT @wh_qty = ISNULL(qty, 0)
      FROM dbo.stock_balances
      WHERE sku_id = @sku_id AND location_type = N'WAREHOUSE' AND location_id = @wh_id;

      IF ISNULL(@wh_qty, 0) < @qty
        RAISERROR('Insufficient warehouse stock for one or more SKUs.', 16, 1);

      UPDATE dbo.stock_balances
      SET qty = qty - @qty, last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE sku_id = @sku_id AND location_type = N'WAREHOUSE' AND location_id = @wh_id;

      INSERT INTO dbo.stock_transfer_doc_lines (doc_id, sku_id, qty_sent)
      VALUES (@doc_id, @sku_id, @qty);
      SET @line_id = SCOPE_IDENTITY();

      IF @requires_unit = 1
      BEGIN
        SET @unit_count = 0;

        DECLARE unit_cur CURSOR LOCAL FAST_FORWARD FOR
          SELECT CAST(u.value AS INT)
          FROM OPENJSON(@unit_ids_json) u;

        OPEN unit_cur;
        FETCH NEXT FROM unit_cur INTO @unit_id;

        WHILE @@FETCH_STATUS = 0
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM dbo.sku_units u
            WHERE u.unit_id = @unit_id
              AND u.sku_id = @sku_id
              AND u.status = N'AVAILABLE'
              AND u.location_type = N'WAREHOUSE'
              AND u.location_id = @wh_id
          )
            RAISERROR('One or more units are not available at the primary warehouse.', 16, 1);

          IF EXISTS (
            SELECT 1
            FROM dbo.stock_transfer_doc_units du
            INNER JOIN dbo.stock_transfer_docs d ON d.doc_id = du.doc_id
            WHERE du.unit_id = @unit_id
              AND d.status IN (N'DISPATCHED', N'ACCEPTED')
          )
            RAISERROR('One or more units are already on an open transfer document.', 16, 1);

          INSERT INTO dbo.stock_transfer_doc_units (doc_id, line_id, unit_id)
          VALUES (@doc_id, @line_id, @unit_id);

          UPDATE dbo.sku_units
          SET
            status        = N'IN_TRANSIT',
            location_type = N'IN_TRANSIT',
            location_id   = @to_store_id
          WHERE unit_id = @unit_id;

          SET @unit_count = @unit_count + 1;
          FETCH NEXT FROM unit_cur INTO @unit_id;
        END;

        CLOSE unit_cur;
        DEALLOCATE unit_cur;

        IF @unit_count <> @qty
          RAISERROR('Unit count does not match line quantity for a SKU.', 16, 1);
      END

      FETCH NEXT FROM line_cur INTO @sku_id, @qty, @unit_ids_json;
    END;

    CLOSE line_cur;
    DEALLOCATE line_cur;
    DROP TABLE #lines;

    IF @caller_manages_transaction = 0 AND @started_here = 1
      COMMIT TRANSACTION;

    IF @caller_manages_transaction = 0
       AND @doc_type = 'REQUEST'
       AND @source_request_id IS NOT NULL
      EXEC dbo.sp_TransferRequest_SyncDispatchedFromDocs @request_id = @source_request_id;

    SELECT @doc_id AS doc_id;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0
      ROLLBACK TRANSACTION;
    IF OBJECT_ID('tempdb..#lines') IS NOT NULL DROP TABLE #lines;
    DECLARE @msg1 NVARCHAR(500) = ERROR_MESSAGE(); RAISERROR(@msg1, 16, 1);
  END CATCH;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_StockTransferDoc_Accept
-- Store acknowledges the incoming transfer.  DISPATCHED → ACCEPTED.
-- No stock movement at this stage.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_StockTransferDoc_Accept
  @doc_id      INT,
  @accepted_by INT
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (
    SELECT 1 FROM dbo.stock_transfer_docs
    WHERE doc_id = @doc_id AND status = 'DISPATCHED'
  )
    THROW 50010, 'Transfer document not found or is not in DISPATCHED status.', 1;

  UPDATE dbo.stock_transfer_docs
  SET status      = 'ACCEPTED',
      accepted_by = @accepted_by,
      accepted_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE doc_id = @doc_id;

  SELECT doc_id, status, accepted_at FROM dbo.stock_transfer_docs WHERE doc_id = @doc_id;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_StockTransferDoc_Stock
-- Store verifies received quantities.  ACCEPTED → STOCKED.
-- Increments STORE balance and writes stock_movements audit rows.
--
-- @lines_json : [{"line_id":1,"qty_received":2}, ...]
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_StockTransferDoc_Stock
  @doc_id      INT,
  @lines_json  NVARCHAR(MAX),
  @stocked_by  INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;
  BEGIN TRY

    DECLARE @to_store_id INT, @store_name VARCHAR(200);

    SELECT @to_store_id = to_store_id
    FROM dbo.stock_transfer_docs
    WHERE doc_id = @doc_id AND status = 'ACCEPTED';

    IF @to_store_id IS NULL
      RAISERROR('Transfer document not found or is not in ACCEPTED status.', 16, 1);

    SELECT @store_name = store_name FROM dbo.stores WHERE store_id = @to_store_id;

    DECLARE @wh_id INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
    IF @wh_id IS NULL
      RAISERROR('Primary warehouse is not configured. Set app_settings.foundry_primary_warehouse_location_id or add an active HQ store.', 16, 1);

    -- Parse received quantities into temp table
    CREATE TABLE #recv (line_id INT NOT NULL, qty_received INT NOT NULL);

    INSERT INTO #recv (line_id, qty_received)
    SELECT CAST(j.line_id AS INT), CAST(j.qty_received AS INT)
    FROM OPENJSON(@lines_json)
      WITH (line_id INT '$.line_id', qty_received INT '$.qty_received') j
    WHERE CAST(j.qty_received AS INT) >= 0;

    -- Update each line and credit STORE balance
    DECLARE @line_id INT, @qty_recv INT, @sku_id INT;

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT r.line_id, r.qty_received, l.sku_id
      FROM #recv r
      JOIN dbo.stock_transfer_doc_lines l ON l.line_id = r.line_id AND l.doc_id = @doc_id;

    OPEN cur;
    FETCH NEXT FROM cur INTO @line_id, @qty_recv, @sku_id;

    WHILE @@FETCH_STATUS = 0
    BEGIN
      -- Write qty_received on the line
      UPDATE dbo.stock_transfer_doc_lines
      SET qty_received = @qty_recv
      WHERE line_id = @line_id;

      IF @qty_recv > 0
      BEGIN
        IF EXISTS (
          SELECT 1 FROM dbo.stock_balances
          WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @to_store_id
        )
          UPDATE dbo.stock_balances
          SET qty = qty + @qty_recv, last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @to_store_id;
        ELSE
          INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, location_name, qty, last_updated)
          VALUES (@sku_id, N'STORE', @to_store_id, @store_name, @qty_recv, DATEADD(MINUTE, 330, SYSUTCDATETIME()));

        INSERT INTO dbo.stock_movements
          (sku_id, from_location_type, from_location_id, to_location_type, to_location_id,
           qty, movement_type, reference_id, notes, created_by)
        VALUES
          (@sku_id, N'WAREHOUSE', @wh_id, N'STORE', @to_store_id,
           @qty_recv, N'HQ_TO_STORE', @doc_id, NULL, @stocked_by);

        ;WITH ranked AS (
          SELECT
            du.unit_id,
            ROW_NUMBER() OVER (ORDER BY u.unit_no) AS rn
          FROM dbo.stock_transfer_doc_units du
          INNER JOIN dbo.sku_units u ON u.unit_id = du.unit_id
          WHERE du.line_id = @line_id
            AND du.doc_id = @doc_id
            AND u.status = N'IN_TRANSIT'
        )
        UPDATE u
        SET
          u.status        = N'AT_STORE',
          u.location_type = N'STORE',
          u.location_id   = @to_store_id
        FROM dbo.sku_units u
        INNER JOIN ranked r ON r.unit_id = u.unit_id
        WHERE r.rn <= @qty_recv;
      END;

      FETCH NEXT FROM cur INTO @line_id, @qty_recv, @sku_id;
    END;

    CLOSE cur; DEALLOCATE cur;
    DROP TABLE #recv;

    -- Stamp the document as STOCKED
    UPDATE dbo.stock_transfer_docs
    SET status     = 'STOCKED',
        stocked_by = @stocked_by,
        stocked_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE doc_id = @doc_id;

    DECLARE @source_request_id INT;
    SELECT @source_request_id = source_request_id
    FROM dbo.stock_transfer_docs
    WHERE doc_id = @doc_id;

    IF @source_request_id IS NOT NULL
      EXEC dbo.sp_TransferRequest_SyncReceivedFromDocs @request_id = @source_request_id;

    COMMIT TRANSACTION;

    SELECT doc_id, status, stocked_at FROM dbo.stock_transfer_docs WHERE doc_id = @doc_id;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    IF OBJECT_ID('tempdb..#recv') IS NOT NULL DROP TABLE #recv;
    DECLARE @msg2 NVARCHAR(500) = ERROR_MESSAGE(); RAISERROR(@msg2, 16, 1);
  END CATCH;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_StockTransferDoc_List
-- Summary list of transfer documents.
--   @to_store_id NULL  → all stores (HQ view)
--   @to_store_id set   → single store only
--   @status      NULL  → all statuses
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_StockTransferDoc_List
  @to_store_id         INT         = NULL,
  @status              VARCHAR(12) = NULL,
  @source_request_id   INT         = NULL,
  @top_n               INT         = 50
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP (@top_n)
    d.doc_id,
    d.doc_type,
    d.source_request_id,
    d.to_store_id,
    st.store_name,
    st.store_code,
    d.status,
    d.notes,
    d.dispatched_at,
    d.accepted_at,
    d.stocked_at,
    d.created_at,
    disp.full_name  AS dispatched_by_name,
    acc.full_name   AS accepted_by_name,
    stk.full_name   AS stocked_by_name,
    (SELECT COUNT(*) FROM dbo.stock_transfer_doc_lines WHERE doc_id = d.doc_id) AS line_count,
    (SELECT ISNULL(SUM(dl.qty_sent), 0) FROM dbo.stock_transfer_doc_lines dl WHERE dl.doc_id = d.doc_id) AS total_qty_sent
  FROM dbo.stock_transfer_docs d
  JOIN  dbo.stores st            ON st.store_id  = d.to_store_id
  LEFT JOIN dbo.users disp       ON disp.user_id = d.dispatched_by
  LEFT JOIN dbo.users acc        ON acc.user_id  = d.accepted_by
  LEFT JOIN dbo.users stk        ON stk.user_id  = d.stocked_by
  WHERE (@to_store_id IS NULL OR d.to_store_id = @to_store_id)
    AND (@status      IS NULL OR d.status       = @status)
    AND (@source_request_id IS NULL OR d.source_request_id = @source_request_id)
  ORDER BY d.created_at DESC;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_StockTransferDoc_GetById
-- RS1 → document header row
-- RS2 → enriched line items (SKU / product / brand / colour)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_StockTransferDoc_GetById
  @doc_id INT
AS
BEGIN
  SET NOCOUNT ON;

  -- RS1: header
  SELECT
    d.doc_id,
    d.doc_type,
    d.source_request_id,
    d.to_store_id,
    st.store_name,
    st.store_code,
    d.status,
    d.notes,
    d.dispatched_at,
    d.accepted_at,
    d.stocked_at,
    d.created_at,
    disp.full_name  AS dispatched_by_name,
    acc.full_name   AS accepted_by_name,
    stk.full_name   AS stocked_by_name
  FROM dbo.stock_transfer_docs d
  JOIN  dbo.stores st            ON st.store_id  = d.to_store_id
  LEFT JOIN dbo.users disp       ON disp.user_id = d.dispatched_by
  LEFT JOIN dbo.users acc        ON acc.user_id  = d.accepted_by
  LEFT JOIN dbo.users stk        ON stk.user_id  = d.stocked_by
  WHERE d.doc_id = @doc_id;

  -- RS2: enriched lines
  SELECT
    l.line_id,
    l.doc_id,
    l.sku_id,
    sk.sku_code,
    sk.barcode,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    pm.ew_collection,
    pm.style_model,
    pm.product_type,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    )))                        AS brand_name,
    ISNULL(pic.colour_name,'') AS colour_name,
    ISNULL(pic.colour_code,'') AS colour_code,
    sk.sale_price,
    l.qty_sent,
    l.qty_received,
    CAST(ISNULL(ptc.requires_unit_barcode, 1) AS BIT) AS requires_unit_barcode
  FROM dbo.stock_transfer_doc_lines l
  JOIN dbo.skus sk                        ON sk.sku_id            = l.sku_id
  JOIN dbo.product_master pm              ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.pos_product_type_config ptc ON ptc.product_type_key = pm.product_type
  LEFT JOIN dbo.home_brands hb            ON pm.home_brand_id     = hb.brand_id
  LEFT JOIN dbo.maker_master mm          ON pm.maker_master_id   = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id    = pic.colour_id
  WHERE l.doc_id = @doc_id
  ORDER BY l.line_id;

  -- RS3: units on this document (for per-piece scan at store receipt)
  SELECT
    du.line_id,
    du.unit_id,
    u.unit_no,
    u.unit_barcode,
    u.status AS unit_status
  FROM dbo.stock_transfer_doc_units du
  INNER JOIN dbo.sku_units u ON u.unit_id = du.unit_id
  WHERE du.doc_id = @doc_id
  ORDER BY du.line_id, u.unit_no;
END;
GO
