-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 14: Add credit_days to suppliers for structured AP due-date tracking
-- ─────────────────────────────────────────────────────────────────────────────
USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.suppliers') AND name = 'credit_days'
)
BEGIN
  ALTER TABLE dbo.suppliers ADD credit_days INT NULL;
  PRINT 'Added credit_days to dbo.suppliers';
END
ELSE PRINT 'credit_days already exists on suppliers – skipped';
GO
