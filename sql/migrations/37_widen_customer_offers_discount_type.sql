-- Widen customer_offers.discount_type: NVARCHAR(10) from migration 35 truncates
-- BOGO_LOWEST_FREE, BUY_FRAME_GET_LENS_FREE, BUY_LENS_GET_FRAME_FREE (max 22 chars).
PRINT N'--- 37_widen_customer_offers_discount_type.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.customer_offers', N'U') IS NOT NULL
BEGIN
  DECLARE @maxLen int;
  SELECT @maxLen = c.max_length
  FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id AND t.schema_id = SCHEMA_ID(N'dbo')
  WHERE t.name = N'customer_offers' AND c.name = N'discount_type';

  IF @maxLen IS NOT NULL AND @maxLen < 80
  BEGIN
    ALTER TABLE dbo.customer_offers ALTER COLUMN discount_type NVARCHAR(40) NOT NULL;
    PRINT N'customer_offers.discount_type widened to NVARCHAR(40).';
  END
  ELSE
    PRINT N'customer_offers.discount_type already wide enough — skipped.';
END
ELSE
  PRINT N'customer_offers table missing — skipped.';
GO
