PRINT N'--- 39_prd04_offers_usage.sql ---';
GO

IF OBJECT_ID(N'dbo.offer_usage', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.offer_usage (
    usage_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    offer_id INT NOT NULL,
    offer_code NVARCHAR(80) NULL,
    order_id INT NULL,
    order_no NVARCHAR(80) NULL,
    store_id INT NULL,
    cashier_user_id INT NULL,
    customer_id INT NULL,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT (0),
    sale_amount DECIMAL(12,2) NOT NULL DEFAULT (0),
    usage_basis NVARCHAR(20) NOT NULL DEFAULT (N'SALE'),
    rule_snapshot_json NVARCHAR(MAX) NULL,
    context_json NVARCHAR(MAX) NULL,
    used_at DATETIME2(0) NOT NULL DEFAULT (DATEADD(MINUTE,330,SYSUTCDATETIME()))
  );
  CREATE INDEX IX_offer_usage_offer_used_at ON dbo.offer_usage(offer_id, used_at DESC);
  CREATE INDEX IX_offer_usage_store_used_at ON dbo.offer_usage(store_id, used_at DESC);
END;
GO

IF COL_LENGTH('dbo.customer_offers', 'offer_code') IS NULL
BEGIN
  ALTER TABLE dbo.customer_offers ADD offer_code NVARCHAR(80) NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.customer_offers')
    AND name = N'UX_customer_offers_offer_code'
)
BEGIN
  CREATE UNIQUE INDEX UX_customer_offers_offer_code
    ON dbo.customer_offers(offer_code)
    WHERE offer_code IS NOT NULL;
END;
GO
