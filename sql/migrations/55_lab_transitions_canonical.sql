/*
  Migration 55 — Canonical lab workflow transition table.

  Goals:
  1. Replace phantom actor slots (lab_manager, qc_team) with the real role: hq_manager.
  2. Remove the FRAME_* backorder chain — no UI drives it and intake flags send
     orders directly SENT_TO_LAB → LAB_FITTING.
  3. Remove READY_FOR_DELIVERY → DELIVERED and DELIVERED → BALANCE_COLLECTED rows —
     those transitions are owned exclusively by the handover API
     (advanceLabSubOrdersThroughInvoiced) and must never be reachable via lab-status.
  4. Remap any live sub-orders stranded on FRAME_* statuses → LAB_FITTING.

  Idempotent — safe to re-run.
  Requires: dbo.pos_lab_transitions table (sql/tables/05_pos_config.sql).

  Actor role reference (post-migration):
    hq_manager      — Foundry HQ Manager (fitting, QC, dispatch)
    store_in_charge — StorePilot store incharge (accept, send, receive, store QC)
    store_staff     — StorePilot store staff (mark ready for delivery)
    system          — Internal/auto only (not callable via lab-status API)
*/

USE [CosmosERP];
GO

PRINT N'Migration 55: Applying canonical lab transitions...';

IF OBJECT_ID('dbo.pos_lab_transitions', 'U') IS NULL
BEGIN
  RAISERROR('Table dbo.pos_lab_transitions not found. Run sql/tables/05_pos_config.sql first.', 16, 1);
  RETURN;
END;
GO

-- ── Step 1: Remap live sub-orders stranded on FRAME_* statuses ──────────────
DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

DECLARE @framStatuses TABLE (s NVARCHAR(30));
INSERT INTO @framStatuses VALUES
  (N'FRAME_PENDING_LENS_BACKORDER'),
  (N'FRAME_RECEIVED_LENS_BACKORDER'),
  (N'FRAME_AND_LENS_RECEIVED');

IF OBJECT_ID('dbo.pos_sub_orders', 'U') IS NOT NULL
BEGIN
  DECLARE @posFrameCount INT = (
    SELECT COUNT(*) FROM dbo.pos_sub_orders
    WHERE fulfillment = N'LAB' AND lab_workflow_status IN (
      N'FRAME_PENDING_LENS_BACKORDER',
      N'FRAME_RECEIVED_LENS_BACKORDER',
      N'FRAME_AND_LENS_RECEIVED'
    )
  );
  IF @posFrameCount > 0
  BEGIN
    PRINT CONCAT(N'Remapping ', @posFrameCount, N' pos_sub_orders from FRAME_* → LAB_FITTING...');
    IF OBJECT_ID('dbo.pos_order_status_log', 'U') IS NOT NULL
    BEGIN
      INSERT INTO dbo.pos_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
      SELECT so.order_id, so.sub_order_id, so.lab_workflow_status, N'LAB_FITTING', NULL,
             N'Migration 55: FRAME_* remap → LAB_FITTING'
      FROM dbo.pos_sub_orders so
      WHERE so.fulfillment = N'LAB' AND so.lab_workflow_status IN (
        N'FRAME_PENDING_LENS_BACKORDER', N'FRAME_RECEIVED_LENS_BACKORDER', N'FRAME_AND_LENS_RECEIVED'
      );
    END;
    UPDATE dbo.pos_sub_orders
    SET lab_workflow_status = N'LAB_FITTING'
    WHERE fulfillment = N'LAB' AND lab_workflow_status IN (
      N'FRAME_PENDING_LENS_BACKORDER', N'FRAME_RECEIVED_LENS_BACKORDER', N'FRAME_AND_LENS_RECEIVED'
    );
  END;
  ELSE PRINT N'pos_sub_orders: no FRAME_* rows to remap.';
END;

IF OBJECT_ID('dbo.oe_sub_orders', 'U') IS NOT NULL
BEGIN
  DECLARE @oeFrameCount INT = (
    SELECT COUNT(*) FROM dbo.oe_sub_orders
    WHERE fulfillment = N'LAB' AND lab_workflow_status IN (
      N'FRAME_PENDING_LENS_BACKORDER',
      N'FRAME_RECEIVED_LENS_BACKORDER',
      N'FRAME_AND_LENS_RECEIVED'
    )
  );
  IF @oeFrameCount > 0
  BEGIN
    PRINT CONCAT(N'Remapping ', @oeFrameCount, N' oe_sub_orders from FRAME_* → LAB_FITTING...');
    IF OBJECT_ID('dbo.oe_order_status_log', 'U') IS NOT NULL
    BEGIN
      INSERT INTO dbo.oe_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
      SELECT so.order_id, so.sub_order_id, so.lab_workflow_status, N'LAB_FITTING', NULL,
             N'Migration 55: FRAME_* remap → LAB_FITTING'
      FROM dbo.oe_sub_orders so
      WHERE so.fulfillment = N'LAB' AND so.lab_workflow_status IN (
        N'FRAME_PENDING_LENS_BACKORDER', N'FRAME_RECEIVED_LENS_BACKORDER', N'FRAME_AND_LENS_RECEIVED'
      );
    END;
    UPDATE dbo.oe_sub_orders
    SET lab_workflow_status = N'LAB_FITTING'
    WHERE fulfillment = N'LAB' AND lab_workflow_status IN (
      N'FRAME_PENDING_LENS_BACKORDER', N'FRAME_RECEIVED_LENS_BACKORDER', N'FRAME_AND_LENS_RECEIVED'
    );
  END;
  ELSE PRINT N'oe_sub_orders: no FRAME_* rows to remap.';
END;
GO

-- ── Step 2: Replace transition table with canonical set ─────────────────────
PRINT N'Replacing pos_lab_transitions with canonical set...';

DELETE FROM dbo.pos_lab_transitions;

INSERT INTO dbo.pos_lab_transitions (from_status, to_status, actor_role, requires_note) VALUES
  -- Store incharge: early acceptance and store-side receipt/QC
  (N'ORDER_PLACED',        N'ADVANCE_PAID',         N'store_in_charge', 0),
  (N'ADVANCE_PAID',        N'SENT_TO_LAB',          N'store_in_charge', 0),
  (N'DISPATCHED_TO_STORE', N'RECEIVED_AT_STORE',    N'store_in_charge', 0),
  (N'RECEIVED_AT_STORE',   N'STORE_QC_PASS',        N'store_in_charge', 0),
  (N'RECEIVED_AT_STORE',   N'STORE_QC_PARTIAL',     N'store_in_charge', 1),
  (N'RECEIVED_AT_STORE',   N'QC_FAIL_STORE',        N'store_in_charge', 1),
  (N'QC_FAIL_STORE',       N'SENT_TO_LAB',          N'store_in_charge', 0),

  -- Store staff: mark ready for delivery after store QC
  (N'STORE_QC_PASS',       N'READY_FOR_DELIVERY',   N'store_staff',     0),
  (N'STORE_QC_PARTIAL',    N'READY_FOR_DELIVERY',   N'store_staff',     0),

  -- HQ Manager: all lab processing, QC, and dispatch (Foundry)
  (N'SENT_TO_LAB',         N'LAB_FITTING',          N'hq_manager',      0),
  (N'LAB_FITTING',         N'QC_PASS',              N'hq_manager',      0),
  (N'LAB_FITTING',         N'QC_FAIL_LAB',          N'hq_manager',      1),
  (N'QC_FAIL_LAB',         N'LAB_FITTING',          N'hq_manager',      0),
  (N'QC_PASS',             N'DISPATCHED_TO_STORE',  N'hq_manager',      0);

-- NOTE: READY_FOR_DELIVERY → DELIVERED → BALANCE_COLLECTED → INVOICED are NOT
-- in this table. They are set atomically by the handover API only.
-- DELIVERED and BALANCE_COLLECTED are a joint business event (counter handover).

PRINT N'pos_lab_transitions now has ' + CAST((SELECT COUNT(*) FROM dbo.pos_lab_transitions) AS VARCHAR) + N' rows.';
GO

PRINT N'Migration 55 complete.';
GO
