-- Migration 16: Add finance fields to suppliers
USE [CosmosERP];
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.suppliers') AND name='opening_balance')
BEGIN
  ALTER TABLE dbo.suppliers ADD opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0;
  PRINT 'Added opening_balance to dbo.suppliers';
END ELSE PRINT 'opening_balance already exists - skipped';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.suppliers') AND name='bank_name')
BEGIN
  ALTER TABLE dbo.suppliers ADD bank_name VARCHAR(100) NULL;
  PRINT 'Added bank_name to dbo.suppliers';
END ELSE PRINT 'bank_name already exists - skipped';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.suppliers') AND name='bank_account_no')
BEGIN
  ALTER TABLE dbo.suppliers ADD bank_account_no VARCHAR(50) NULL;
  PRINT 'Added bank_account_no to dbo.suppliers';
END ELSE PRINT 'bank_account_no already exists - skipped';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.suppliers') AND name='bank_ifsc')
BEGIN
  ALTER TABLE dbo.suppliers ADD bank_ifsc VARCHAR(20) NULL;
  PRINT 'Added bank_ifsc to dbo.suppliers';
END ELSE PRINT 'bank_ifsc already exists - skipped';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.suppliers') AND name='bank_account_holder')
BEGIN
  ALTER TABLE dbo.suppliers ADD bank_account_holder VARCHAR(200) NULL;
  PRINT 'Added bank_account_holder to dbo.suppliers';
END ELSE PRINT 'bank_account_holder already exists - skipped';
GO
