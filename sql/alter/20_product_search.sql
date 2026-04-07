USE [CosmosERP];

-- sp_ProductMaster_Search: free-text search across product catalogue fields,
-- returning compact rows suitable for a purchase-entry picker.
IF OBJECT_ID('dbo.sp_ProductMaster_Search', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_ProductMaster_Search;
GO

CREATE PROCEDURE dbo.sp_ProductMaster_Search
  @q               VARCHAR(200) = NULL,
  @maker_master_id INT          = NULL,
  @top_n           INT          = 20
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @lim    INT          = CASE WHEN ISNULL(@top_n, 0) BETWEEN 1 AND 100 THEN @top_n ELSE 20 END;
  DECLARE @search VARCHAR(202) = CASE
    WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
    ELSE '%' + LTRIM(RTRIM(@q)) + '%'
  END;

  SELECT TOP (@lim)
    pm.product_id,
    pm.maker_master_id,
    mm.maker_name,
    pm.source_brand,
    pm.source_collection,
    pm.source_model_number,
    pm.ew_collection,
    pm.style_model,
    pm.product_type,
    pm.catalogue_status,
    COUNT(DISTINCT CASE WHEN sk.status = 'LIVE' THEN sk.sku_id END) AS live_sku_count,
    COUNT(DISTINCT ph.header_id)                                         AS total_purchases,
    MAX(ph.purchase_date)                                                AS last_purchase_date,
    MAX(pi.purchase_rate)                                                AS last_purchase_rate
  FROM dbo.product_master pm
  LEFT JOIN dbo.maker_master     mm ON mm.maker_id     = pm.maker_master_id
  LEFT JOIN dbo.skus             sk ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.purchase_items   pi ON pi.product_master_id = pm.product_id
  LEFT JOIN dbo.purchase_headers ph ON ph.header_id    = pi.header_id
  WHERE pm.catalogue_status IN ('ACTIVE', 'DRAFT')
    AND (@maker_master_id IS NULL OR pm.maker_master_id = @maker_master_id)
    AND (
      @search IS NULL
      OR pm.source_brand        LIKE @search
      OR pm.source_model_number LIKE @search
      OR pm.source_collection   LIKE @search
      OR pm.ew_collection       LIKE @search
      OR pm.style_model         LIKE @search
      OR mm.maker_name          LIKE @search
    )
  GROUP BY
    pm.product_id, pm.maker_master_id, mm.maker_name,
    pm.source_brand, pm.source_collection, pm.source_model_number,
    pm.ew_collection, pm.style_model, pm.product_type, pm.catalogue_status
  ORDER BY
    COUNT(DISTINCT CASE WHEN sk.status = 'LIVE' THEN sk.sku_id END) DESC,
    COUNT(DISTINCT ph.header_id) DESC,
    pm.product_id DESC;
END;
GO
