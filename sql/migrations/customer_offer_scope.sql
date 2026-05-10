-- Migration: customer_offer_scope
-- Scope rows attached to customer_offers for brand/SKU/product/product-type allocation.
-- Empty scope table = global offer (applies to all lines).
-- scope_kind is validated by app manifest (offerScopeDimensions.js); stored as open NVARCHAR
-- so adding a new dimension doesn't require a schema change.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'customer_offer_scope'
)
BEGIN
  CREATE TABLE dbo.customer_offer_scope (
    scope_id    INT            NOT NULL IDENTITY(1,1),
    offer_id    INT            NOT NULL,
    scope_kind  NVARCHAR(40)   NOT NULL,   -- 'BRAND' | 'SKU' | 'PRODUCT' | 'PRODUCT_TYPE'
    ref_int     INT            NULL,        -- brand_id / sku_id / product_id
    ref_key     NVARCHAR(60)   NULL,        -- product_type string key
    created_at  DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),

    CONSTRAINT PK_customer_offer_scope PRIMARY KEY (scope_id),
    CONSTRAINT FK_offer_scope_offer
      FOREIGN KEY (offer_id) REFERENCES dbo.customer_offers(offer_id) ON DELETE CASCADE,
    CONSTRAINT CK_offer_scope_ref
      CHECK (ref_int IS NOT NULL OR ref_key IS NOT NULL)
  );

  CREATE INDEX IX_offer_scope_offer_id ON dbo.customer_offer_scope (offer_id);
  PRINT 'Created dbo.customer_offer_scope';
END
ELSE
BEGIN
  PRINT 'dbo.customer_offer_scope already exists — skipped';
END
GO
