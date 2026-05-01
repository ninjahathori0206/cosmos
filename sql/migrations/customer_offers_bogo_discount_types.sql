-- Extend customer_offers.discount_type for structured BOGO / frame–lens rules (POS validates server-side).
PRINT N'--- customer_offers_bogo_discount_types.sql ---';
GO

IF OBJECT_ID(N'dbo.customer_offers', N'U') IS NOT NULL
BEGIN
  DECLARE @cn NVARCHAR(256);
  SELECT @cn = name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID(N'dbo.customer_offers')
    AND name LIKE N'%discount_type%' OR [...]
END
GO
