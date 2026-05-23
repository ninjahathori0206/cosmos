-- ═══════════════════════════════════════════════════════════════════════════════
-- Transfer Request stored procedures  (PRD §8.3 lifecycle)
-- Run after migration 24_transfer_requests.sql
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_Create
-- Creates a request header; returns new request_id in a single-row recordset.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_Create
  @store_id INT,
  @user_id  INT,
  @notes    NVARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.transfer_requests (store_id, requested_by, notes)
  VALUES (@store_id, @user_id, @notes);
  SELECT SCOPE_IDENTITY() AS request_id;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_AddLine
-- Appends one SKU line to an existing request.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_AddLine
  @request_id    INT,
  @sku_id        INT,
  @requested_qty INT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.transfer_request_lines (request_id, sku_id, requested_qty)
  VALUES (@request_id, @sku_id, @requested_qty);
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_List
-- Returns a summary list of requests.
--   @store_id NULL  → all stores (HQ / admin view)
--   @store_id set   → single store only (store manager view)
--   @status   NULL  → all statuses
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_List
  @store_id INT         = NULL,
  @status   VARCHAR(20) = NULL,
  @top_n    INT         = 50
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP (@top_n)
    r.request_id,
    r.store_id,
    st.store_name,
    r.status,
    r.notes,
    r.review_notes,
    r.created_at,
    r.updated_at,
    r.reviewed_at,
    r.dispatched_at,
    r.received_at,
    ru.username   AS requested_by_name,
    ru.full_name  AS requested_by_fullname,
    rvu.username  AS reviewed_by_name,
    rdu.username  AS dispatched_by_name,
    rcv.username  AS received_by_name,
    (SELECT COUNT(*) FROM dbo.transfer_request_lines WHERE request_id = r.request_id) AS line_count,
    (SELECT ISNULL(SUM(requested_qty), 0) FROM dbo.transfer_request_lines WHERE request_id = r.request_id) AS total_requested_qty
  FROM dbo.transfer_requests r
  JOIN dbo.stores st    ON st.store_id  = r.store_id
  JOIN dbo.users  ru    ON ru.user_id   = r.requested_by
  LEFT JOIN dbo.users rvu ON rvu.user_id = r.reviewed_by
  LEFT JOIN dbo.users rdu ON rdu.user_id = r.dispatched_by
  LEFT JOIN dbo.users rcv ON rcv.user_id = r.received_by
  WHERE (@store_id IS NULL OR r.store_id = @store_id)
    AND (
      @status IS NULL
      OR (@status = 'APPROVED' AND r.status IN ('APPROVED', 'PARTIALLY_DISPATCHED'))
      OR (@status <> 'APPROVED' AND r.status = @status)
    )
  ORDER BY r.created_at DESC;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_GetById
-- Returns two recordsets:
--   RS1 → request header row
--   RS2 → line items with SKU details
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_GetById
  @request_id INT
AS
BEGIN
  SET NOCOUNT ON;

  -- RS1: header
  SELECT
    r.request_id,
    r.store_id,
    st.store_name,
    r.status,
    r.notes,
    r.review_notes,
    r.created_at,
    r.updated_at,
    r.reviewed_at,
    r.dispatched_at,
    r.received_at,
    ru.username   AS requested_by_name,
    ru.full_name  AS requested_by_fullname,
    rvu.username  AS reviewed_by_name,
    rdu.username  AS dispatched_by_name,
    rcv.username  AS received_by_name
  FROM dbo.transfer_requests r
  JOIN dbo.stores st    ON st.store_id  = r.store_id
  JOIN dbo.users  ru    ON ru.user_id   = r.requested_by
  LEFT JOIN dbo.users rvu ON rvu.user_id = r.reviewed_by
  LEFT JOIN dbo.users rdu ON rdu.user_id = r.dispatched_by
  LEFT JOIN dbo.users rcv ON rcv.user_id = r.received_by
  WHERE r.request_id = @request_id;

  -- RS2: lines with SKU info (same joins as sp_StockTransfer_ListAvailable)
  SELECT
    l.line_id,
    l.request_id,
    l.sku_id,
    sk.sku_code,
    sk.barcode,
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
    )))                            AS brand_name,
    ISNULL(pic.colour_name,'')      AS colour_name,
    ISNULL(pic.colour_code,'')      AS colour_code,
    ISNULL(sb.qty, 0)               AS warehouse_qty,
    sk.sale_price,
    l.requested_qty,
    l.approved_qty,
    l.dispatched_qty,
    l.received_qty
  FROM dbo.transfer_request_lines l
  JOIN dbo.skus sk                        ON sk.sku_id             = l.sku_id
  JOIN dbo.product_master pm              ON sk.product_master_id  = pm.product_id
  LEFT JOIN dbo.pos_product_type_config ptc ON ptc.product_type_key = pm.product_type
  LEFT JOIN dbo.home_brands hb            ON pm.home_brand_id      = hb.brand_id
  LEFT JOIN dbo.maker_master mm           ON pm.maker_master_id    = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id     = pic.colour_id
  LEFT JOIN dbo.stock_balances sb         ON sb.sku_id = l.sku_id AND sb.location_type = 'WAREHOUSE' AND sb.location_id = dbo.fn_Foundry_PrimaryWarehouseLocationId()
  WHERE l.request_id = @request_id
  ORDER BY l.line_id;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_UpdateStatus
-- Advances the lifecycle status and stamps the appropriate timestamp/user.
-- Raises error 50001 if the request does not exist.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_UpdateStatus
  @request_id INT,
  @status     VARCHAR(20),
  @user_id    INT,
  @notes      NVARCHAR(500) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.transfer_requests WHERE request_id = @request_id)
    THROW 50001, 'Transfer request not found.', 1;

  UPDATE dbo.transfer_requests
  SET
    status         = @status,
    updated_at     = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    -- APPROVED / REJECTED: stamp reviewer
    reviewed_by    = CASE WHEN @status IN ('APPROVED','REJECTED') THEN @user_id    ELSE reviewed_by    END,
    reviewed_at    = CASE WHEN @status IN ('APPROVED','REJECTED') THEN DATEADD(MINUTE, 330, SYSUTCDATETIME())   ELSE reviewed_at    END,
    review_notes   = CASE WHEN @status IN ('APPROVED','REJECTED') AND @notes IS NOT NULL THEN @notes ELSE review_notes END,
    -- DISPATCHED / PARTIALLY_DISPATCHED: stamp dispatcher on first shipment only
    dispatched_by  = CASE WHEN @status IN ('DISPATCHED','PARTIALLY_DISPATCHED') AND dispatched_by IS NULL THEN @user_id ELSE dispatched_by END,
    dispatched_at  = CASE WHEN @status IN ('DISPATCHED','PARTIALLY_DISPATCHED') AND dispatched_at IS NULL THEN DATEADD(MINUTE, 330, SYSUTCDATETIME()) ELSE dispatched_at END,
    -- RECEIVED: stamp receiver
    received_by    = CASE WHEN @status = 'RECEIVED'   THEN @user_id  ELSE received_by    END,
    received_at    = CASE WHEN @status = 'RECEIVED'   THEN DATEADD(MINUTE, 330, SYSUTCDATETIME()) ELSE received_at    END
  WHERE request_id = @request_id;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_SetLineQty
-- Updates approved / dispatched / received qty for a single line.
-- Pass NULL for any qty column that should remain unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_SetLineQty
  @line_id        INT,
  @approved_qty   INT = NULL,
  @dispatched_qty INT = NULL,
  @received_qty   INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.transfer_request_lines
  SET
    approved_qty   = COALESCE(@approved_qty,   approved_qty),
    dispatched_qty = COALESCE(@dispatched_qty, dispatched_qty),
    received_qty   = COALESCE(@received_qty,   received_qty)
  WHERE line_id = @line_id;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_AddDispatchedQty
-- Increments dispatched_qty on a line (multi-shipment dispatch).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_AddDispatchedQty
  @line_id INT,
  @add_qty INT
AS
BEGIN
  SET NOCOUNT ON;
  IF @add_qty IS NULL OR @add_qty < 1
    RETURN;
  UPDATE dbo.transfer_request_lines
  SET dispatched_qty = ISNULL(dispatched_qty, 0) + @add_qty
  WHERE line_id = @line_id;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_SyncDispatchedFromDocs
-- Reconcile transfer_request_lines.dispatched_qty from stock_transfer_docs
-- linked via source_request_id; recompute header status (APPROVED /
-- PARTIALLY_DISPATCHED / DISPATCHED). Source of truth after shipment dispatch.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_SyncDispatchedFromDocs
  @request_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.transfer_requests WHERE request_id = @request_id)
    THROW 50001, 'Transfer request not found.', 1;

  UPDATE l
  SET dispatched_qty = ISNULL(agg.total_sent, 0)
  FROM dbo.transfer_request_lines l
  LEFT JOIN (
    SELECT
      d.source_request_id AS request_id,
      dl.sku_id,
      SUM(dl.qty_sent) AS total_sent
    FROM dbo.stock_transfer_docs d
    INNER JOIN dbo.stock_transfer_doc_lines dl ON dl.doc_id = d.doc_id
    WHERE d.source_request_id = @request_id
    GROUP BY d.source_request_id, dl.sku_id
  ) agg ON agg.request_id = l.request_id AND agg.sku_id = l.sku_id
  WHERE l.request_id = @request_id;

  DECLARE @new_status VARCHAR(20);
  DECLARE @cur_status VARCHAR(20);
  SELECT @cur_status = status FROM dbo.transfer_requests WHERE request_id = @request_id;

  DECLARE @any_dispatched BIT = 0;
  DECLARE @all_complete BIT = 1;

  IF EXISTS (
    SELECT 1
    FROM dbo.transfer_request_lines l
    WHERE l.request_id = @request_id
      AND ISNULL(l.dispatched_qty, 0) > 0
  )
    SET @any_dispatched = 1;

  IF EXISTS (
    SELECT 1
    FROM dbo.transfer_request_lines l
    WHERE l.request_id = @request_id
      AND ISNULL(l.dispatched_qty, 0) < CASE
        WHEN l.approved_qty IS NOT NULL AND l.approved_qty > 0 THEN l.approved_qty
        ELSE l.requested_qty
      END
  )
    SET @all_complete = 0;

  IF @any_dispatched = 1 AND @all_complete = 1
    SET @new_status = 'DISPATCHED';
  ELSE IF @any_dispatched = 1
    SET @new_status = 'PARTIALLY_DISPATCHED';
  ELSE
    SET @new_status = @cur_status;

  IF @new_status IN ('DISPATCHED', 'PARTIALLY_DISPATCHED')
     AND @cur_status IN ('APPROVED', 'PARTIALLY_DISPATCHED', 'DISPATCHED')
     AND @new_status <> @cur_status
  BEGIN
    UPDATE dbo.transfer_requests
    SET
      status     = @new_status,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE request_id = @request_id;
  END
  ELSE IF @any_dispatched = 0 AND @cur_status IN ('PARTIALLY_DISPATCHED', 'DISPATCHED')
  BEGIN
    -- Docs removed or qty zeroed — revert to APPROVED if nothing shipped on docs
    UPDATE dbo.transfer_requests
    SET
      status     = 'APPROVED',
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE request_id = @request_id;
    SET @new_status = 'APPROVED';
  END
  ELSE
    SET @new_status = @cur_status;

  SELECT @request_id AS request_id, @new_status AS status;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_SyncReceivedFromDocs
-- Reconcile transfer_request_lines.received_qty from STOCKED transfer documents
-- linked via source_request_id. Optionally advances header to RECEIVED when
-- every dispatched line is fully received at the store.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_SyncReceivedFromDocs
  @request_id INT
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.transfer_requests WHERE request_id = @request_id)
    THROW 50001, 'Transfer request not found.', 1;

  UPDATE l
  SET received_qty = ISNULL(agg.total_recv, 0)
  FROM dbo.transfer_request_lines l
  LEFT JOIN (
    SELECT
      d.source_request_id AS request_id,
      dl.sku_id,
      SUM(ISNULL(dl.qty_received, 0)) AS total_recv
    FROM dbo.stock_transfer_docs d
    INNER JOIN dbo.stock_transfer_doc_lines dl ON dl.doc_id = d.doc_id
    WHERE d.source_request_id = @request_id
      AND d.status = N'STOCKED'
    GROUP BY d.source_request_id, dl.sku_id
  ) agg ON agg.request_id = l.request_id AND agg.sku_id = l.sku_id
  WHERE l.request_id = @request_id;

  DECLARE @cur_status VARCHAR(20);
  SELECT @cur_status = status FROM dbo.transfer_requests WHERE request_id = @request_id;

  DECLARE @fully_received BIT = 1;

  IF EXISTS (
    SELECT 1
    FROM dbo.transfer_request_lines l
    WHERE l.request_id = @request_id
      AND ISNULL(l.dispatched_qty, 0) > 0
      AND ISNULL(l.received_qty, 0) < ISNULL(l.dispatched_qty, 0)
  )
    SET @fully_received = 0;

  IF @fully_received = 1
     AND EXISTS (
       SELECT 1
       FROM dbo.transfer_request_lines
       WHERE request_id = @request_id
         AND ISNULL(dispatched_qty, 0) > 0
     )
     AND @cur_status IN ('DISPATCHED', 'PARTIALLY_DISPATCHED')
  BEGIN
    UPDATE dbo.transfer_requests
    SET
      status     = 'RECEIVED',
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE request_id = @request_id;
    SET @cur_status = 'RECEIVED';
  END

  SELECT @request_id AS request_id, @cur_status AS status;
END;
GO


-- ─────────────────────────────────────────────────────────────────────────────
-- sp_TransferRequest_DispatchShipment
-- Atomic goods-request shipment: transfer document + sync lines/status from docs.
-- Transfer documents are the source of truth for dispatched_qty.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_TransferRequest_DispatchShipment
  @request_id    INT,
  @lines_json    NVARCHAR(MAX),
  @to_store_id   INT,
  @notes         NVARCHAR(500) = NULL,
  @dispatched_by INT           = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @started_here BIT = 0;
  DECLARE @doc_id INT;
  DECLARE @new_status VARCHAR(20);
  DECLARE @req_status VARCHAR(20);
  DECLARE @req_store_id INT;
  DECLARE @status_err NVARCHAR(200);

  IF @@TRANCOUNT = 0
  BEGIN
    BEGIN TRANSACTION;
    SET @started_here = 1;
  END;

  BEGIN TRY
    SELECT @req_status = status, @req_store_id = store_id
    FROM dbo.transfer_requests
    WHERE request_id = @request_id;

    IF @req_status IS NULL
      THROW 50001, 'Transfer request not found.', 1;

    IF @req_status NOT IN ('APPROVED', 'PARTIALLY_DISPATCHED')
    BEGIN
      SET @status_err = N'Cannot dispatch shipment while request status is ' + ISNULL(@req_status, N'(unknown)') + N'.';
      RAISERROR(@status_err, 16, 1);
    END

    IF @to_store_id <> @req_store_id
      RAISERROR('Destination store does not match the transfer request store.', 16, 1);

    CREATE TABLE #doc_out (doc_id INT);

    INSERT INTO #doc_out (doc_id)
    EXEC dbo.sp_StockTransferDoc_Dispatch
      @lines_json                 = @lines_json,
      @to_store_id                = @to_store_id,
      @doc_type                   = 'REQUEST',
      @source_request_id          = @request_id,
      @notes                      = @notes,
      @dispatched_by              = @dispatched_by,
      @caller_manages_transaction = 1;

    SELECT @doc_id = doc_id FROM #doc_out;

    IF @doc_id IS NULL
      RAISERROR('Transfer document was not created.', 16, 1);

    CREATE TABLE #sync_out (
      request_id INT,
      status     VARCHAR(20)
    );

    INSERT INTO #sync_out (request_id, status)
    EXEC dbo.sp_TransferRequest_SyncDispatchedFromDocs @request_id = @request_id;

    SELECT @new_status = status FROM #sync_out;

    IF @new_status IS NULL
      SELECT @new_status = status FROM dbo.transfer_requests WHERE request_id = @request_id;

    EXEC dbo.sp_TransferRequest_UpdateStatus
      @request_id = @request_id,
      @status     = @new_status,
      @user_id    = @dispatched_by,
      @notes      = @notes;

    IF @started_here = 1
      COMMIT TRANSACTION;

    SELECT @doc_id AS doc_id, @new_status AS status;

  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0
      ROLLBACK TRANSACTION;
    IF OBJECT_ID('tempdb..#doc_out') IS NOT NULL DROP TABLE #doc_out;
    IF OBJECT_ID('tempdb..#sync_out') IS NOT NULL DROP TABLE #sync_out;
    DECLARE @msg_dispatch NVARCHAR(500) = ERROR_MESSAGE();
    RAISERROR(@msg_dispatch, 16, 1);
  END CATCH;
END;
GO
