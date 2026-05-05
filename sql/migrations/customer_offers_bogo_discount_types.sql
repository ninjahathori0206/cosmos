-- Extend customer_offers.discount_type for structured BOGO / frame–lens rules (POS validates server-side).
PRINT N'--- customer_offers_bogo_discount_types.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.customer_offers', N'U') IS NOT NULL
BEGIN
  -- Original migration 35 uses NVARCHAR(10) — too short for BOGO_* / BUY_* codes.
  DECLARE @coDtMax int;
  SELECT @coDtMax = c.max_length
  FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id AND t.schema_id = SCHEMA_ID(N'dbo')
  WHERE t.name = N'customer_offers' AND c.name = N'discount_type';
  IF @coDtMax IS NOT NULL AND @coDtMax < 80
    ALTER TABLE dbo.customer_offers ALTER COLUMN discount_type NVARCHAR(40) NOT NULL;

  -- Original migration 35 creates CK_co_discount_type (PCT/FLAT/FREEBIE only).
  IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
      AND name = N'CK_co_discount_type'
  )
    ALTER TABLE dbo.customer_offers DROP CONSTRAINT CK_co_discount_type;

  IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
      AND name = N'CK_co_discount_type'
  )
  BEGIN
    ALTER TABLE dbo.customer_offers ADD CONSTRAINT CK_co_discount_type CHECK (
      discount_type IN (
        N'PCT',
        N'FLAT',
        N'FREEBIE',
        N'BOGO_LOWEST_FREE',
        N'BUY_FRAME_GET_LENS_FREE',
        N'BUY_LENS_GET_FRAME_FREE'
      )
    );
    PRINT N'customer_offers CK_co_discount_type added with BOGO types.';
  END
  ELSE
    PRINT N'CK_co_discount_type already present — skipped add.';
END
ELSE
  PRINT N'customer_offers table missing — skipped.';
GO
