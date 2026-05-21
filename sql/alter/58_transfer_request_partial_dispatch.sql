-- Migration 58: PARTIALLY_DISPATCHED status for multi-shipment Goods Request dispatch
USE [CosmosERP];
GO

IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE name = 'CHK_TR_status' AND parent_object_id = OBJECT_ID(N'dbo.transfer_requests')
)
  ALTER TABLE dbo.transfer_requests DROP CONSTRAINT CHK_TR_status;
GO

ALTER TABLE dbo.transfer_requests
  ADD CONSTRAINT CHK_TR_status CHECK (
    status IN ('SUBMITTED','APPROVED','PARTIALLY_DISPATCHED','DISPATCHED','RECEIVED','REJECTED')
  );
GO

-- Requests marked DISPATCHED but lines not fully shipped → PARTIALLY_DISPATCHED
UPDATE r
SET status = 'PARTIALLY_DISPATCHED',
    updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.transfer_requests r
WHERE r.status = 'DISPATCHED'
  AND EXISTS (
    SELECT 1
    FROM dbo.transfer_request_lines l
    WHERE l.request_id = r.request_id
      AND ISNULL(l.dispatched_qty, 0) < COALESCE(NULLIF(l.approved_qty, 0), l.requested_qty)
  );
GO

PRINT 'Migration 58: transfer_requests PARTIALLY_DISPATCHED — OK';
GO
