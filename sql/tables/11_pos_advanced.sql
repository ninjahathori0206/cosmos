PRINT 'Creating POS advanced placeholder tables...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_hq_stock_reservations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_hq_stock_reservations (
    reservation_id INT IDENTITY(1,1) PRIMARY KEY,
    order_id       INT            NOT NULL,
    sku_id         INT            NOT NULL,
    qty            INT            NOT NULL,
    status         NVARCHAR(30)   NOT NULL DEFAULT N'PENDING',
    created_at     DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pos_hq_res_order FOREIGN KEY (order_id) REFERENCES dbo.pos_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT FK_pos_hq_res_sku FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_package_freebies', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_package_freebies (
    freebie_id     INT IDENTITY(1,1) PRIMARY KEY,
    package_id     INT            NOT NULL,
    sku_id         INT            NOT NULL,
    qty            INT            NOT NULL DEFAULT 1,
    is_active      BIT            NOT NULL DEFAULT 1,
    CONSTRAINT FK_pos_freebies_pkg FOREIGN KEY (package_id) REFERENCES dbo.pos_lens_packages(id),
    CONSTRAINT FK_pos_freebies_sku FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id)
  );
END;
GO
