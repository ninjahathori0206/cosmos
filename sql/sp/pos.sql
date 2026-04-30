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
  @q        NVARCHAR(200) = NULL,
  @brand    NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @search NVARCHAR(202) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
         ELSE '%' + LTRIM(RTRIM(@q)) + '%' END;

  DECLARE @brand_filter NVARCHAR(200) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@brand)), '') = '' THEN NULL
         ELSE LOWER(LTRIM(RTRIM(@brand))) END;

  SELECT
    pm.product_id,
    sk.sku_id,
    sk.sku_code,
    ISNULL(sk.barcode, '')                                          AS barcode,
    ISNULL(hb.brand_name, ISNULL(mm.maker_name, ''))               AS brand_name,
    ISNULL(pm.ew_collection, '')                                   AS collection_name,
    ISNULL(pm.style_model, '')                                     AS model_number,
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
      @brand_filter IS NULL
      OR LOWER(LTRIM(RTRIM(ISNULL(hb.brand_name, ISNULL(mm.maker_name, ''))))) = @brand_filter
    )
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
  @q        NVARCHAR(200) = NULL,
  @brand    NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @search NVARCHAR(202) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
         ELSE '%' + LTRIM(RTRIM(@q)) + '%' END;

  DECLARE @brand_filter NVARCHAR(200) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@brand)), '') = '' THEN NULL
         ELSE LOWER(LTRIM(RTRIM(@brand))) END;

  SELECT
    pm.product_id,
    sk.sku_id,
    sk.sku_code,
    ISNULL(sk.barcode, '')                                          AS barcode,
    ISNULL(hb.brand_name, ISNULL(mm.maker_name, ''))               AS brand_name,
    ISNULL(pm.ew_collection, '')                                   AS collection_name,
    ISNULL(pm.style_model, '')                                     AS model_number,
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
      @brand_filter IS NULL
      OR LOWER(LTRIM(RTRIM(ISNULL(hb.brand_name, ISNULL(mm.maker_name, ''))))) = @brand_filter
    )
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

-- ─── sp_POS_CatalogueBrands ────────────────────────────────────────────────────
-- Distinct display brand names for POS filter (store = in-stock at store; global = all live SKUs).
CREATE OR ALTER PROCEDURE dbo.sp_POS_CatalogueBrands
  @store_id INT,
  @scope    NVARCHAR(20) = N'store'
AS
BEGIN
  SET NOCOUNT ON;

  IF LOWER(LTRIM(RTRIM(@scope))) = N'global'
  BEGIN
    SELECT DISTINCT LTRIM(RTRIM(ISNULL(hb.brand_name, ISNULL(mm.maker_name, '')))) AS brand_name
    FROM dbo.skus sk
    JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
    WHERE sk.status IN (N'LIVE', N'ACTIVE')
      AND LTRIM(RTRIM(ISNULL(hb.brand_name, ISNULL(mm.maker_name, '')))) <> N''
    ORDER BY brand_name;
  END
  ELSE
  BEGIN
    SELECT DISTINCT LTRIM(RTRIM(ISNULL(hb.brand_name, ISNULL(mm.maker_name, '')))) AS brand_name
    FROM dbo.stock_balances sb
    JOIN dbo.skus sk ON sk.sku_id = sb.sku_id AND sk.status IN (N'LIVE', N'ACTIVE')
    JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
    WHERE sb.location_type = N'STORE'
      AND sb.location_id = @store_id
      AND sb.qty > 0
      AND LTRIM(RTRIM(ISNULL(hb.brand_name, ISNULL(mm.maker_name, '')))) <> N''
    ORDER BY brand_name;
  END
END;
GO

-- ─── sp_POS_GetStartupConfig ─────────────────────────────────────────────────
-- Returns three result sets: product type rules, POS lookup rows, lab transitions.
-- Consumed by GET /api/pos/startup-config (POS tablet boot).
CREATE OR ALTER PROCEDURE dbo.sp_POS_GetStartupConfig
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    product_type_key AS product_type_key,
    fulfillment_mode,
    rx_required,
    allow_qty_gt_1
  FROM dbo.pos_product_type_config
  WHERE is_active = 1
  ORDER BY product_type_key;

  SELECT
    lookup_type,
    lookup_key   AS lookup_key,
    lookup_label AS lookup_label,
    display_order
  FROM dbo.foundry_lookup_values
  WHERE lookup_type IN (
    N'pos_qc_fail_reason',
    N'pos_call_outcome',
    N'pos_payment_method',
    N'pos_order_source'
  )
    AND is_active = 1
  ORDER BY lookup_type, display_order, lookup_key;

  SELECT
    from_status,
    to_status,
    actor_role,
    requires_note
  FROM dbo.pos_lab_transitions
  ORDER BY id;
END;
GO

-- ─── sp_POS_GetLensCatalog ───────────────────────────────────────────────────
-- Four result sets: categories, packages, addons, package–addon links.
CREATE OR ALTER PROCEDURE dbo.sp_POS_GetLensCatalog
AS
BEGIN
  SET NOCOUNT ON;
  SELECT id, name, sort_order
  FROM dbo.pos_lens_categories
  WHERE is_active = 1
  ORDER BY sort_order, id;

  SELECT id, category_id, name, price, sort_order
  FROM dbo.pos_lens_packages
  WHERE is_active = 1
  ORDER BY category_id, sort_order, id;

  SELECT id, name, price, sort_order
  FROM dbo.pos_lens_addons
  WHERE is_active = 1
  ORDER BY sort_order, id;

  SELECT package_id, addon_id
  FROM dbo.pos_lens_pkg_addons;
END;
GO

-- ─── sp_POS_CustomerSearch ───────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_POS_CustomerSearch
  @q NVARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @search NVARCHAR(202) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@q)), N'') = N'' THEN NULL
         ELSE N'%' + LTRIM(RTRIM(@q)) + N'%' END;

  SELECT TOP 50
    customer_id,
    full_name,
    phone,
    email,
    home_store_id,
    is_active,
    created_at
  FROM dbo.pos_customers
  WHERE is_active = 1
    AND (
      @search IS NULL
      OR phone     LIKE @search
      OR full_name LIKE @search
      OR email     LIKE @search
    )
  ORDER BY updated_at DESC, customer_id DESC;
END;
GO

-- ─── sp_POS_CustomerCreate ───────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_POS_CustomerCreate
  @full_name     NVARCHAR(200),
  @phone         NVARCHAR(20),
  @email         NVARCHAR(200) = NULL,
  @home_store_id INT           = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.pos_customers (full_name, phone, email, home_store_id)
  VALUES (@full_name, @phone, @email, @home_store_id);

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS customer_id;
END;
GO

-- ─── sp_POS_ValidateLabTransition ────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_POS_ValidateLabTransition
  @from_status VARCHAR(30),
  @to_status   VARCHAR(30),
  @actor_role  VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    COUNT(*) AS transition_count,
    MAX(CASE WHEN requires_note = 1 THEN 1 ELSE 0 END) AS requires_note
  FROM dbo.pos_lab_transitions
  WHERE from_status = @from_status
    AND to_status   = @to_status
    AND actor_role  = @actor_role;
END;
GO
