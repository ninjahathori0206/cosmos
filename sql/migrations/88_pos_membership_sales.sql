/*
  88_pos_membership_sales.sql
  Membership sales without pos_orders — M-series invoice + separate payment ledger.
  Deploy: npm run migrate:88-pos-membership-sales
*/
PRINT N'--- 88_pos_membership_sales.sql ---';
GO

IF OBJECT_ID(N'dbo.pos_membership_sales', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_membership_sales (
    membership_sale_id   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    store_id             INT            NOT NULL,
    customer_id          INT            NOT NULL,
    plan_key             NVARCHAR(50)   NOT NULL,
    amount               DECIMAL(12, 2) NOT NULL,
    invoice_no           NVARCHAR(50)   NOT NULL,
    product_order_id     INT            NULL,
    status               NVARCHAR(20)   NOT NULL DEFAULT N'PAID',
    created_by_user_id   INT            NULL,
    created_at           DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT UQ_pos_membership_sales_invoice_no UNIQUE (invoice_no),
    CONSTRAINT FK_pos_membership_sales_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_pos_membership_sales_customer FOREIGN KEY (customer_id) REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_pos_membership_sales_product_order FOREIGN KEY (product_order_id) REFERENCES dbo.pos_orders(order_id),
    CONSTRAINT FK_pos_membership_sales_user FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT CK_pos_membership_sales_status CHECK (status IN (N'PAID', N'CANCELLED', N'MIGRATED'))
  );
  CREATE INDEX IX_pos_membership_sales_store_date ON dbo.pos_membership_sales(store_id, created_at);
  CREATE INDEX IX_pos_membership_sales_product_order ON dbo.pos_membership_sales(product_order_id) WHERE product_order_id IS NOT NULL;
  PRINT N'Created dbo.pos_membership_sales.';
END
ELSE
  PRINT N'dbo.pos_membership_sales already exists — skipped.';
GO

IF OBJECT_ID(N'dbo.pos_membership_payments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_membership_payments (
    payment_id           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    membership_sale_id   INT            NOT NULL,
    stage                NVARCHAR(20)   NOT NULL,
    method               NVARCHAR(20)   NOT NULL,
    amount               DECIMAL(12, 2) NOT NULL,
    tendered             DECIMAL(12, 2) NULL,
    change_given         DECIMAL(12, 2) NULL,
    external_ref         NVARCHAR(200)  NULL,
    created_by           INT            NULL,
    created_at           DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_pos_membership_payments_sale FOREIGN KEY (membership_sale_id) REFERENCES dbo.pos_membership_sales(membership_sale_id) ON DELETE CASCADE,
    CONSTRAINT FK_pos_membership_payments_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_pos_membership_payments_sale ON dbo.pos_membership_payments(membership_sale_id);
  PRINT N'Created dbo.pos_membership_payments.';
END
ELSE
  PRINT N'dbo.pos_membership_payments already exists — skipped.';
GO

IF COL_LENGTH(N'dbo.pos_orders', N'linked_membership_sale_id') IS NULL
BEGIN
  ALTER TABLE dbo.pos_orders ADD linked_membership_sale_id INT NULL;
  PRINT N'Added pos_orders.linked_membership_sale_id.';
END
GO

IF COL_LENGTH(N'dbo.customer_memberships', N'pos_membership_sale_id') IS NULL
BEGIN
  ALTER TABLE dbo.customer_memberships ADD pos_membership_sale_id INT NULL;
  PRINT N'Added customer_memberships.pos_membership_sale_id.';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_cm_pos_membership_sale'
)
BEGIN
  ALTER TABLE dbo.customer_memberships
    ADD CONSTRAINT FK_cm_pos_membership_sale
    FOREIGN KEY (pos_membership_sale_id) REFERENCES dbo.pos_membership_sales(membership_sale_id);
  PRINT N'Added FK_cm_pos_membership_sale.';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_pos_orders_linked_membership_sale'
)
BEGIN
  ALTER TABLE dbo.pos_orders
    ADD CONSTRAINT FK_pos_orders_linked_membership_sale
    FOREIGN KEY (linked_membership_sale_id) REFERENCES dbo.pos_membership_sales(membership_sale_id);
  PRINT N'Added FK_pos_orders_linked_membership_sale.';
END
GO

PRINT N'--- 88_pos_membership_sales.sql complete ---';
GO
