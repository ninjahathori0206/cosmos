-- Migration 36: restore per-line purchase_rate for Finance valuation + rate intelligence
USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'purchase_rate'
)
  ALTER TABLE dbo.purchase_items ADD purchase_rate DECIMAL(12,2) NULL;
GO

-- Backfill unit rate from existing payable where rate was dropped in 35b
UPDATE pi SET purchase_rate = ROUND(pi.finance_payable_amt / NULLIF(pi.quantity, 0), 2)
FROM dbo.purchase_items pi
WHERE pi.purchase_rate IS NULL
  AND pi.finance_payable_amt IS NOT NULL
  AND pi.quantity > 0;
GO

PRINT 'Migration 36 complete — purchase_items.purchase_rate';
GO
