/*
  HQ lab intake flags on LAB sub-orders + SENT_TO_LAB -> LAB_FITTING transition.
*/

PRINT N'Applying lab intake flags & SENT_TO_LAB transitions...';

USE [CosmosERP];
GO

IF COL_LENGTH(N'dbo.pos_sub_orders', N'lab_received_confirmed') IS NULL
BEGIN
  ALTER TABLE dbo.pos_sub_orders ADD
    lab_received_confirmed     BIT NOT NULL CONSTRAINT DF_pos_so_lab_rcv DEFAULT (0),
    lab_backorder_confirmed    BIT NOT NULL CONSTRAINT DF_pos_so_lab_bo DEFAULT (0),
    lab_received_confirmed_at  DATETIME2(0) NULL,
    lab_backorder_confirmed_at DATETIME2(0) NULL;
  PRINT N'Added lab intake columns to pos_sub_orders.';
END
ELSE
  PRINT N'pos_sub_orders lab intake columns already present.';
GO

IF COL_LENGTH(N'dbo.oe_sub_orders', N'lab_received_confirmed') IS NULL
BEGIN
  ALTER TABLE dbo.oe_sub_orders ADD
    lab_received_confirmed     BIT NOT NULL CONSTRAINT DF_oe_so_lab_rcv DEFAULT (0),
    lab_backorder_confirmed    BIT NOT NULL CONSTRAINT DF_oe_so_lab_bo DEFAULT (0),
    lab_received_confirmed_at  DATETIME2(0) NULL,
    lab_backorder_confirmed_at DATETIME2(0) NULL;
  PRINT N'Added lab intake columns to oe_sub_orders.';
END
ELSE
  PRINT N'oe_sub_orders lab intake columns already present.';
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

UPDATE dbo.pos_sub_orders
SET
  lab_received_confirmed = 1,
  lab_backorder_confirmed = 1,
  lab_received_confirmed_at = COALESCE(lab_received_confirmed_at, @now),
  lab_backorder_confirmed_at = COALESCE(lab_backorder_confirmed_at, @now)
WHERE fulfillment = N'LAB'
  AND lab_workflow_status IS NOT NULL
  AND lab_workflow_status <> N'SENT_TO_LAB';

UPDATE dbo.oe_sub_orders
SET
  lab_received_confirmed = 1,
  lab_backorder_confirmed = 1,
  lab_received_confirmed_at = COALESCE(lab_received_confirmed_at, @now),
  lab_backorder_confirmed_at = COALESCE(lab_backorder_confirmed_at, @now)
WHERE fulfillment = N'LAB'
  AND lab_workflow_status IS NOT NULL
  AND lab_workflow_status <> N'SENT_TO_LAB';

PRINT N'Backfilled intake flags for LAB lines not stuck on SENT_TO_LAB.';
GO

IF OBJECT_ID(N'dbo.pos_lab_transitions', N'U') IS NOT NULL
BEGIN
  DELETE FROM dbo.pos_lab_transitions
  WHERE from_status = N'SENT_TO_LAB'
    AND to_status = N'FRAME_PENDING_LENS_BACKORDER'
    AND actor_role = N'lab_manager';

  IF NOT EXISTS (
    SELECT 1 FROM dbo.pos_lab_transitions
    WHERE from_status = N'SENT_TO_LAB' AND to_status = N'LAB_FITTING' AND actor_role = N'lab_manager'
  )
  INSERT INTO dbo.pos_lab_transitions (from_status, to_status, actor_role, requires_note)
  VALUES (N'SENT_TO_LAB', N'LAB_FITTING', N'lab_manager', 0);

  PRINT N'pos_lab_transitions updated (SENT_TO_LAB -> LAB_FITTING).';
END;
GO
