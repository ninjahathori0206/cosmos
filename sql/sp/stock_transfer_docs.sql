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
  @lines_json        NVARCHAR(MAX),
  @to_store_id       INT,
  @doc_type          VARCHAR(10)   = 'DIRECT',
  @source_request_id INT           = NULL,
  @notes             NVARCHAR(500) = NULL,
  @dispatched_by     INT           = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRANSACTION;
  BEGIN TRY

    -- Validate destination store
    IF NOT EXISTS (
      SELECT 1 FROM dbo.stores WHERE store_id = @to_store_id AND status = 'ACTIVE'
    )
      RAISERROR('Destination store not found or inactive.', 16, 1);

    -- Parse lines into temp table
    CREATE TABLE #lines (sku_id INT NOT NULL, qty INT NOT NULL);

    INSERT INTO #lines (sku_id, qty)
    SELECT CAST(j.sku_id AS INT), CAST(j.qty AS INT)
    FROM OPENJSON(@lines_json)
      WITH (sku_id INT '$.sku_id', qty INT '$.qty') j
    WHERE CAST(j.qty AS INT) > 0;

    IF NOT EXISTS (SELECT 1 FROM #lines)
      RAISERROR('No valid transfer lines provided.', 16, 1);

    -- Create the document header
    INSERT INTO dbo.stock_transfer_docs
      (doc_type, source_request_id, to_store_id, status, notes, dispatched_by, dispatched_at)
    VALUES
      (@doc_type, @source_request_id, @to_store_id, 'DISPATCHED', @notes, @dispatched_by, DATEADD(MINUTE, 330, SYSUTCDATETIME()));

    DECLARE @doc_id INT = SCOPE_IDENTITY();

    -- Validate warehouse stock and insert lines
    DECLARE @sku_id  INT, @qty INT, @wh_qty INT;

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
      SELECT sku_id, qty FROM #lines;
    OPEN cur;
    FETCH NEXT FROM cur INTO @sku_id, @qty;

    WHILE @@FETCH_STATUS = 0
    BEGIN
      SELECT @wh_qty = ISNULL(qty, 0)
      FROM dbo.stock_balances
      WHERE sku_id = @sku_id AND location_type = 'WAREHOUSE';

      IF ISNULL(@wh_qty, 0) < @qty
        RAISERROR('Insufficient warehouse stock for one or more SKUs.', 16, 1);

      -- Decrement WAREHOUSE (stock physically leaving HQ)
      UPDATE dbo.stock_balances
      SET qty = qty - @qty, last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE sku_id = @sku_id AND location_type = 'WAREHOUSE';

      -- Insert document line
      INSERT INTO dbo.stock_transfer_doc_lines (doc_id, sku_id, qty_sent)
      VALUES (@doc_id, @sku_id, @qty);

      FETCH NEXT FROM cur INTO @sku_id, @qty;
    END;

    CLOSE cur; DEALLOCATE cur;
    DROP TABLE #lines;
    COMMIT TRANSACTION;

    SELECT @doc_id AS doc_id;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
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
        -- Upsert STORE balance (stock arrives at showroom)
        IF EXISTS (
          SELECT 1 FROM dbo.stock_balances
          WHERE sku_id = @sku_id AND location_type = 'STORE' AND location_id = @to_store_id
        )
          UPDATE dbo.stock_balances
          SET qty = qty + @qty_recv, last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE sku_id = @sku_id AND location_type = 'STORE' AND location_id = @to_store_id;
        ELSE
          INSERT INTO dbo.stock_balances (sku_id, location_type, location_id, location_name, qty, last_updated)
          VALUES (@sku_id, 'STORE', @to_store_id, @store_name, @qty_recv, DATEADD(MINUTE, 330, SYSUTCDATETIME()));

        -- Audit movement
        INSERT INTO dbo.stock_movements
          (sku_id, from_location_type, from_location_id, to_location_type, to_location_id,
           qty, movement_type, reference_id, notes, created_by)
        VALUES
          (@sku_id, 'WAREHOUSE', 1, 'STORE', @to_store_id,
           @qty_recv, 'HQ_TO_STORE', @doc_id, NULL, @stocked_by);
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
  @to_store_id INT         = NULL,
  @status      VARCHAR(12) = NULL,
  @top_n       INT         = 50
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
    (SELECT COUNT(*) FROM dbo.stock_transfer_doc_lines WHERE doc_id = d.doc_id) AS line_count
  FROM dbo.stock_transfer_docs d
  JOIN  dbo.stores st            ON st.store_id  = d.to_store_id
  LEFT JOIN dbo.users disp       ON disp.user_id = d.dispatched_by
  LEFT JOIN dbo.users acc        ON acc.user_id  = d.accepted_by
  LEFT JOIN dbo.users stk        ON stk.user_id  = d.stocked_by
  WHERE (@to_store_id IS NULL OR d.to_store_id = @to_store_id)
    AND (@status      IS NULL OR d.status       = @status)
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
    ISNULL(hb.brand_name,'')   AS brand_name,
    ISNULL(pic.colour_name,'') AS colour_name,
    ISNULL(pic.colour_code,'') AS colour_code,
    sk.sale_price,
    l.qty_sent,
    l.qty_received
  FROM dbo.stock_transfer_doc_lines l
  JOIN dbo.skus sk                        ON sk.sku_id            = l.sku_id
  JOIN dbo.product_master pm              ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb            ON pm.home_brand_id     = hb.brand_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id    = pic.colour_id
  WHERE l.doc_id = @doc_id
  ORDER BY l.line_id;
END;
GO
