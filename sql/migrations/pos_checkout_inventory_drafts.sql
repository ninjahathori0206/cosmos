-- ============================================================
-- POS checkout: defer inventory until paid + checkout drafts
-- Run via: node scripts/deploy_pos_sql.js (or your migration runner)
-- ============================================================
PRINT N'--- pos_checkout_inventory_drafts.sql ---';
GO

IF COL_LENGTH(N'dbo.pos_orders', N'inventory_committed') IS NULL
BEGIN
  ALTER TABLE dbo.pos_orders
    ADD inventory_committed BIT NOT NULL CONSTRAINT DF_pos_orders_inv_comm DEFAULT (1);
  PRINT N'Added inventory_committed to pos_orders.';
END
ELSE
  PRINT N'pos_orders already has inventory_committed — skipping.';
GO

IF OBJECT_ID(N'dbo.oe_orders', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.oe_orders', N'inventory_committed') IS NULL
  BEGIN
    ALTER TABLE dbo.oe_orders
      ADD inventory_committed BIT NOT NULL CONSTRAINT DF_oe_orders_inv_comm DEFAULT (1);
    PRINT N'Added inventory_committed to oe_orders.';
  END
  ELSE
    PRINT N'oe_orders already has inventory_committed — skipping.';
END
GO

IF OBJECT_ID(N'dbo.pos_checkout_drafts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_checkout_drafts (
    draft_id        INT IDENTITY(1,1) PRIMARY KEY,
    store_id        INT            NOT NULL,
    staff_user_id   INT            NULL,
    cart_json       NVARCHAR(MAX)  NOT NULL,
    checkout_stage  TINYINT        NOT NULL CONSTRAINT DF_pos_chk_draft_stage DEFAULT (5),
    delivery_mode   NVARCHAR(20)   NULL,
    customer_id     INT            NULL,
    updated_at      DATETIME       NOT NULL CONSTRAINT DF_pos_chk_draft_upd DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_pos_chk_drafts_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_pos_chk_drafts_cust FOREIGN KEY (customer_id) REFERENCES dbo.pos_customers(customer_id)
  );
  CREATE UNIQUE INDEX UX_pos_chk_drafts_staff_store
    ON dbo.pos_checkout_drafts(store_id, staff_user_id)
    WHERE staff_user_id IS NOT NULL;
  PRINT N'Created pos_checkout_drafts.';
END
ELSE
  PRINT N'pos_checkout_drafts already exists — skipping.';
GO

PRINT N'--- pos_checkout_inventory_drafts.sql DONE ---';
GO
