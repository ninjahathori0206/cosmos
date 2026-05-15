USE [CosmosERP];
GO

-- Migration 33: sp_PurchaseHeader_RevertToDraft (return to purchase stage from bill verify / discrepancy)
-- Canonical copy: sql/sp/pipeline_v2.sql

IF OBJECT_ID('dbo.sp_PurchaseHeader_RevertToDraft', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_RevertToDraft;
GO
CREATE PROCEDURE dbo.sp_PurchaseHeader_RevertToDraft
  @header_id INT
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (
      SELECT 1 FROM dbo.purchase_headers
      WHERE header_id = @header_id
        AND pipeline_status IN ('PENDING_BILL_VERIFICATION', 'BILL_DISCREPANCY')
    )
    BEGIN
      RAISERROR('Revert to draft is only allowed while pending bill verification or in bill discrepancy.', 16, 1);
      RETURN;
    END;

    UPDATE dbo.purchase_headers SET
      pipeline_status    = 'DRAFT',
      bill_status          = 'DRAFT',
      actual_bill_amt      = NULL,
      bill_number          = NULL,
      bill_date            = NULL,
      discrepancy_note     = NULL,
      updated_at           = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE header_id = @header_id;

    SELECT header_id, pipeline_status, bill_status FROM dbo.purchase_headers WHERE header_id = @header_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000) = ERROR_MESSAGE(); RAISERROR(@e, 16, 1); END CATCH;
END;
GO
