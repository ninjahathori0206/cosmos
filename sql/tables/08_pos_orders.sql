PRINT 'Creating POS orders tables...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_orders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_orders (
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
    CONSTRAINT UQ_pos_orders_order_no UNIQUE (order_no),
    CONSTRAINT FK_pos_orders_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_pos_orders_customer FOREIGN KEY (customer_id) REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_pos_orders_user FOREIGN KEY (created_by_user_id) REFERENCES dbo.users(user_id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_sub_orders', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_sub_orders (
    sub_order_id          INT IDENTITY(1,1) PRIMARY KEY,
    order_id              INT            NOT NULL,
    fulfillment           NVARCHAR(10)   NOT NULL,
    lab_workflow_status   NVARCHAR(30)   NULL,
    sort_order            INT            NOT NULL DEFAULT 0,
    CONSTRAINT FK_pos_sub_orders_order FOREIGN KEY (order_id) REFERENCES dbo.pos_orders(order_id) ON DELETE CASCADE
  );
END;
GO

IF OBJECT_ID('dbo.pos_order_items', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_order_items (
    order_item_id   INT IDENTITY(1,1) PRIMARY KEY,
    sub_order_id    INT            NOT NULL,
    sku_id          INT            NOT NULL,
    qty             INT            NOT NULL,
    unit_price      DECIMAL(12,2)  NOT NULL,
    line_total      DECIMAL(12,2)  NOT NULL,
    product_type    NVARCHAR(50)   NOT NULL,
    fulfillment     NVARCHAR(10)   NOT NULL,
    line_key        NVARCHAR(300)  NOT NULL,
    lens_bundle     NVARCHAR(MAX)  NULL,
    CONSTRAINT FK_pos_order_items_sub FOREIGN KEY (sub_order_id) REFERENCES dbo.pos_sub_orders(sub_order_id) ON DELETE CASCADE,
    CONSTRAINT FK_pos_order_items_sku FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_order_status_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_order_status_log (
    log_id         INT IDENTITY(1,1) PRIMARY KEY,
    order_id       INT            NOT NULL,
    sub_order_id   INT            NULL,
    from_status    NVARCHAR(30)   NULL,
    to_status      NVARCHAR(30)   NOT NULL,
    actor_user_id  INT            NULL,
    note           NVARCHAR(500)  NULL,
    created_at     DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pos_osl_order FOREIGN KEY (order_id) REFERENCES dbo.pos_orders(order_id) ON DELETE NO ACTION,
    CONSTRAINT FK_pos_osl_sub FOREIGN KEY (sub_order_id) REFERENCES dbo.pos_sub_orders(sub_order_id) ON DELETE SET NULL,
    CONSTRAINT FK_pos_osl_user FOREIGN KEY (actor_user_id) REFERENCES dbo.users(user_id)
  );
END;
GO
