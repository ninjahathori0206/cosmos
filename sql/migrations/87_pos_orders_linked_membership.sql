/*
  87_pos_orders_linked_membership.sql
  Links product checkout to a separate MEMBERSHIP order (dual invoice flow).
*/
PRINT N'--- 87_pos_orders_linked_membership.sql ---';

USE [CosmosERP];
GO

IF COL_LENGTH(N'dbo.pos_orders', N'linked_membership_order_id') IS NULL
BEGIN
  ALTER TABLE dbo.pos_orders ADD linked_membership_order_id INT NULL;
  PRINT N'Added pos_orders.linked_membership_order_id.';
END
GO

IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.oe_orders', N'linked_membership_order_id') IS NULL
  BEGIN
    ALTER TABLE dbo.oe_orders ADD linked_membership_order_id INT NULL;
    PRINT N'Added oe_orders.linked_membership_order_id.';
  END
END
GO
