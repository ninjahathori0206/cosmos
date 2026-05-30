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
-- brand_name: home brand when set; else source_brand (bypass / pre-branded); else maker.
CREATE OR ALTER PROCEDURE dbo.sp_POS_StoreCatalogue
  @store_id INT,
  @q        NVARCHAR(200) = NULL,
  @brand    NVARCHAR(2000) = NULL,
  @product_type NVARCHAR(400) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @search NVARCHAR(202) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
         ELSE '%' + LTRIM(RTRIM(@q)) + '%' END;

  DECLARE @brand_csv NVARCHAR(2000) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@brand)), '') = '' THEN NULL
         ELSE LTRIM(RTRIM(@brand)) END;

  DECLARE @pt_csv NVARCHAR(400) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@product_type)), '') = '' THEN NULL
         ELSE LTRIM(RTRIM(@product_type)) END;

  SELECT
    pm.product_id,
    sk.sku_id,
    sk.sku_code,
    ISNULL(sk.barcode, '')                                          AS barcode,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    )))                                                            AS brand_name,
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
    sb.qty                                                          AS store_qty,
    NULLIF(LTRIM(RTRIM(sk.reading_power)), '')                      AS reading_power
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
      @brand_csv IS NULL
      OR EXISTS (
        SELECT 1
        FROM STRING_SPLIT(@brand_csv, N',') AS seg
        WHERE LTRIM(RTRIM(seg.value)) <> N''
          AND LOWER(LTRIM(RTRIM(seg.value))) = LOWER(LTRIM(RTRIM(COALESCE(
            NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
            NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
            NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
            ''
          ))))
      )
    )
    AND (
      @pt_csv IS NULL
      OR EXISTS (
        SELECT 1
        FROM STRING_SPLIT(LOWER(@pt_csv), N',') AS seg
        WHERE LTRIM(RTRIM(seg.value)) <> N''
          AND LTRIM(RTRIM(seg.value)) = LOWER(LTRIM(RTRIM(ISNULL(pm.product_type, N''))))
      )
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

-- Global catalogue: all live SKUs; optional @product_type filter (same as store scope).
CREATE OR ALTER PROCEDURE dbo.sp_POS_GlobalCatalogue
  @store_id INT,
  @q        NVARCHAR(200) = NULL,
  @brand    NVARCHAR(2000) = NULL,
  @product_type NVARCHAR(400) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @search NVARCHAR(202) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@q)), '') = '' THEN NULL
         ELSE '%' + LTRIM(RTRIM(@q)) + '%' END;

  DECLARE @brand_csv NVARCHAR(2000) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@brand)), '') = '' THEN NULL
         ELSE LTRIM(RTRIM(@brand)) END;

  DECLARE @pt_csv NVARCHAR(400) =
    CASE WHEN ISNULL(LTRIM(RTRIM(@product_type)), '') = '' THEN NULL
         ELSE LTRIM(RTRIM(@product_type)) END;

  SELECT
    pm.product_id,
    sk.sku_id,
    sk.sku_code,
    ISNULL(sk.barcode, '')                                          AS barcode,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    )))                                                            AS brand_name,
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
    ISNULL(sb_store.qty, 0)                                         AS store_qty,
    NULLIF(LTRIM(RTRIM(sk.reading_power)), '')                      AS reading_power
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
      @brand_csv IS NULL
      OR EXISTS (
        SELECT 1
        FROM STRING_SPLIT(@brand_csv, N',') AS seg
        WHERE LTRIM(RTRIM(seg.value)) <> N''
          AND LOWER(LTRIM(RTRIM(seg.value))) = LOWER(LTRIM(RTRIM(COALESCE(
            NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
            NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
            NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
            ''
          ))))
      )
    )
    AND (
      @pt_csv IS NULL
      OR EXISTS (
        SELECT 1
        FROM STRING_SPLIT(LOWER(@pt_csv), N',') AS seg
        WHERE LTRIM(RTRIM(seg.value)) <> N''
          AND LTRIM(RTRIM(seg.value)) = LOWER(LTRIM(RTRIM(ISNULL(pm.product_type, N''))))
      )
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
-- Same resolution as catalogue rows: home brand → source_brand → maker.
CREATE OR ALTER PROCEDURE dbo.sp_POS_CatalogueBrands
  @store_id INT,
  @scope    NVARCHAR(20) = N'store'
AS
BEGIN
  SET NOCOUNT ON;

  IF LOWER(LTRIM(RTRIM(@scope))) = N'global'
  BEGIN
    SELECT DISTINCT LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name
    FROM dbo.skus sk
    JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
    WHERE sk.status IN (N'LIVE', N'ACTIVE')
      AND LTRIM(RTRIM(COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
        ''
      ))) <> N''
    ORDER BY brand_name;
  END
  ELSE
  BEGIN
    SELECT DISTINCT LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name
    FROM dbo.stock_balances sb
    JOIN dbo.skus sk ON sk.sku_id = sb.sku_id AND sk.status IN (N'LIVE', N'ACTIVE')
    JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
    LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
    WHERE sb.location_type = N'STORE'
      AND sb.location_id = @store_id
      AND sb.qty > 0
      AND LTRIM(RTRIM(COALESCE(
        NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
        NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
        ''
      ))) <> N''
    ORDER BY brand_name;
  END
END;
GO

-- ─── sp_POS_CatalogueProductTypes ─────────────────────────────────────────────
-- Product types that actually appear in the POS catalogue for this scope (store stock vs all live SKUs).
-- Labels from pos_product_type_config (SSOT); else raw pm.product_type.
CREATE OR ALTER PROCEDURE dbo.sp_POS_CatalogueProductTypes
  @store_id INT,
  @scope    NVARCHAR(20) = N'store'
AS
BEGIN
  SET NOCOUNT ON;

  IF LOWER(LTRIM(RTRIM(@scope))) = N'global'
  BEGIN
    ;WITH types AS (
      SELECT DISTINCT LTRIM(RTRIM(pm.product_type)) AS pt
      FROM dbo.skus sk
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      WHERE sk.status IN (N'LIVE', N'ACTIVE')
        AND LTRIM(RTRIM(ISNULL(pm.product_type, N''))) <> N''
    )
    SELECT
      LTRIM(RTRIM(t.pt)) AS lookup_key,
      ISNULL(NULLIF(LTRIM(RTRIM(ptc.label)), N''), LTRIM(RTRIM(t.pt))) AS lookup_label,
      ISNULL(ptc.display_order, 999) AS display_order
    FROM types t
    LEFT JOIN dbo.pos_product_type_config ptc
      ON ptc.is_active = 1
      AND LOWER(LTRIM(RTRIM(ptc.product_type_key))) = LOWER(LTRIM(RTRIM(t.pt)))
    ORDER BY display_order, lookup_label, lookup_key;
  END
  ELSE
  BEGIN
    ;WITH types AS (
      SELECT DISTINCT LTRIM(RTRIM(pm.product_type)) AS pt
      FROM dbo.stock_balances sb
      JOIN dbo.skus sk ON sk.sku_id = sb.sku_id AND sk.status IN (N'LIVE', N'ACTIVE')
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      WHERE sb.location_type = N'STORE'
        AND sb.location_id = @store_id
        AND sb.qty > 0
        AND LTRIM(RTRIM(ISNULL(pm.product_type, N''))) <> N''
    )
    SELECT
      LTRIM(RTRIM(t.pt)) AS lookup_key,
      ISNULL(NULLIF(LTRIM(RTRIM(ptc.label)), N''), LTRIM(RTRIM(t.pt))) AS lookup_label,
      ISNULL(ptc.display_order, 999) AS display_order
    FROM types t
    LEFT JOIN dbo.pos_product_type_config ptc
      ON ptc.is_active = 1
      AND LOWER(LTRIM(RTRIM(ptc.product_type_key))) = LOWER(LTRIM(RTRIM(t.pt)))
    ORDER BY display_order, lookup_label, lookup_key;
  END
END;
GO

-- ─── sp_POS_GetStartupConfig ─────────────────────────────────────────────────
-- Returns three result sets: product type rules (POS wizard), POS lookup rows, lab transitions.
-- Consumed by GET /api/pos/startup-config (POS tablet boot).
CREATE OR ALTER PROCEDURE dbo.sp_POS_GetStartupConfig
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    product_type_key AS product_type_key,
    label,
    description,
    display_order,
    fulfillment_mode,
    rx_required,
    allow_qty_gt_1,
    ISNULL(lens_wizard_policy, N'NEVER') AS lens_wizard_policy,
    CAST(ISNULL(requires_unit_barcode, 1) AS BIT) AS requires_unit_barcode
  FROM dbo.pos_product_type_config
  WHERE is_active = 1
  ORDER BY display_order, product_type_key;

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
-- Six result sets:
--   0: categories (inc wizard presentation fields)
--   1: packages
--   2: addons
--   3: package–addon links
--   4: lens_wizard_policy for the supplied product_type_key (1 row or empty)
--   5: wizard-category allow-list for the product_type_key (0+ rows)
CREATE OR ALTER PROCEDURE dbo.sp_POS_GetLensCatalog
  @product_type_key NVARCHAR(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;

  -- RS0: categories with wizard fields
  SELECT
    id, name, pos_brand, pos_name, internal_brand, internal_name, sort_order,
    CAST(show_in_pos_wizard AS BIT) AS show_in_pos_wizard,
    ISNULL(wizard_subtitle, N'')    AS wizard_subtitle,
    ISNULL(wizard_icon, N'')        AS wizard_icon,
    ISNULL(wizard_tone, 1)          AS wizard_tone
  FROM dbo.pos_lens_categories
  WHERE is_active = 1
  ORDER BY sort_order, id;

  -- RS1: packages (inc Lenses-step card fields)
  SELECT
    id, category_id, name, pos_brand, pos_name, internal_brand, internal_name, price, sort_order,
    ISNULL(card_feat_line1, N'')     AS card_feat_line1,
    ISNULL(card_feat_line2, N'')     AS card_feat_line2,
    ISNULL(card_warranty_label, N'') AS card_warranty_label,
    ISNULL(card_warranty_tone, 1)    AS card_warranty_tone
  FROM dbo.pos_lens_packages
  WHERE is_active = 1
  ORDER BY category_id, sort_order, id;

  -- RS2: addons
  SELECT id, name, pos_brand, pos_name, internal_brand, internal_name, price, sort_order
  FROM dbo.pos_lens_addons
  WHERE is_active = 1
  ORDER BY sort_order, id;

  -- RS3: package–addon links
  SELECT package_id, addon_id
  FROM dbo.pos_lens_pkg_addons;

  -- RS4: lens_wizard_policy for this product type (single row)
  SELECT
    product_type_key,
    ISNULL(lens_wizard_policy, N'NEVER') AS lens_wizard_policy
  FROM dbo.pos_product_type_config
  WHERE product_type_key = @product_type_key
    AND is_active = 1;

  -- RS5: allow-list of lens categories for this product type (empty = show all)
  SELECT lens_category_id, sort_order
  FROM dbo.pos_product_type_lens_wizard_categories
  WHERE product_type_key = @product_type_key
  ORDER BY sort_order, lens_category_id;
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Store OS — tablet session, staff PIN v2, sessions, system_config
-- Requires sql/alter/30_store_os_access.sql applied first.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR ALTER PROCEDURE dbo.sp_POS_GetStaffForStore_v2
  @store_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    u.user_id             AS employee_id,
    u.full_name           AS [name],
    u.role_key            AS [role],
    u.store_id,
    u.pos_pin_hash,
    CAST(ISNULL(r.can_initiate_refund, 0) AS BIT) AS can_initiate_refund,
    CAST(ISNULL(r.can_view_reports, 0) AS BIT)    AS can_view_reports,
    CAST(ISNULL(r.can_manage_staff, 0) AS BIT)    AS can_manage_staff
  FROM dbo.users u
  LEFT JOIN dbo.roles r ON r.role_key = u.role_key
  WHERE u.store_id  = @store_id
    AND u.is_active = 1
    AND u.pos_pin_hash IS NOT NULL;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_ValidateTabletPin
  @tablet_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT tablet_id, store_id, device_name, pin_hash, is_active, tablet_session_version
  FROM dbo.tablets
  WHERE tablet_id = @tablet_id
    AND is_active = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_ValidateTabletSession
  @tablet_id       INT,
  @store_id        INT,
  @session_version INT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @ok BIT = 0;
  IF EXISTS (
    SELECT 1
    FROM dbo.tablets t
    WHERE t.tablet_id = @tablet_id
      AND t.store_id = @store_id
      AND t.is_active = 1
      AND t.tablet_session_version = @session_version
  )
    SET @ok = 1;
  SELECT @ok AS is_valid;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_UpdateTabletLastLogin
  @tablet_id INT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.tablets
  SET last_login_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE tablet_id = @tablet_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_LogPinAttempt
  @user_id   INT = NULL,
  @tablet_id INT = NULL,
  @store_id  INT,
  @success   BIT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.pos_pin_attempts (user_id, tablet_id, store_id, success)
  VALUES (@user_id, @tablet_id, @store_id, @success);

  IF @success = 0
    SELECT COUNT(*) AS consecutive_failures
    FROM dbo.pos_pin_attempts
    WHERE store_id = @store_id
      AND success = 0
      AND attempted_at >= DATEADD(MINUTE, -10, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
      AND (
        (@user_id IS NOT NULL AND user_id = @user_id)
        OR (@user_id IS NULL AND tablet_id = @tablet_id)
      );
  ELSE
    SELECT 0 AS consecutive_failures;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_StartOrderSession
  @tablet_id           INT,
  @user_id             INT,
  @store_id            INT,
  @role_key_snapshot   VARCHAR(50),
  @can_refund_snapshot BIT
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.pos_order_sessions
    (tablet_id, user_id, store_id, role_key_snapshot, can_refund_snapshot, status)
  VALUES
    (@tablet_id, @user_id, @store_id, @role_key_snapshot, @can_refund_snapshot, 'ACTIVE');

  SELECT CAST(SCOPE_IDENTITY() AS INT) AS session_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_CompleteOrderSession
  @session_id INT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.pos_order_sessions
  SET status = 'COMPLETED',
      completed_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE session_id = @session_id
    AND status = 'ACTIVE';

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_CancelOrderSession
  @session_id    INT,
  @cancel_reason VARCHAR(200) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.pos_order_sessions
  SET status = 'CANCELLED',
      cancelled_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      cancel_reason = @cancel_reason
  WHERE session_id = @session_id
    AND status = 'ACTIVE';

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_SetUserPin
  @user_id  INT,
  @pin_hash VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.users
  SET pos_pin_hash = @pin_hash,
      updated_at   = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE user_id = @user_id
    AND is_active = 1;

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_GetTabletsByStore
  @store_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT tablet_id, store_id, device_name, is_active, last_login_at, created_at
  FROM dbo.tablets
  WHERE store_id = @store_id
    AND is_active = 1
  ORDER BY device_name;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_CreateTablet
  @store_id    INT,
  @device_name VARCHAR(100),
  @pin_hash    VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    INSERT INTO dbo.tablets (store_id, device_name, pin_hash)
    VALUES (@store_id, @device_name, @pin_hash);

    DECLARE @tid INT = CAST(SCOPE_IDENTITY() AS INT);
    SELECT tablet_id, store_id, device_name, is_active, created_at
    FROM dbo.tablets
    WHERE tablet_id = @tid;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_ResetTabletPin
  @tablet_id INT,
  @pin_hash  VARCHAR(200)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.tablets
  SET pin_hash = @pin_hash,
      tablet_session_version = tablet_session_version + 1,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE tablet_id = @tablet_id
    AND is_active = 1;

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_DeactivateTablet
  @tablet_id INT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.tablets
  SET is_active = 0,
      tablet_session_version = tablet_session_version + 1,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE tablet_id = @tablet_id;

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO

/** Ends signed-in browser sessions only (bumps JWT version). Tablet stays active; PIN unchanged. */
CREATE OR ALTER PROCEDURE dbo.sp_POS_InvalidateTabletDeviceSessions
  @tablet_id INT
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.tablets
  SET tablet_session_version = tablet_session_version + 1,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE tablet_id = @tablet_id
    AND is_active = 1;

  SELECT @@ROWCOUNT AS rows_updated;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_UpdateTabletDeviceForStore
  @tablet_id   INT,
  @store_id    INT,
  @device_name VARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  UPDATE dbo.tablets
  SET device_name = LEFT(LTRIM(RTRIM(@device_name)), 100),
      updated_at  = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE tablet_id = @tablet_id
    AND store_id  = @store_id
    AND is_active = 1;

  SELECT CAST(@@ROWCOUNT AS INT) AS rows_updated;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_POS_GetSystemConfig
  @config_key VARCHAR(100)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT config_key, config_value
  FROM dbo.system_config
  WHERE config_key = @config_key;
END;
GO

-- ─── sp_SKU_LookupUnitByBarcode ───────────────────────────────────────────────
-- POS scan: resolve 7-digit unit barcode; returns location for store sellability.
CREATE OR ALTER PROCEDURE dbo.sp_SKU_LookupUnitByBarcode
  @unit_barcode VARCHAR(20),
  @store_id     INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @code CHAR(7) = RIGHT(REPLICATE(N'0', 7) + LTRIM(RTRIM(@unit_barcode)), 7);
  IF @code NOT LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  BEGIN
    RAISERROR(N'Invalid unit barcode. Expected 7 digits.', 16, 1);
    RETURN;
  END;

  SELECT TOP 1
    u.unit_id,
    u.sku_id,
    u.unit_no,
    u.unit_barcode,
    u.status,
    u.location_type,
    u.location_id,
    pm.product_id,
    sk.sku_code,
    sk.barcode AS batch_barcode,
    sk.pid,
    sk.sale_price,
    pm.product_type,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    ISNULL(pm.ew_collection, '') AS collection_name,
    ISNULL(pm.style_model, '') AS model_number,
    pic.colour_name,
    ISNULL(pic.colour_code, '') AS colour_code,
    ISNULL(sk.image_url, '') AS image_url,
    ISNULL(pm.ew_collection, '') + N' · ' + ISNULL(pm.style_model, '') AS product_name,
    ISNULL(sb.qty, 0) AS store_qty
  FROM dbo.sku_units u
  JOIN dbo.skus sk ON sk.sku_id = u.sku_id
  JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
  LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
  LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
  LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sb.sku_id = sk.sku_id
   AND sb.location_type = N'STORE'
   AND sb.location_id = @store_id
  WHERE u.unit_barcode = @code;
END;
GO
