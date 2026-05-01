USE [CosmosERP];
GO

PRINT 'Adding SKU sale price history tracking...';

IF OBJECT_ID('dbo.sku_sale_price_history', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.sku_sale_price_history (
    history_id       INT IDENTITY(1,1) PRIMARY KEY,
    sku_id           INT NOT NULL,
    old_sale_price   DECIMAL(10,2) NOT NULL,
    new_sale_price   DECIMAL(10,2) NOT NULL,
    changed_by       INT NULL,
    change_source    VARCHAR(50) NOT NULL DEFAULT 'SKU_CATALOGUE',
    change_reason    VARCHAR(500) NULL,
    changed_at       DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_sph_sku FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT FK_sph_user FOREIGN KEY (changed_by) REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_sph_sku_changed_at ON dbo.sku_sale_price_history(sku_id, changed_at DESC);
END;
GO
