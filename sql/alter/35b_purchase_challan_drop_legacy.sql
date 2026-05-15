-- Migration 35b: Drop SPs that reference legacy columns, then drop columns
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_PurchaseHeader_GetById','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_GetById;
IF OBJECT_ID('dbo.sp_SKUv2_Generate','P') IS NOT NULL DROP PROCEDURE dbo.sp_SKUv2_Generate;
IF OBJECT_ID('dbo.sp_PurchaseHeader_GetSKUs','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_GetSKUs;
IF OBJECT_ID('dbo.sp_Finance_PurchaseReport','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_PurchaseReport;
IF OBJECT_ID('dbo.sp_PurchaseHeader_VerifyBill','P') IS NOT NULL DROP PROCEDURE dbo.sp_PurchaseHeader_VerifyBill;
GO

-- Drop default constraints before dropping columns
DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql = @sql + N'ALTER TABLE dbo.purchase_headers DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';' + CHAR(10)
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.purchase_headers')
  AND c.name IN ('transport_cost','expected_bill_amt','actual_bill_amt','bill_number','bill_date','discrepancy_note','pipeline_status','bill_status');
IF LEN(@sql) > 0 EXEC sp_executesql @sql;
GO

DECLARE @sql2 NVARCHAR(MAX) = N'';
SELECT @sql2 = @sql2 + N'ALTER TABLE dbo.purchase_items DROP CONSTRAINT ' + QUOTENAME(dc.name) + N';' + CHAR(10)
FROM sys.default_constraints dc
JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.purchase_items')
  AND c.name IN ('purchase_rate','gst_pct','base_value','gst_amt','item_total');
IF LEN(@sql2) > 0 EXEC sp_executesql @sql2;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'transport_cost')
  ALTER TABLE dbo.purchase_headers DROP COLUMN transport_cost;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'expected_bill_amt')
  ALTER TABLE dbo.purchase_headers DROP COLUMN expected_bill_amt;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'actual_bill_amt')
  ALTER TABLE dbo.purchase_headers DROP COLUMN actual_bill_amt;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'bill_number')
  ALTER TABLE dbo.purchase_headers DROP COLUMN bill_number;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'bill_date')
  ALTER TABLE dbo.purchase_headers DROP COLUMN bill_date;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'discrepancy_note')
  ALTER TABLE dbo.purchase_headers DROP COLUMN discrepancy_note;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'purchase_rate')
  ALTER TABLE dbo.purchase_items DROP COLUMN purchase_rate;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'gst_pct')
  ALTER TABLE dbo.purchase_items DROP COLUMN gst_pct;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'base_value')
  ALTER TABLE dbo.purchase_items DROP COLUMN base_value;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'gst_amt')
  ALTER TABLE dbo.purchase_items DROP COLUMN gst_amt;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'item_total')
  ALTER TABLE dbo.purchase_items DROP COLUMN item_total;
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.purchase_headers') AND c.name = 'pipeline_status')
  ALTER TABLE dbo.purchase_headers ADD CONSTRAINT DF_ph_pipeline_status DEFAULT ('DRAFT') FOR pipeline_status;
GO

IF NOT EXISTS (SELECT 1 FROM sys.default_constraints dc
  JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
  WHERE dc.parent_object_id = OBJECT_ID('dbo.purchase_headers') AND c.name = 'bill_status')
  ALTER TABLE dbo.purchase_headers ADD CONSTRAINT DF_ph_bill_status DEFAULT ('DRAFT') FOR bill_status;
GO

PRINT 'Migration 35b complete.';
GO
