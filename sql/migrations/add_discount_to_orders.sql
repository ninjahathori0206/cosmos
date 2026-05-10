-- ============================================================
-- Migration: add discount_amount + applied_offer_id to orders
-- Run via: node scripts/deploy_pos_sql.js
-- ============================================================
PRINT N'--- add_discount_to_orders.sql ---';
GO

-- pos_orders
IF COL_LENGTH(N'dbo.pos_orders', N'discount_amount') IS NULL
BEGIN
  ALTER TABLE dbo.pos_orders
    ADD discount_amount   DECIMAL(12,2) NOT NULL CONSTRAINT DF_pos_orders_disc DEFAULT (0),
        applied_offer_id  INT           NULL;
  PRINT N'Added discount_amount + applied_offer_id to pos_orders.';
END
ELSE
  PRINT N'pos_orders already has discount_amount — skipping.';
GO

-- oe_orders (OE engine mode)
IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.oe_orders', N'discount_amount') IS NULL
  BEGIN
    ALTER TABLE dbo.oe_orders
      ADD discount_amount   DECIMAL(12,2) NOT NULL CONSTRAINT DF_oe_orders_disc DEFAULT (0),
          applied_offer_id  INT           NULL;
    PRINT N'Added discount_amount + applied_offer_id to oe_orders.';
  END
  ELSE
    PRINT N'oe_orders already has discount_amount — skipping.';
END
GO

PRINT N'--- add_discount_to_orders.sql DONE ---';
GO
