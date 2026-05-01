PRINT 'Creating POS customers table...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_customers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_customers (
    customer_id   INT IDENTITY(1,1) PRIMARY KEY,
    full_name     NVARCHAR(200) NOT NULL,
    phone         NVARCHAR(20)  NOT NULL,
    email         NVARCHAR(200) NULL,
    home_store_id INT            NULL,
    is_active     BIT            NOT NULL DEFAULT 1,
    created_at    DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_at    DATETIME       NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pos_customers_store FOREIGN KEY (home_store_id) REFERENCES dbo.stores(store_id)
  );
  CREATE INDEX IX_pos_customers_phone ON dbo.pos_customers(phone);
END;
GO
