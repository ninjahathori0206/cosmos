USE [CosmosERP];
GO

-- Item-level category (e.g. Frames, Sunglasses) — replaces reliance on bill-level source_type for classification
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'purchase_items' AND COLUMN_NAME = 'category'
)
BEGIN
  ALTER TABLE dbo.purchase_items ADD category VARCHAR(50) NULL;
END;
GO
