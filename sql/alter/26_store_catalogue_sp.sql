USE [CosmosERP];
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- sp_Store_Catalogue
-- Returns all live SKUs that have stock qty > 0 at a given store location.
-- Supports optional free-text search via @q.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_Store_Catalogue
  @store_id INT,
  @q        NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @search NVARCHAR(202) =
    CASE
      WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
      ELSE '%' + LTRIM(RTRIM(@q)) + '%'
    END;

  SELECT
    sk.sku_id,
    sk.sku_code,
    ISNULL(hb.brand_name, mm.maker_name)           AS brand_name,
    ISNULL(pm.ew_collection,'') + ' · ' + ISNULL(pm.style_model,'') AS product_name,
    pm.product_type,
    ISNULL(pic.colour_name, '')                    AS colour_name,
    sb.qty                                          AS store_qty
  FROM dbo.stock_balances sb
  JOIN  dbo.skus                  sk  ON sk.sku_id          = sb.sku_id
                                      AND sk.status IN ('LIVE','ACTIVE')
  JOIN  dbo.product_master        pm  ON pm.product_id      = sk.product_master_id
  LEFT JOIN dbo.home_brands       hb  ON hb.brand_id        = pm.home_brand_id
  LEFT JOIN dbo.maker_master      mm  ON mm.maker_id        = pm.maker_master_id
  LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id  = sk.item_colour_id
  WHERE sb.location_type = 'STORE'
    AND sb.location_id   = @store_id
    AND sb.qty           > 0
    AND (
      @search IS NULL
      OR sk.sku_code                          LIKE @search
      OR ISNULL(hb.brand_name, '')            LIKE @search
      OR pm.ew_collection                     LIKE @search
      OR pm.style_model                       LIKE @search
      OR pm.product_type                      LIKE @search
      OR ISNULL(pic.colour_name, '')          LIKE @search
    )
  ORDER BY
    ISNULL(hb.brand_name, mm.maker_name),
    pm.product_type,
    sk.sku_code;
END;
GO
