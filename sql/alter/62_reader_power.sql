PRINT '62_reader_power — reading_power columns for Readers (colour × power SKUs)';

USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'skus' AND COLUMN_NAME = 'reading_power'
)
BEGIN
  ALTER TABLE dbo.skus ADD reading_power VARCHAR(10) NULL;
  PRINT 'Added dbo.skus.reading_power';
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'purchase_item_colours' AND COLUMN_NAME = 'reading_power'
)
BEGIN
  ALTER TABLE dbo.purchase_item_colours ADD reading_power VARCHAR(10) NULL;
  PRINT 'Added dbo.purchase_item_colours.reading_power';
END;
GO

PRINT '62_reader_power complete. Redeploy sql/sp/pipeline_v2.sql and sql/sp/pos.sql for proc updates.';
