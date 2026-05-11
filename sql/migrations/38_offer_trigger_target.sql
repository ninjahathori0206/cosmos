PRINT N'--- 38_offer_trigger_target.sql ---';
GO

-- Columns only (separate batch from CHECK constraints — avoids "Invalid column name"
-- when the engine resolves the constraint before ALTER visibility in one batch).
IF OBJECT_ID(N'dbo.customer_offers', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.customer_offers', 'trigger_type') IS NULL
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD trigger_type NVARCHAR(30) NOT NULL CONSTRAINT DF_co_trigger_type DEFAULT (N'ANY_ITEM');
  END;

  IF COL_LENGTH('dbo.customer_offers', 'trigger_value') IS NULL
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD trigger_value NVARCHAR(100) NULL;
  END;

  IF COL_LENGTH('dbo.customer_offers', 'benefit_target') IS NULL
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD benefit_target NVARCHAR(30) NOT NULL CONSTRAINT DF_co_benefit_target DEFAULT (N'ELIGIBLE_LINES');
  END;

  IF COL_LENGTH('dbo.customer_offers', 'max_discount_amount') IS NULL
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD max_discount_amount DECIMAL(10,2) NULL;
  END;

  IF COL_LENGTH('dbo.customer_offers', 'scope_mode') IS NULL
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD scope_mode NVARCHAR(30) NOT NULL CONSTRAINT DF_co_scope_mode DEFAULT (N'ALL_PRODUCTS');
  END;
END;
GO

IF OBJECT_ID(N'dbo.customer_offers', N'U') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
      AND name = N'CK_co_trigger_type'
  )
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD CONSTRAINT CK_co_trigger_type CHECK (trigger_type IN (N'ANY_ITEM', N'MIN_CART_VALUE', N'SPECIFIC_PRODUCT_TYPE'));
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
      AND name = N'CK_co_benefit_target'
  )
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD CONSTRAINT CK_co_benefit_target CHECK (benefit_target IN (N'CART_TOTAL', N'ELIGIBLE_LINES', N'CHEAPEST_ITEM'));
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
      AND name = N'CK_co_scope_mode'
  )
  BEGIN
    ALTER TABLE dbo.customer_offers
      ADD CONSTRAINT CK_co_scope_mode CHECK (scope_mode IN (N'ALL_PRODUCTS', N'BY_CATEGORY', N'BY_BRAND_IN_CATEGORY', N'SELECTED_SKUS'));
  END;
END;
GO

IF OBJECT_ID(N'dbo.customer_offer_scope', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.customer_offer_scope', 'is_exclusion') IS NULL
  BEGIN
    ALTER TABLE dbo.customer_offer_scope
      ADD is_exclusion BIT NOT NULL CONSTRAINT DF_customer_offer_scope_is_exclusion DEFAULT ((0));
  END;
END;
GO
