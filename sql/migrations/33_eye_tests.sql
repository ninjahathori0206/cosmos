PRINT 'Creating eye_tests table...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.eye_tests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.eye_tests (
    test_id              INT IDENTITY(1,1) PRIMARY KEY,
    customer_id          INT            NOT NULL,
    tested_at            DATETIME       NOT NULL,
    store_id             INT            NULL,
    tested_by_user_id    INT            NULL,

    -- Right Eye
    re_sph               DECIMAL(5,2)   NULL,
    re_cyl               DECIMAL(5,2)   NULL,
    re_axis              INT            NULL,
    re_add               DECIMAL(5,2)   NULL,
    re_va                NVARCHAR(10)   NULL,

    -- Left Eye
    le_sph               DECIMAL(5,2)   NULL,
    le_cyl               DECIMAL(5,2)   NULL,
    le_axis              INT            NULL,
    le_add               DECIMAL(5,2)   NULL,
    le_va                NVARCHAR(10)   NULL,

    pd                   DECIMAL(5,2)   NULL,
    lens_type            NVARCHAR(50)   NULL,

    -- 'STAFF' | 'CUSTOMER_FORM' | 'CUSTOMER_PHOTO'
    source               NVARCHAR(20)   NOT NULL DEFAULT N'STAFF',
    rx_photo_path        NVARCHAR(500)  NULL,
    notes                NVARCHAR(500)  NULL,

    created_at           DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),

    CONSTRAINT FK_et_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_et_store FOREIGN KEY (store_id)
      REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_et_user FOREIGN KEY (tested_by_user_id)
      REFERENCES dbo.users(user_id),
    CONSTRAINT CK_et_source CHECK (source IN (N'STAFF', N'CUSTOMER_FORM', N'CUSTOMER_PHOTO'))
  );
  CREATE INDEX IX_et_customer_date ON dbo.eye_tests(customer_id, tested_at DESC);
  PRINT 'eye_tests table created.';
END
ELSE
  PRINT 'eye_tests table already exists — skipped.';
GO
