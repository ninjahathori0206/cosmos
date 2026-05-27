/*
  76_pos_orders_membership_sale.sql
  ---------------------------------
  Records membership plan sold on a POS order (cart attachment, not SKU line).
*/
PRINT N'--- 76_pos_orders_membership_sale.sql ---';

USE [CosmosERP];
GO

IF COL_LENGTH(N'dbo.pos_orders', N'sold_membership_plan_key') IS NULL
BEGIN
  ALTER TABLE dbo.pos_orders ADD sold_membership_plan_key NVARCHAR(50) NULL;
  PRINT N'Added pos_orders.sold_membership_plan_key.';
END
GO

IF COL_LENGTH(N'dbo.pos_orders', N'sold_membership_amount') IS NULL
BEGIN
  ALTER TABLE dbo.pos_orders ADD sold_membership_amount DECIMAL(12, 2) NULL;
  PRINT N'Added pos_orders.sold_membership_amount.';
END
GO

IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.oe_orders', N'sold_membership_plan_key') IS NULL
  BEGIN
    ALTER TABLE dbo.oe_orders ADD sold_membership_plan_key NVARCHAR(50) NULL;
    PRINT N'Added oe_orders.sold_membership_plan_key.';
  END
  IF COL_LENGTH(N'dbo.oe_orders', N'sold_membership_amount') IS NULL
  BEGIN
    ALTER TABLE dbo.oe_orders ADD sold_membership_amount DECIMAL(12, 2) NULL;
    PRINT N'Added oe_orders.sold_membership_amount.';
  END
END
GO
