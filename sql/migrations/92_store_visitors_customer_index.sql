/*
  92_store_visitors_customer_index.sql
  CX Customer 360 — visits tab lookup by customer_id
*/
PRINT N'--- 92_store_visitors_customer_index.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.store_visitors', N'U') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.store_visitors')
      AND name = N'IX_store_visitors_customer_checkin'
  )
BEGIN
  CREATE INDEX IX_store_visitors_customer_checkin
    ON dbo.store_visitors(customer_id, checkin_at DESC)
    WHERE customer_id IS NOT NULL;
  PRINT N'Created IX_store_visitors_customer_checkin.';
END
ELSE
  PRINT N'IX_store_visitors_customer_checkin skipped or table missing.';
GO

PRINT N'--- 92_store_visitors_customer_index.sql complete ---';
GO
