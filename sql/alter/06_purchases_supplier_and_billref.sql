-- Migration: add supplier_id (mandatory from-vendor) and bill_ref (batch grouping) to purchases
USE [CosmosERP];
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchases') AND name = 'supplier_id')
BEGIN
  ALTER TABLE dbo.purchases ADD supplier_id INT NULL;
  ALTER TABLE dbo.purchases ADD CONSTRAINT FK_purchases_supplier
    FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(supplier_id);
  PRINT 'Added supplier_id to dbo.purchases';
END
ELSE
  PRINT 'supplier_id already exists on dbo.purchases — skipped';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchases') AND name = 'bill_ref')
BEGIN
  ALTER TABLE dbo.purchases ADD bill_ref VARCHAR(100) NULL;
  PRINT 'Added bill_ref to dbo.purchases';
END
ELSE
  PRINT 'bill_ref already exists on dbo.purchases — skipped';
GO
