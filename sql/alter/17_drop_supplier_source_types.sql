-- Migration 17: Remove obsolete supplier source types column
USE [CosmosERP];
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.suppliers')
    AND name = 'source_types_supplied'
)
BEGIN
  ALTER TABLE dbo.suppliers DROP COLUMN source_types_supplied;
  PRINT 'Dropped source_types_supplied from dbo.suppliers';
END
ELSE
BEGIN
  PRINT 'source_types_supplied already removed - skipped';
END;
GO
