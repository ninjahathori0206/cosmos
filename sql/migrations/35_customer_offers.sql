PRINT 'Creating customer_offers table...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.customer_offers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_offers (
    offer_id        INT IDENTITY(1,1) PRIMARY KEY,
    title           NVARCHAR(200)  NOT NULL,
    description     NVARCHAR(500)  NOT NULL,
    icon_emoji      NVARCHAR(10)   NOT NULL DEFAULT N'🎁',
    -- 'PCT' | 'FLAT' | 'FREEBIE'
    discount_type   NVARCHAR(10)   NOT NULL DEFAULT N'PCT',
    discount_value  DECIMAL(10,2)  NOT NULL DEFAULT 0,
    valid_from      DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    valid_to        DATETIME       NOT NULL,
    -- NULL = available to all tiers
    eligible_tier   NVARCHAR(50)   NULL,
    is_plus_only    BIT            NOT NULL DEFAULT 0,
    is_active       BIT            NOT NULL DEFAULT 1,
    sort_order      INT            NOT NULL DEFAULT 0,
    created_by_user_id INT         NULL,
    created_at      DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at      DATETIME       NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT CK_co_discount_type CHECK (discount_type IN (N'PCT', N'FLAT', N'FREEBIE')),
    CONSTRAINT FK_co_created_by FOREIGN KEY (created_by_user_id)
      REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_co_active_valid ON dbo.customer_offers(is_active, valid_from, valid_to);
  PRINT 'customer_offers table created.';
END
ELSE
  PRINT 'customer_offers table already exists — skipped.';
GO
