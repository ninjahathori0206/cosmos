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
    (SELECT COUNT(*) FROM dbo.transfer_request_lines WHERE request_id = r.request_id) AS line_count
  FROM dbo.transfer_requests r
  JOIN dbo.stores st    ON st.store_id  = r.store_id
  JOIN dbo.users  ru    ON ru.user_id   = r.requested_by
  LEFT JOIN dbo.users rvu ON rvu.user_id = r.reviewed_by
  LEFT JOIN dbo.users rdu ON rdu.user_id = r.dispatched_by
  LEFT JOIN dbo.users rcv ON rcv.user_id = r.received_by
  WHERE (@store_id IS NULL OR r.store_id = @store_id)
    AND (@status   IS NULL OR r.status   = @status)
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
    ISNULL(hb.brand_name,'')        AS brand_name,
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
  LEFT JOIN dbo.home_brands hb            ON pm.home_brand_id      = hb.brand_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id     = pic.colour_id
  LEFT JOIN dbo.stock_balances sb         ON sb.sku_id = l.sku_id AND sb.location_type = 'WAREHOUSE'
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
    -- DISPATCHED: stamp dispatcher
    dispatched_by  = CASE WHEN @status = 'DISPATCHED' THEN @user_id  ELSE dispatched_by  END,
    dispatched_at  = CASE WHEN @status = 'DISPATCHED' THEN DATEADD(MINUTE, 330, SYSUTCDATETIME()) ELSE dispatched_at  END,
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
