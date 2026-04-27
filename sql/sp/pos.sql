-- ─── POS STORED PROCEDURES ───────────────────────────────────────────────────
-- Deploy: node scripts/deploy_pos_sql.js
-- All procedures use CREATE OR ALTER so they are safe to re-run.

-- ─── ADD pos_pin_hash COLUMN IF MISSING ──────────────────────────────────────
IF COL_LENGTH('dbo.users', 'pos_pin_hash') IS NULL
BEGIN
  ALTER TABLE dbo.users
    ADD pos_pin_hash VARCHAR(200) NULL;
END;
GO

-- ─── sp_POS_GetStores ────────────────────────────────────────────────────────
-- Returns all active stores for the store selector on the tablet login screen.
CREATE OR ALTER PROCEDURE dbo.sp_POS_GetStores
AS
BEGIN
  SET NOCOUNT ON;
  SELECT store_id, store_name, store_code
  FROM   dbo.stores
  WHERE  is_active = 1
  ORDER  BY store_name;
END;
GO

-- ─── sp_POS_GetStaffForStore ─────────────────────────────────────────────────
-- Returns active staff belonging to a store, including their pos_pin_hash.
-- bcrypt comparison is done in the API layer (Node.js) — NOT in SQL.
CREATE OR ALTER PROCEDURE dbo.sp_POS_GetStaffForStore
  @store_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    u.user_id        AS employee_id,
    u.full_name      AS [name],
    u.role_key       AS [role],
    u.store_id,
    u.pos_pin_hash
  FROM   dbo.users u
  WHERE  u.store_id  = @store_id
    AND  u.is_active = 1
    AND  u.pos_pin_hash IS NOT NULL;
END;
GO

-- ─── sp_POS_GetStaffPermissions ──────────────────────────────────────────────
-- Returns the permission keys assigned to a role via role_permissions.
CREATE OR ALTER PROCEDURE dbo.sp_POS_GetStaffPermissions
  @role_key VARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT rp.permission AS permission_key
  FROM   dbo.role_permissions rp
  WHERE  rp.role_key = @role_key;
END;
GO

-- ─── sp_POS_StoreCatalogue ───────────────────────────────────────────────────
-- Returns live SKUs that have stock qty > 0 at the given store.
-- Used for Store Catalogue scope on POS tablet.
CREATE OR ALTER PROCEDURE dbo.sp_POS_StoreCatalogue
  @store_id INT,
  @q        NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @search NVARCHAR(202) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
         ELSE '%' + LTRIM(RTRIM(@q)) + '%' END;

  SELECT
    pm.product_id,
    sk.sku_id,
    sk.sku_code,
    ISNULL(sk.barcode, '')                                          AS barcode,
    ISNULL(hb.brand_name, ISNULL(mm.maker_name, ''))               AS brand_name,
    ISNULL(pm.ew_collection, '') + ' · ' + ISNULL(pm.style_model, '') AS product_name,
    ISNULL(pm.product_type, '')                                     AS product_type,
    ISNULL(pm.frame_material, '')                                   AS frame_material,
    ISNULL(CAST(pm.frame_width AS VARCHAR(10)), '')                 AS frame_width,
    ISNULL(pic.colour_name, '')                                     AS colour_name,
    ISNULL(pic.colour_code, '')                                     AS colour_code,
    ISNULL(sk.image_url, '')                                        AS image_url,
    ISNULL(sk.sale_price, 0)                                        AS sale_price,
    sb.qty                                                          AS store_qty
  FROM  dbo.stock_balances sb
  JOIN  dbo.skus              sk  ON sk.sku_id          = sb.sku_id
                                  AND sk.status IN ('LIVE', 'ACTIVE')
  JOIN  dbo.product_master    pm  ON pm.product_id      = sk.product_master_id
  LEFT JOIN dbo.home_brands   hb  ON hb.brand_id        = pm.home_brand_id
  LEFT JOIN dbo.maker_master  mm  ON mm.maker_id        = pm.maker_master_id
  LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
  WHERE sb.location_type = 'STORE'
    AND sb.location_id   = @store_id
    AND sb.qty           > 0
    AND (
      @search IS NULL
      OR sk.sku_code                        LIKE @search
      OR ISNULL(sk.barcode, '')             LIKE @search
      OR ISNULL(hb.brand_name, '')          LIKE @search
      OR ISNULL(mm.maker_name, '')          LIKE @search
      OR pm.ew_collection                   LIKE @search
      OR pm.style_model                     LIKE @search
      OR ISNULL(pm.source_brand, '')        LIKE @search
      OR ISNULL(pm.source_collection, '')   LIKE @search
      OR ISNULL(pm.source_model_number, '') LIKE @search
      OR pm.product_type                    LIKE @search
      OR ISNULL(pic.colour_name, '')        LIKE @search
      OR ISNULL(pic.colour_code, '')        LIKE @search
    )
  ORDER BY brand_name, pm.product_type, sk.sku_code;
END;
GO

-- ─── sp_POS_GlobalCatalogue ──────────────────────────────────────────────────
-- Returns ALL live SKUs regardless of store stock.
-- Includes store_qty from @store_id (0 if not stocked at that store).
-- Used for Global Catalogue scope — enables lab orders for non-stocked items.
CREATE OR ALTER PROCEDURE dbo.sp_POS_GlobalCatalogue
  @store_id INT,
  @q        NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @search NVARCHAR(202) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
         ELSE '%' + LTRIM(RTRIM(@q)) + '%' END;

  SELECT
    pm.product_id,
    sk.sku_id,
    sk.sku_code,
    ISNULL(sk.barcode, '')                                          AS barcode,
    ISNULL(hb.brand_name, ISNULL(mm.maker_name, ''))               AS brand_name,
    ISNULL(pm.ew_collection, '') + ' · ' + ISNULL(pm.style_model, '') AS product_name,
    ISNULL(pm.product_type, '')                                     AS product_type,
    ISNULL(pm.frame_material, '')                                   AS frame_material,
    ISNULL(CAST(pm.frame_width AS VARCHAR(10)), '')                 AS frame_width,
    ISNULL(pic.colour_name, '')                                     AS colour_name,
    ISNULL(pic.colour_code, '')                                     AS colour_code,
    ISNULL(sk.image_url, '')                                        AS image_url,
    ISNULL(sk.sale_price, 0)                                        AS sale_price,
    ISNULL(sb_store.qty, 0)                                         AS store_qty
  FROM  dbo.skus sk
  JOIN  dbo.product_master    pm  ON pm.product_id      = sk.product_master_id
  LEFT JOIN dbo.home_brands   hb  ON hb.brand_id        = pm.home_brand_id
  LEFT JOIN dbo.maker_master  mm  ON mm.maker_id        = pm.maker_master_id
  LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
  LEFT JOIN dbo.stock_balances sb_store
         ON sb_store.sku_id        = sk.sku_id
        AND sb_store.location_type = 'STORE'
        AND sb_store.location_id   = @store_id
  WHERE sk.status IN ('LIVE', 'ACTIVE')
    AND (
      @search IS NULL
      OR sk.sku_code                        LIKE @search
      OR ISNULL(sk.barcode, '')             LIKE @search
      OR ISNULL(hb.brand_name, '')          LIKE @search
      OR ISNULL(mm.maker_name, '')          LIKE @search
      OR pm.ew_collection                   LIKE @search
      OR pm.style_model                     LIKE @search
      OR ISNULL(pm.source_brand, '')        LIKE @search
      OR ISNULL(pm.source_collection, '')   LIKE @search
      OR ISNULL(pm.source_model_number, '') LIKE @search
      OR pm.product_type                    LIKE @search
      OR ISNULL(pic.colour_name, '')        LIKE @search
      OR ISNULL(pic.colour_code, '')        LIKE @search
    )
  ORDER BY brand_name, pm.product_type, sk.sku_code;
END;
GO
