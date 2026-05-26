/*
  73_customer_offers_capability_selector.sql
  ------------------------------------------
  Replaces the is_plus_only BIT with a flexible required_capability column.
  Adds cashback_rate for the new CASHBACK offer type.
  Updates the CK_co_discount_type constraint to allow 'CASHBACK'.

  required_capability:
    NULL              = open to all customers
    'has_plus_access' = only customers whose active membership_plan has has_plus_access = 1
    Any other valid column name from membership_plans capability set.

  cashback_rate:
    Only used when discount_type = 'CASHBACK'.
    Percentage of order value credited as coins (e.g. 5.00 = 5%).

  Migration strategy:
    - is_plus_only column is KEPT (non-breaking for existing queries that may read it)
      but is no longer written or checked by new offer eligibility logic.
    - Existing rows where is_plus_only = 1 are backfilled to required_capability = 'has_plus_access'.

  Idempotent.
  Run after: 35_customer_offers.sql, customer_offers_bogo_discount_types.sql
*/
PRINT N'--- 73_customer_offers_capability_selector.sql ---';

USE [CosmosERP];
GO

IF OBJECT_ID(N'dbo.customer_offers', N'U') IS NULL
BEGIN
  PRINT N'customer_offers table missing — skipped.';
  RETURN;
END;
GO

-- required_capability
IF COL_LENGTH(N'dbo.customer_offers', N'required_capability') IS NULL
BEGIN
  ALTER TABLE dbo.customer_offers ADD required_capability NVARCHAR(50) NULL;
  PRINT N'Added required_capability.';
END
ELSE
  PRINT N'required_capability already exists — skipped.';
GO

-- cashback_rate
IF COL_LENGTH(N'dbo.customer_offers', N'cashback_rate') IS NULL
BEGIN
  ALTER TABLE dbo.customer_offers ADD cashback_rate DECIMAL(5,2) NULL;
  PRINT N'Added cashback_rate.';
END
ELSE
  PRINT N'cashback_rate already exists — skipped.';
GO

/*
  Drop and recreate CK_co_discount_type to include 'CASHBACK'.
  Wrapped in a single batch so both steps are atomic.
*/
IF EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
    AND name = N'CK_co_discount_type'
)
  ALTER TABLE dbo.customer_offers DROP CONSTRAINT CK_co_discount_type;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
    AND name = N'CK_co_discount_type'
)
BEGIN
  ALTER TABLE dbo.customer_offers ADD CONSTRAINT CK_co_discount_type CHECK (
    discount_type IN (
      N'PCT',
      N'FLAT',
      N'FREEBIE',
      N'BOGO_LOWEST_FREE',
      N'BUY_FRAME_GET_LENS_FREE',
      N'BUY_LENS_GET_FRAME_FREE',
      N'CASHBACK'
    )
  );
  PRINT N'CK_co_discount_type recreated with CASHBACK.';
END
GO

/*
  Backfill: existing is_plus_only = 1 rows map to required_capability = 'has_plus_access'.
  Only fills rows where required_capability is still NULL to keep the operation idempotent.
*/
UPDATE dbo.customer_offers
SET required_capability = N'has_plus_access'
WHERE is_plus_only = 1
  AND required_capability IS NULL;

DECLARE @rows INT = @@ROWCOUNT;
PRINT N'Backfilled required_capability for ' + CAST(@rows AS NVARCHAR) + N' existing is_plus_only offers.';
GO

PRINT N'--- 73_customer_offers_capability_selector.sql complete ---';
GO
