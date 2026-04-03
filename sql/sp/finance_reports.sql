-- Finance Report Stored Procedures
USE [CosmosERP];
GO

-- ==============================================================================
-- sp_Finance_PurchaseReport
-- Returns 3 result sets for the Finance > Purchase Reports page:
--   RS0: summary totals (1 row)
--   RS1: per-supplier breakdown
--   RS2: bill-level detail
-- Filters: date range (purchase_date), supplier_id, pipeline_status, category
-- ==============================================================================
IF OBJECT_ID('dbo.sp_Finance_PurchaseReport','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_PurchaseReport;
GO
CREATE PROCEDURE dbo.sp_Finance_PurchaseReport
  @from_date       DATE        = NULL,
  @to_date         DATE        = NULL,
  @supplier_id     INT         = NULL,
  @pipeline_status VARCHAR(50) = NULL,
  @category        VARCHAR(50) = NULL
AS BEGIN
  SET NOCOUNT ON;

  -- Base set: headers matching filters, with per-header stats
  -- Use a temp table so the three result sets share the same filtered data.
  CREATE TABLE #rpt (
    header_id        INT,
    supplier_id      INT,
    supplier_name    VARCHAR(200),
    purchase_date    DATETIME,
    bill_date        DATETIME,
    bill_number      VARCHAR(100),
    bill_ref         VARCHAR(100),
    pipeline_status  VARCHAR(50),
    expected_bill_amt DECIMAL(10,2),
    actual_bill_amt   DECIMAL(10,2),
    bill_amount      DECIMAL(10,2),
    transport_cost   DECIMAL(10,2),
    paid_amount      DECIMAL(12,2),
    outstanding      DECIMAL(12,2),
    item_count       INT,
    total_qty        INT
  );

  INSERT INTO #rpt
  SELECT
    h.header_id,
    h.supplier_id,
    s.vendor_name,
    h.purchase_date,
    h.bill_date,
    h.bill_number,
    h.bill_ref,
    h.pipeline_status,
    h.expected_bill_amt,
    h.actual_bill_amt,
    ISNULL(h.actual_bill_amt, h.expected_bill_amt)      AS bill_amount,
    h.transport_cost,
    ISNULL(paid.paid_amt, 0)                            AS paid_amount,
    ISNULL(h.actual_bill_amt, h.expected_bill_amt)
      - ISNULL(paid.paid_amt, 0)                        AS outstanding,
    ISNULL(pi_stats.item_count, 0)                      AS item_count,
    ISNULL(pi_stats.total_qty, 0)                       AS total_qty
  FROM dbo.purchase_headers h
  LEFT JOIN dbo.suppliers s ON s.supplier_id = h.supplier_id
  LEFT JOIN (
    SELECT header_id,
           COUNT(*)     AS item_count,
           SUM(quantity) AS total_qty
    FROM dbo.purchase_items
    GROUP BY header_id
  ) pi_stats ON pi_stats.header_id = h.header_id
  LEFT JOIN (
    SELECT pa.header_id, SUM(pa.allocated_amt) AS paid_amt
    FROM dbo.payment_allocations pa
    JOIN dbo.supplier_payments sp ON sp.payment_id = pa.payment_id
    WHERE sp.is_void = 0
    GROUP BY pa.header_id
  ) paid ON paid.header_id = h.header_id
  WHERE
    (@from_date IS NULL OR CAST(h.purchase_date AS DATE) >= @from_date)
    AND (@to_date IS NULL OR CAST(h.purchase_date AS DATE) <= @to_date)
    AND (@supplier_id IS NULL OR h.supplier_id = @supplier_id)
    AND (@pipeline_status IS NULL OR h.pipeline_status = @pipeline_status)
    AND (
      @category IS NULL
      OR EXISTS (
        SELECT 1 FROM dbo.purchase_items pi
        WHERE pi.header_id = h.header_id
          AND pi.category = @category
      )
    );

  -- RS0: Summary totals
  SELECT
    COUNT(*)                  AS total_bills,
    ISNULL(SUM(bill_amount),0)  AS total_amount,
    ISNULL(SUM(paid_amount),0)  AS total_paid,
    ISNULL(SUM(outstanding),0)  AS total_outstanding,
    ISNULL(SUM(transport_cost),0) AS total_transport,
    ISNULL(SUM(total_qty),0)    AS total_qty,
    COUNT(DISTINCT supplier_id) AS supplier_count
  FROM #rpt;

  -- RS1: Per-supplier breakdown
  SELECT
    supplier_id,
    supplier_name,
    COUNT(*)                   AS bill_count,
    ISNULL(SUM(bill_amount),0)   AS total_amount,
    ISNULL(SUM(paid_amount),0)   AS total_paid,
    ISNULL(SUM(outstanding),0)   AS total_outstanding,
    ISNULL(SUM(total_qty),0)     AS total_qty
  FROM #rpt
  GROUP BY supplier_id, supplier_name
  ORDER BY total_amount DESC;

  -- RS2: Bill-level detail
  SELECT *
  FROM #rpt
  ORDER BY purchase_date DESC, header_id DESC;

  DROP TABLE #rpt;
END;
GO

-- ==============================================================================
-- sp_Finance_ItemFinance
-- Returns 2 result sets for the Finance > Item Finance page:
--   RS0: summary totals (1 row)
--   RS1: per-SKU item rows with costing, margin, and catalogue value
-- Filters: brand_id, product_type, status, search text
-- ==============================================================================
IF OBJECT_ID('dbo.sp_Finance_ItemFinance','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_ItemFinance;
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
    ISNULL(hb.brand_name,'—')           AS brand_name,
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
  LEFT JOIN dbo.purchase_item_colours pic ON sk.item_colour_id = pic.colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sk.sku_id = sb.sku_id AND sb.location_type = 'WAREHOUSE'
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
      OR ISNULL(pic.colour_name,'') LIKE '%'+@q+'%'
    );

  -- RS0: Summary totals
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

  -- RS1: Item detail rows
  SELECT *
  FROM #if
  ORDER BY sku_id DESC;

  DROP TABLE #if;
END;
GO

-- ==============================================================================
-- sp_Finance_ItemFinance_Filters
-- Returns distinct brands and product types for the Item Finance filter dropdowns
-- ==============================================================================
IF OBJECT_ID('dbo.sp_Finance_ItemFinance_Filters','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_ItemFinance_Filters;
GO
CREATE PROCEDURE dbo.sp_Finance_ItemFinance_Filters
AS BEGIN
  SET NOCOUNT ON;
  -- RS0: brands
  SELECT DISTINCT hb.brand_id, hb.brand_name
  FROM dbo.skus sk
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  JOIN dbo.home_brands hb    ON pm.home_brand_id = hb.brand_id
  ORDER BY hb.brand_name;

  -- RS1: product types
  SELECT DISTINCT pm.product_type
  FROM dbo.skus sk
  JOIN dbo.product_master pm ON sk.product_master_id = pm.product_id
  WHERE pm.product_type IS NOT NULL AND pm.product_type <> ''
  ORDER BY pm.product_type;
END;
GO

-- ==============================================================================
-- sp_Finance_PurchaseReport_Categories
-- Returns distinct categories that appear in purchase items (for filter dropdown)
-- ==============================================================================
IF OBJECT_ID('dbo.sp_Finance_PurchaseReport_Categories','P') IS NOT NULL DROP PROCEDURE dbo.sp_Finance_PurchaseReport_Categories;
GO
CREATE PROCEDURE dbo.sp_Finance_PurchaseReport_Categories
AS BEGIN
  SET NOCOUNT ON;
  SELECT DISTINCT category
  FROM dbo.purchase_items
  WHERE category IS NOT NULL AND category <> ''
  ORDER BY category;
END;
GO
