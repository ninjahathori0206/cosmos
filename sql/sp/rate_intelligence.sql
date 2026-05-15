-- Rate Intelligence: vendor/product aggregates and purchase context
USE [CosmosERP];
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_RateIntelligence_UpsertVendorProduct
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_RateIntelligence_UpsertVendorProduct', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_RateIntelligence_UpsertVendorProduct;
GO
CREATE PROCEDURE dbo.sp_RateIntelligence_UpsertVendorProduct
  @product_master_id INT,
  @supplier_id       INT,
  @new_rate          DECIMAL(12,2)
AS BEGIN
  SET NOCOUNT ON;
  IF @product_master_id IS NULL OR @supplier_id IS NULL OR @new_rate IS NULL
    RETURN;

  MERGE dbo.vendor_product_rates AS t
  USING (
    SELECT @product_master_id AS product_master_id,
           @supplier_id AS supplier_id,
           @new_rate AS new_rate
  ) AS s
  ON t.product_master_id = s.product_master_id AND t.supplier_id = s.supplier_id
  WHEN MATCHED THEN
    UPDATE SET
      previous_rate   = t.last_rate,
      last_rate       = s.new_rate,
      lowest_rate     = CASE
        WHEN t.lowest_rate IS NULL OR s.new_rate < t.lowest_rate THEN s.new_rate
        ELSE t.lowest_rate END,
      highest_rate    = CASE
        WHEN t.highest_rate IS NULL OR s.new_rate > t.highest_rate THEN s.new_rate
        ELSE t.highest_rate END,
      total_purchases = t.total_purchases + 1,
      rate_delta      = s.new_rate - ISNULL(t.last_rate, s.new_rate),
      rate_trend      = CASE
        WHEN t.last_rate IS NULL THEN NULL
        WHEN s.new_rate < t.last_rate THEN 'DOWN'
        WHEN s.new_rate > t.last_rate THEN 'UP'
        ELSE 'SAME' END,
      updated_at      = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHEN NOT MATCHED THEN
    INSERT (
      product_master_id, supplier_id, total_purchases,
      lowest_rate, highest_rate, last_rate, previous_rate,
      rate_trend, rate_delta, updated_at
    )
    VALUES (
      s.product_master_id, s.supplier_id, 1,
      s.new_rate, s.new_rate, s.new_rate, NULL,
      NULL, 0, DATEADD(MINUTE, 330, SYSUTCDATETIME())
    );
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_RateIntelligence_UpsertProductSummary
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_RateIntelligence_UpsertProductSummary', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_RateIntelligence_UpsertProductSummary;
GO
CREATE PROCEDURE dbo.sp_RateIntelligence_UpsertProductSummary
  @product_master_id INT
AS BEGIN
  SET NOCOUNT ON;
  IF @product_master_id IS NULL RETURN;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @network_lowest DECIMAL(12,2);
  DECLARE @network_lowest_supplier_id INT;
  DECLARE @network_highest DECIMAL(12,2);
  DECLARE @supplier_count INT;
  DECLARE @last_rate DECIMAL(12,2);
  DECLARE @last_supplier_id INT;

  SELECT
    @network_lowest = MIN(vpr.lowest_rate),
    @network_highest = MAX(vpr.highest_rate),
    @supplier_count = COUNT(*)
  FROM dbo.vendor_product_rates vpr
  WHERE vpr.product_master_id = @product_master_id;

  SELECT TOP 1
    @network_lowest_supplier_id = vpr.supplier_id
  FROM dbo.vendor_product_rates vpr
  WHERE vpr.product_master_id = @product_master_id
    AND vpr.lowest_rate = @network_lowest
  ORDER BY vpr.updated_at DESC, vpr.rate_id DESC;

  SELECT TOP 1
    @last_rate = vpr.last_rate,
    @last_supplier_id = vpr.supplier_id
  FROM dbo.vendor_product_rates vpr
  WHERE vpr.product_master_id = @product_master_id
  ORDER BY vpr.updated_at DESC, vpr.rate_id DESC;

  MERGE dbo.product_rate_summary AS t
  USING (SELECT @product_master_id AS product_master_id) AS s
  ON t.product_master_id = s.product_master_id
  WHEN MATCHED THEN
    UPDATE SET
      network_lowest_rate = @network_lowest,
      network_lowest_supplier_id = @network_lowest_supplier_id,
      network_highest_rate = @network_highest,
      total_supplier_count = ISNULL(@supplier_count, 0),
      last_purchased_rate = @last_rate,
      last_purchased_supplier_id = @last_supplier_id,
      updated_at = @now
  WHEN NOT MATCHED THEN
    INSERT (
      product_master_id, network_lowest_rate, network_lowest_supplier_id,
      network_highest_rate, total_supplier_count,
      last_purchased_rate, last_purchased_supplier_id, updated_at
    )
    VALUES (
      @product_master_id, @network_lowest, @network_lowest_supplier_id,
      @network_highest, ISNULL(@supplier_count, 0),
      @last_rate, @last_supplier_id, @now
    );
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_RateIntelligence_GetContextForPurchase
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_RateIntelligence_GetContextForPurchase', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_RateIntelligence_GetContextForPurchase;
GO
CREATE PROCEDURE dbo.sp_RateIntelligence_GetContextForPurchase
  @product_master_id INT,
  @supplier_id       INT,
  @current_rate      DECIMAL(12,2) = NULL
AS BEGIN
  SET NOCOUNT ON;

  SELECT
    @product_master_id AS product_master_id,
    @supplier_id AS supplier_id,
    prs.network_lowest_rate,
    prs.network_highest_rate,
    prs.last_purchased_rate,
    prs.last_purchased_supplier_id,
    vpr.lowest_rate AS vendor_lowest_rate,
    vpr.highest_rate AS vendor_highest_rate,
    vpr.last_rate AS vendor_last_rate,
    vpr.previous_rate AS vendor_previous_rate,
    vpr.rate_trend AS vendor_rate_trend,
    vpr.rate_delta AS vendor_rate_delta,
    vpr.total_purchases AS vendor_total_purchases,
    CASE
      WHEN @current_rate IS NULL OR prs.network_lowest_rate IS NULL THEN NULL
      WHEN @current_rate <= prs.network_lowest_rate THEN 'AT_OR_BELOW_NETWORK_LOW'
      WHEN @current_rate > prs.network_lowest_rate THEN 'ABOVE_NETWORK_LOW'
      ELSE NULL
    END AS vs_network_low_flag,
    CASE
      WHEN @current_rate IS NULL OR vpr.last_rate IS NULL THEN NULL
      WHEN @current_rate = vpr.last_rate THEN 'SAME_AS_VENDOR_LAST'
      WHEN @current_rate < vpr.last_rate THEN 'BELOW_VENDOR_LAST'
      WHEN @current_rate > vpr.last_rate THEN 'ABOVE_VENDOR_LAST'
      ELSE NULL
    END AS vs_vendor_last_flag
  FROM dbo.product_rate_summary prs
  LEFT JOIN dbo.vendor_product_rates vpr
    ON vpr.product_master_id = @product_master_id
   AND vpr.supplier_id = @supplier_id
  WHERE prs.product_master_id = @product_master_id

  UNION ALL

  SELECT
    @product_master_id,
    @supplier_id,
    NULL, NULL, NULL, NULL,
    vpr.lowest_rate, vpr.highest_rate, vpr.last_rate, vpr.previous_rate,
    vpr.rate_trend, vpr.rate_delta, vpr.total_purchases,
    NULL, NULL
  FROM dbo.vendor_product_rates vpr
  WHERE vpr.product_master_id = @product_master_id
    AND vpr.supplier_id = @supplier_id
    AND NOT EXISTS (SELECT 1 FROM dbo.product_rate_summary WHERE product_master_id = @product_master_id);
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_RateIntelligence_GetByProduct
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_RateIntelligence_GetByProduct', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_RateIntelligence_GetByProduct;
GO
CREATE PROCEDURE dbo.sp_RateIntelligence_GetByProduct @product_master_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    pm.product_id, pm.source_brand, pm.source_collection, pm.source_model_number,
    pm.ew_collection, pm.style_model, pm.product_type,
    prs.network_lowest_rate, prs.network_highest_rate,
    prs.last_purchased_rate, prs.total_supplier_count,
    vpr.supplier_id, s.vendor_name,
    vpr.total_purchases, vpr.lowest_rate, vpr.highest_rate,
    vpr.last_rate, vpr.previous_rate, vpr.rate_trend, vpr.rate_delta, vpr.updated_at
  FROM dbo.product_master pm
  LEFT JOIN dbo.product_rate_summary prs ON prs.product_master_id = pm.product_id
  LEFT JOIN dbo.vendor_product_rates vpr ON vpr.product_master_id = pm.product_id
  LEFT JOIN dbo.suppliers s ON s.supplier_id = vpr.supplier_id
  WHERE pm.product_id = @product_master_id
  ORDER BY vpr.last_rate ASC, s.vendor_name;
END;
GO

-- ══════════════════════════════════════════════════════════════════════════════
-- sp_RateIntelligence_GetByVendor
-- ══════════════════════════════════════════════════════════════════════════════
IF OBJECT_ID('dbo.sp_RateIntelligence_GetByVendor', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_RateIntelligence_GetByVendor;
GO
CREATE PROCEDURE dbo.sp_RateIntelligence_GetByVendor @supplier_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT
    vpr.product_master_id,
    pm.source_brand, pm.source_collection, pm.source_model_number,
    pm.ew_collection, pm.style_model,
    vpr.total_purchases, vpr.lowest_rate, vpr.highest_rate,
    vpr.last_rate, vpr.previous_rate, vpr.rate_trend, vpr.updated_at
  FROM dbo.vendor_product_rates vpr
  JOIN dbo.product_master pm ON pm.product_id = vpr.product_master_id
  WHERE vpr.supplier_id = @supplier_id
  ORDER BY pm.source_brand, pm.source_model_number;
END;
GO
