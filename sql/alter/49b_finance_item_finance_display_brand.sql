USE [CosmosERP];
GO

-- Patch only sp_Finance_ItemFinance (display brand) — avoids re-running full finance_reports.sql
-- when other finance procs depend on newer schema columns.
-- Deploy: npm run migrate:49-product-card-display-brand

IF OBJECT_ID('dbo.sp_Finance_ItemFinance', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Finance_ItemFinance;
GO

CREATE PROCEDURE dbo.sp_Finance_ItemFinance
  @brand_id     INT          = NULL,
  @product_type VARCHAR(50)  = NULL,
  @status       VARCHAR(30)  = NULL,
  @q            VARCHAR(200) = NULL
AS BEGIN
  SET NOCOUNT ON;

  CREATE TABLE #if (
    sku_id       INT,
    sku_code     VARCHAR(100),
    product_name NVARCHAR(300),
    brand_name   VARCHAR(200),
    product_type VARCHAR(50),
    colour_name  VARCHAR(100),
    colour_code  VARCHAR(50),
    cost_price   DECIMAL(10,2),
    sale_price   DECIMAL(10,2),
    margin_pct   DECIMAL(5,1),
    stock_qty    INT,
    cost_value   DECIMAL(12,2),
    sale_value   DECIMAL(12,2),
    status       VARCHAR(30)
  );

  INSERT INTO #if
  SELECT
    sk.sku_id,
    sk.sku_code,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    ISNULL(
      NULLIF(LTRIM(RTRIM(COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
        ''
      ))), ''),
      '—'
    )                                   AS brand_name,
    ISNULL(pm.product_type,'')          AS product_type,
    ISNULL(pic.colour_name,'—')         AS colour_name,
    ISNULL(pic.colour_code,'')          AS colour_code,
    ISNULL(sk.cost_price,0)             AS cost_price,
    ISNULL(sk.sale_price,0)             AS sale_price,
    CASE WHEN ISNULL(sk.sale_price,0) > 0
         THEN ROUND(((ISNULL(sk.sale_price,0) - ISNULL(sk.cost_price,0))
                    / sk.sale_price) * 100, 1)
         ELSE NULL END                  AS margin_pct,
    ISNULL(sb.qty,0)                    AS stock_qty,
    ISNULL(sk.cost_price,0) * ISNULL(sb.qty,0) AS cost_value,
    ISNULL(sk.sale_price,0) * ISNULL(sb.qty,0) AS sale_value,
    sk.status
  FROM dbo.skus sk
  JOIN dbo.product_master pm  ON sk.product_master_id = pm.product_id
  LEFT JOIN dbo.home_brands hb ON pm.home_brand_id = hb.brand_id
  LEFT JOIN dbo.maker_master mm ON pm.maker_master_id = mm.maker_id
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sk.sku_id = sb.sku_id AND sb.location_type = 'WAREHOUSE' AND sb.location_id = dbo.fn_Foundry_PrimaryWarehouseLocationId()
  WHERE
    (ISNULL(@brand_id,0) = 0 OR pm.home_brand_id = @brand_id)
    AND (ISNULL(@product_type,'') = '' OR pm.product_type = @product_type)
    AND (ISNULL(@status,'') = '' OR sk.status = @status)
    AND (
      ISNULL(@q,'') = ''
      OR sk.sku_code           LIKE '%'+@q+'%'
      OR pm.ew_collection      LIKE '%'+@q+'%'
      OR pm.style_model        LIKE '%'+@q+'%'
      OR ISNULL(hb.brand_name,'') LIKE '%'+@q+'%'
      OR ISNULL(pm.source_brand,'') LIKE '%'+@q+'%'
      OR ISNULL(mm.maker_name,'') LIKE '%'+@q+'%'
      OR ISNULL(pic.colour_name,'') LIKE '%'+@q+'%'
    );

  SELECT
    COUNT(*)                       AS total_skus,
    ISNULL(SUM(stock_qty),0)       AS total_stock_qty,
    ISNULL(SUM(cost_value),0)      AS total_cost_value,
    ISNULL(SUM(sale_value),0)      AS total_sale_value,
    COUNT(CASE WHEN stock_qty > 0 THEN 1 END) AS in_stock_skus,
    CASE WHEN SUM(sale_value) > 0
         THEN ROUND(((SUM(sale_value) - SUM(cost_value)) / SUM(sale_value)) * 100, 1)
         ELSE NULL END             AS portfolio_margin_pct
  FROM #if;

  SELECT *
  FROM #if
  ORDER BY sku_id DESC;

  DROP TABLE #if;
END;
GO
