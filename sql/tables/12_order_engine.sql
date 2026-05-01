PRINT 'Creating shared order engine tables (oe_*)...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.oe_orders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.oe_orders (
    order_id                   INT IDENTITY(1,1) PRIMARY KEY,
    store_id                   INT            NOT NULL,
    customer_id                INT            NULL,
    created_by_user_id         INT            NULL,
    order_no                   NVARCHAR(50)   NOT NULL,
    order_source               NVARCHAR(20)   NOT NULL DEFAULT N'POS',
    order_kind                 NVARCHAR(20)   NOT NULL,
    rx_snapshot                NVARCHAR(MAX)  NULL,
    gst_rate_snapshot          DECIMAL(9,4)   NOT NULL,
    lab_advance_pct_snapshot   DECIMAL(9,2)   NULL,
    procurement_mode_snapshot  NVARCHAR(50)   NULL,
    status                     NVARCHAR(30)   NOT NULL DEFAULT N'OPEN',
    subtotal_amount            DECIMAL(12,2)  NOT NULL DEFAULT 0,
    gst_amount                 DECIMAL(12,2)  NOT NULL DEFAULT 0,
    total_amount               DECIMAL(12,2)  NOT NULL DEFAULT 0,
    created_at                 DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    legacy_pos_order_id        INT            NULL,
    CONSTRAINT UQ_oe_orders_order_no UNIQUE (order_no),
    CONSTRAINT FK_oe_orders_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_oe_orders_customer FOREIGN KEY (customer_id) REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_oe_orders_user FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_oe_orders_legacy_pos' AND object_id = OBJECT_ID(N'dbo.oe_orders'))
BEGIN
  CREATE UNIQUE INDEX IX_oe_orders_legacy_pos ON dbo.oe_orders(legacy_pos_order_id) WHERE legacy_pos_order_id IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.oe_sub_orders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.oe_sub_orders (
    sub_order_id               INT IDENTITY(1,1) PRIMARY KEY,
    order_id                   INT            NOT NULL,
    fulfillment                NVARCHAR(10)   NOT NULL,
    lab_workflow_status        NVARCHAR(30)   NULL,
    sort_order                 INT            NOT NULL DEFAULT 0,
    legacy_pos_sub_order_id    INT            NULL,
    CONSTRAINT FK_oe_sub_orders_order FOREIGN KEY (order_id) REFERENCES dbo.oe_orders(order_id) ON DELETE CASCADE
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_oe_sub_orders_legacy_pos' AND object_id = OBJECT_ID(N'dbo.oe_sub_orders'))
BEGIN
  CREATE UNIQUE INDEX IX_oe_sub_orders_legacy_pos ON dbo.oe_sub_orders(legacy_pos_sub_order_id) WHERE legacy_pos_sub_order_id IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.oe_order_items', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.oe_order_items (
    order_item_id              INT IDENTITY(1,1) PRIMARY KEY,
    sub_order_id               INT            NOT NULL,
    sku_id                     INT            NOT NULL,
    qty                        INT            NOT NULL,
    unit_price                 DECIMAL(12,2)  NOT NULL,
    line_total                 DECIMAL(12,2)  NOT NULL,
    product_type               NVARCHAR(50)   NOT NULL,
    fulfillment                NVARCHAR(10)   NOT NULL,
    line_key                   NVARCHAR(300)  NOT NULL,
    lens_bundle                NVARCHAR(MAX)  NULL,
    legacy_pos_order_item_id   INT            NULL,
    CONSTRAINT FK_oe_order_items_sub FOREIGN KEY (sub_order_id) REFERENCES dbo.oe_sub_orders(sub_order_id) ON DELETE CASCADE,
    CONSTRAINT FK_oe_order_items_sku FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_oe_order_items_legacy_pos' AND object_id = OBJECT_ID(N'dbo.oe_order_items'))
BEGIN
  CREATE UNIQUE INDEX IX_oe_order_items_legacy_pos ON dbo.oe_order_items(legacy_pos_order_item_id) WHERE legacy_pos_order_item_id IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.oe_payments', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.oe_payments (
    payment_id     INT IDENTITY(1,1) PRIMARY KEY,
    order_id       INT            NOT NULL,
    stage          NVARCHAR(20)   NOT NULL,
    method         NVARCHAR(20)   NOT NULL,
    amount         DECIMAL(12,2)  NOT NULL,
    tendered       DECIMAL(12,2)  NULL,
    change_given   DECIMAL(12,2)  NULL,
    external_ref   NVARCHAR(200)  NULL,
    created_by     INT            NULL,
    created_at     DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    legacy_pos_payment_id INT   NULL,
    CONSTRAINT FK_oe_payments_order FOREIGN KEY (order_id) REFERENCES dbo.oe_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT FK_oe_payments_user FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_oe_payments_legacy_pos' AND object_id = OBJECT_ID(N'dbo.oe_payments'))
BEGIN
  CREATE UNIQUE INDEX IX_oe_payments_legacy_pos ON dbo.oe_payments(legacy_pos_payment_id) WHERE legacy_pos_payment_id IS NOT NULL;
END;
GO

IF OBJECT_ID('dbo.oe_order_status_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.oe_order_status_log (
    log_id         INT IDENTITY(1,1) PRIMARY KEY,
    order_id       INT            NOT NULL,
    sub_order_id   INT            NULL,
    from_status    NVARCHAR(30)   NULL,
    to_status      NVARCHAR(30)   NOT NULL,
    actor_user_id  INT            NULL,
    note           NVARCHAR(500)  NULL,
    created_at     DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    legacy_pos_log_id INT         NULL,
    CONSTRAINT FK_oe_osl_order FOREIGN KEY (order_id) REFERENCES dbo.oe_orders(order_id) ON DELETE NO ACTION,
    CONSTRAINT FK_oe_osl_sub FOREIGN KEY (sub_order_id) REFERENCES dbo.oe_sub_orders(sub_order_id) ON DELETE SET NULL,
    CONSTRAINT FK_oe_osl_user FOREIGN KEY (actor_user_id) REFERENCES dbo.users(user_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_oe_order_status_log_legacy_pos' AND object_id = OBJECT_ID(N'dbo.oe_order_status_log'))
BEGIN
  CREATE UNIQUE INDEX IX_oe_order_status_log_legacy_pos ON dbo.oe_order_status_log(legacy_pos_log_id) WHERE legacy_pos_log_id IS NOT NULL;
END;
GO
