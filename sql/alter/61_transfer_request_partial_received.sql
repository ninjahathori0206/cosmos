-- Migration 61: PARTIALLY_RECEIVED status for partial stocking vs approved qty
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
    status IN (
      'SUBMITTED',
      'APPROVED',
      'PARTIALLY_DISPATCHED',
      'DISPATCHED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'REJECTED'
    )
  );
GO

-- RECEIVED but not fully stocked vs approved cap → PARTIALLY_RECEIVED
UPDATE r
SET status = 'PARTIALLY_RECEIVED',
    updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.transfer_requests r
WHERE r.status = 'RECEIVED'
  AND EXISTS (
    SELECT 1
    FROM dbo.transfer_request_lines l
    WHERE l.request_id = r.request_id
      AND ISNULL(l.received_qty, 0) < CASE
        WHEN l.approved_qty IS NOT NULL AND l.approved_qty > 0 THEN l.approved_qty
        ELSE l.requested_qty
      END
  );
GO

PRINT 'Migration 61: transfer_requests PARTIALLY_RECEIVED — OK';
GO
