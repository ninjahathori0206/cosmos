PRINT 'Creating Eyewoot Go customer auth table...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.customer_auth', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_auth (
    customer_auth_id  INT IDENTITY(1,1) PRIMARY KEY,
    customer_id       INT            NOT NULL,
    password_hash     NVARCHAR(200)  NOT NULL,
    is_active         BIT            NOT NULL DEFAULT 1,
    last_login        DATETIME       NULL,
    created_at        DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at        DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT UQ_customer_auth_customer UNIQUE (customer_id),
    CONSTRAINT FK_customer_auth_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id)
  );
  CREATE INDEX IX_customer_auth_customer ON dbo.customer_auth(customer_id);
  PRINT 'customer_auth table created.';
END
ELSE
  PRINT 'customer_auth table already exists — skipped.';
GO
