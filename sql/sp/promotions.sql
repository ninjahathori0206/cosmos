USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.sp_ListOffers
AS
BEGIN
  SET NOCOUNT ON;
  SELECT *
  FROM dbo.customer_offers
  ORDER BY is_active DESC, sort_order ASC, created_at DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetOfferById
  @offer_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT *
  FROM dbo.customer_offers
  WHERE offer_id = @offer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CreateOffer
  @title NVARCHAR(200),
  @description NVARCHAR(500) = NULL,
  @discount_type NVARCHAR(40),
  @discount_value DECIMAL(10,2),
  @trigger_type NVARCHAR(30) = N'ANY_ITEM',
  @trigger_value NVARCHAR(100) = NULL,
  @benefit_target NVARCHAR(30) = N'ELIGIBLE_LINES',
  @max_discount_amount DECIMAL(10,2) = NULL,
  @scope_mode NVARCHAR(30) = N'ALL_PRODUCTS',
  @valid_from DATETIME2(0),
  @valid_to DATETIME2(0),
  @created_by_user_id INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.customer_offers (
    title, description, discount_type, discount_value, trigger_type, trigger_value,
    benefit_target, max_discount_amount, scope_mode, valid_from, valid_to, created_by_user_id
  )
  OUTPUT INSERTED.offer_id
  VALUES (
    @title, ISNULL(@description, N''), @discount_type, @discount_value, @trigger_type, @trigger_value,
    @benefit_target, @max_discount_amount, @scope_mode, @valid_from, @valid_to, @created_by_user_id
  );
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_UpdateOffer
  @offer_id INT,
  @title NVARCHAR(200) = NULL,
  @description NVARCHAR(500) = NULL,
  @discount_type NVARCHAR(40) = NULL,
  @discount_value DECIMAL(10,2) = NULL,
  @trigger_type NVARCHAR(30) = NULL,
  @trigger_value NVARCHAR(100) = NULL,
  @benefit_target NVARCHAR(30) = NULL,
  @max_discount_amount DECIMAL(10,2) = NULL,
  @scope_mode NVARCHAR(30) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.customer_offers
  SET
    title = ISNULL(@title, title),
    description = ISNULL(@description, description),
    discount_type = ISNULL(@discount_type, discount_type),
    discount_value = ISNULL(@discount_value, discount_value),
    trigger_type = ISNULL(@trigger_type, trigger_type),
    trigger_value = CASE WHEN @trigger_value IS NULL THEN trigger_value ELSE @trigger_value END,
    benefit_target = ISNULL(@benefit_target, benefit_target),
    max_discount_amount = CASE WHEN @max_discount_amount IS NULL THEN max_discount_amount ELSE @max_discount_amount END,
    scope_mode = ISNULL(@scope_mode, scope_mode),
    updated_at = DATEADD(MINUTE,330,SYSUTCDATETIME())
  WHERE offer_id = @offer_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_EvaluateOffersForCart
  @cart_json NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT CAST(NULL AS INT) AS offer_id, CAST(0 AS DECIMAL(10,2)) AS discount_amount, N'SQL evaluator is implemented in Node runtime bridge.' AS note;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RecordOfferUsage
  @offer_id INT,
  @offer_code NVARCHAR(80) = NULL,
  @order_id INT = NULL,
  @order_no NVARCHAR(80) = NULL,
  @store_id INT = NULL,
  @cashier_user_id INT = NULL,
  @customer_id INT = NULL,
  @discount_amount DECIMAL(12,2) = 0,
  @sale_amount DECIMAL(12,2) = 0,
  @usage_basis NVARCHAR(20) = N'SALE',
  @rule_snapshot_json NVARCHAR(MAX) = NULL,
  @context_json NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.offer_usage (
    offer_id, offer_code, order_id, order_no, store_id, cashier_user_id, customer_id,
    discount_amount, sale_amount, usage_basis, rule_snapshot_json, context_json
  )
  VALUES (
    @offer_id, @offer_code, @order_id, @order_no, @store_id, @cashier_user_id, @customer_id,
    ISNULL(@discount_amount, 0), ISNULL(@sale_amount, 0), ISNULL(@usage_basis, N'SALE'),
    @rule_snapshot_json, @context_json
  );
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetOfferUsage
  @offer_id INT = NULL,
  @from_date DATETIME2(0) = NULL,
  @to_date DATETIME2(0) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT usage_id, offer_id, offer_code, order_id, order_no, store_id, cashier_user_id, customer_id,
         discount_amount, sale_amount, usage_basis, used_at
  FROM dbo.offer_usage
  WHERE (@offer_id IS NULL OR offer_id = @offer_id)
    AND (@from_date IS NULL OR used_at >= @from_date)
    AND (@to_date IS NULL OR used_at <= @to_date)
  ORDER BY used_at DESC;
END;
GO
