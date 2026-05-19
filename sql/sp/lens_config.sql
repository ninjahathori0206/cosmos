-- Foundry admin: lens catalogue CRUD (categories, packages, add-ons, package–add-on links).
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_AdminGet
AS
BEGIN
  SET NOCOUNT ON;

  -- RS0: lens categories (inc wizard fields)
  SELECT
    id,
    name,
    pos_brand,
    pos_name,
    internal_brand,
    internal_name,
    sort_order,
    CAST(is_active AS BIT)          AS is_active,
    notes,
    CAST(ISNULL(show_in_pos_wizard, 1) AS BIT) AS show_in_pos_wizard,
    ISNULL(wizard_subtitle, N'')    AS wizard_subtitle,
    ISNULL(wizard_icon, N'')        AS wizard_icon,
    ISNULL(wizard_tone, 1)          AS wizard_tone
  FROM dbo.pos_lens_categories
  ORDER BY sort_order, id;

  SELECT
    p.id,
    p.category_id,
    p.name,
    p.pos_brand,
    p.pos_name,
    p.internal_brand,
    p.internal_name,
    p.price,
    p.sort_order,
    CAST(p.is_active AS BIT) AS is_active,
    ISNULL(p.card_feat_line1, N'')     AS card_feat_line1,
    ISNULL(p.card_feat_line2, N'')     AS card_feat_line2,
    ISNULL(p.card_warranty_label, N'') AS card_warranty_label,
    ISNULL(p.card_warranty_tone, 1)  AS card_warranty_tone,
    c.name AS category_legacy_name
  FROM dbo.pos_lens_packages p
  INNER JOIN dbo.pos_lens_categories c ON c.id = p.category_id
  ORDER BY p.category_id, p.sort_order, p.id;

  SELECT
    id,
    name,
    pos_brand,
    pos_name,
    internal_brand,
    internal_name,
    price,
    sort_order,
    CAST(is_active AS BIT) AS is_active
  FROM dbo.pos_lens_addons
  ORDER BY sort_order, id;

  -- RS3: package–addon links
  SELECT package_id, addon_id
  FROM dbo.pos_lens_pkg_addons;

  -- RS4: product type config with lens_wizard_policy (for Foundry matrix page)
  SELECT
    product_type_key,
    ISNULL(lens_wizard_policy, N'NEVER') AS lens_wizard_policy,
    fulfillment_mode,
    CAST(is_active AS BIT) AS is_active
  FROM dbo.pos_product_type_config
  ORDER BY product_type_key;

  -- RS5: bridge table (all rows, Foundry builds matrix from this)
  SELECT product_type_key, lens_category_id, sort_order
  FROM dbo.pos_product_type_lens_wizard_categories
  ORDER BY product_type_key, sort_order, lens_category_id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_Category_Save
  @id                 INT           = NULL,
  @pos_brand          NVARCHAR(100) = N'',
  @pos_name           NVARCHAR(100) = NULL,
  @internal_brand     NVARCHAR(100) = N'',
  @internal_name      NVARCHAR(100) = NULL,
  @sort_order         INT           = 0,
  @is_active          BIT           = 1,
  @notes              NVARCHAR(500) = NULL,
  @show_in_pos_wizard BIT           = 1,
  @wizard_subtitle    NVARCHAR(250) = NULL,
  @wizard_icon        NVARCHAR(20)  = NULL,
  @wizard_tone        TINYINT       = NULL
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @nm NVARCHAR(100) = COALESCE(
    NULLIF(LTRIM(RTRIM(@internal_name)), N''),
    NULLIF(LTRIM(RTRIM(@pos_name)), N''),
    N'Category'
  );

  IF @id IS NULL
  BEGIN
    INSERT INTO dbo.pos_lens_categories (
      name, pos_brand, pos_name, internal_brand, internal_name,
      sort_order, is_active, notes,
      show_in_pos_wizard, wizard_subtitle, wizard_icon, wizard_tone
    )
    VALUES (
      @nm, @pos_brand, @pos_name, @internal_brand, @internal_name,
      @sort_order, @is_active, @notes,
      @show_in_pos_wizard, @wizard_subtitle, @wizard_icon, @wizard_tone
    );
    SET @id = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.pos_lens_categories
    SET
      name                = @nm,
      pos_brand           = @pos_brand,
      pos_name            = @pos_name,
      internal_brand      = @internal_brand,
      internal_name       = @internal_name,
      sort_order          = @sort_order,
      is_active           = @is_active,
      notes               = @notes,
      show_in_pos_wizard  = @show_in_pos_wizard,
      wizard_subtitle     = @wizard_subtitle,
      wizard_icon         = @wizard_icon,
      wizard_tone         = @wizard_tone
    WHERE id = @id;
  END

  SELECT @id AS id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_Package_Save
  @id             INT            = NULL,
  @category_id    INT,
  @pos_brand      NVARCHAR(100)  = N'',
  @pos_name       NVARCHAR(100)  = NULL,
  @internal_brand NVARCHAR(100)  = N'',
  @internal_name  NVARCHAR(100)  = NULL,
  @price               DECIMAL(10, 2),
  @sort_order          INT            = 0,
  @is_active           BIT            = 1,
  @card_feat_line1     NVARCHAR(250)  = NULL,
  @card_feat_line2     NVARCHAR(250)  = NULL,
  @card_warranty_label NVARCHAR(40)   = NULL,
  @card_warranty_tone  TINYINT        = NULL
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_categories WHERE id = @category_id)
    RAISERROR('Category not found.', 16, 1);

  DECLARE @nm NVARCHAR(100) = COALESCE(
    NULLIF(LTRIM(RTRIM(@internal_name)), N''),
    NULLIF(LTRIM(RTRIM(@pos_name)), N''),
    N'Package'
  );

  IF @id IS NULL
  BEGIN
    INSERT INTO dbo.pos_lens_packages (
      category_id, name, pos_brand, pos_name, internal_brand, internal_name,
      price, sort_order, is_active,
      card_feat_line1, card_feat_line2, card_warranty_label, card_warranty_tone
    )
    VALUES (
      @category_id, @nm, @pos_brand, @pos_name, @internal_brand, @internal_name,
      @price, @sort_order, @is_active,
      @card_feat_line1, @card_feat_line2, @card_warranty_label, @card_warranty_tone
    );
    SET @id = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.pos_lens_packages
    SET
      category_id         = @category_id,
      name                = @nm,
      pos_brand           = @pos_brand,
      pos_name            = @pos_name,
      internal_brand      = @internal_brand,
      internal_name       = @internal_name,
      price               = @price,
      sort_order          = @sort_order,
      is_active           = @is_active,
      card_feat_line1     = @card_feat_line1,
      card_feat_line2     = @card_feat_line2,
      card_warranty_label = @card_warranty_label,
      card_warranty_tone  = @card_warranty_tone
    WHERE id = @id;
  END

  SELECT @id AS id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_Addon_Save
  @id             INT            = NULL,
  @pos_brand      NVARCHAR(100)  = N'',
  @pos_name       NVARCHAR(100)  = NULL,
  @internal_brand NVARCHAR(100)  = N'',
  @internal_name  NVARCHAR(100)  = NULL,
  @price          DECIMAL(10, 2),
  @sort_order     INT            = 0,
  @is_active      BIT            = 1
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @nm NVARCHAR(100) = COALESCE(
    NULLIF(LTRIM(RTRIM(@internal_name)), N''),
    NULLIF(LTRIM(RTRIM(@pos_name)), N''),
    N'Add-on'
  );

  IF @id IS NULL
  BEGIN
    INSERT INTO dbo.pos_lens_addons (name, pos_brand, pos_name, internal_brand, internal_name, price, sort_order, is_active)
    VALUES (@nm, @pos_brand, @pos_name, @internal_brand, @internal_name, @price, @sort_order, @is_active);
    SET @id = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.pos_lens_addons
    SET
      name           = @nm,
      pos_brand      = @pos_brand,
      pos_name       = @pos_name,
      internal_brand = @internal_brand,
      internal_name  = @internal_name,
      price          = @price,
      sort_order     = @sort_order,
      is_active      = @is_active
    WHERE id = @id;
  END

  SELECT @id AS id;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_PackageAddons_Set
  @package_id     INT,
  @addon_ids_json NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE id = @package_id)
    RAISERROR('Package not found.', 16, 1);

  BEGIN TRANSACTION;
  BEGIN TRY
    DELETE FROM dbo.pos_lens_pkg_addons WHERE package_id = @package_id;

    INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id)
    SELECT @package_id, CAST(j.value AS INT)
    FROM OPENJSON(@addon_ids_json) j
    WHERE TRY_CAST(j.value AS INT) IS NOT NULL
      AND EXISTS (SELECT 1 FROM dbo.pos_lens_addons a WHERE a.id = CAST(j.value AS INT));

    COMMIT TRANSACTION;
    SELECT @package_id AS package_id;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @em NVARCHAR(400) = ERROR_MESSAGE();
    RAISERROR(@em, 16, 1);
  END CATCH
END;
GO

-- ── sp_LensConfig_ProductTypeLensWizard_Set ───────────────────────────────────
-- Replaces the allowed lens-category allow-list for one product_type_key.
-- Passing an empty JSON array clears the allow-list (→ show all eligible categories).
-- Also updates lens_wizard_policy for that product type.
CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_ProductTypeLensWizard_Set
  @product_type_key NVARCHAR(100),
  @lens_wizard_policy VARCHAR(20)  = NULL,   -- NULL = leave unchanged
  @category_ids_json NVARCHAR(MAX) = N'[]'   -- JSON array of {id, sort_order}
AS
BEGIN
  SET NOCOUNT ON;

  IF NOT EXISTS (SELECT 1 FROM dbo.pos_product_type_config WHERE product_type_key = @product_type_key)
    RAISERROR('Product type not found.', 16, 1);

  IF @lens_wizard_policy IS NOT NULL
    AND @lens_wizard_policy NOT IN (N'NEVER', N'OPTIONAL', N'REQUIRED')
    RAISERROR('lens_wizard_policy must be NEVER, OPTIONAL, or REQUIRED.', 16, 1);

  BEGIN TRANSACTION;
  BEGIN TRY
    -- Optionally update policy
    IF @lens_wizard_policy IS NOT NULL
      UPDATE dbo.pos_product_type_config
      SET lens_wizard_policy = @lens_wizard_policy
      WHERE product_type_key = @product_type_key;

    -- Replace bridge rows
    DELETE FROM dbo.pos_product_type_lens_wizard_categories
    WHERE product_type_key = @product_type_key;

    INSERT INTO dbo.pos_product_type_lens_wizard_categories (product_type_key, lens_category_id, sort_order)
    SELECT
      @product_type_key,
      CAST(j.id AS INT),
      ISNULL(TRY_CAST(j.sort_order AS INT), 0)
    FROM OPENJSON(@category_ids_json)
      WITH (id INT '$.id', sort_order INT '$.sort_order') AS j
    WHERE TRY_CAST(j.id AS INT) IS NOT NULL
      AND EXISTS (SELECT 1 FROM dbo.pos_lens_categories c WHERE c.id = CAST(j.id AS INT));

    COMMIT TRANSACTION;
    SELECT @product_type_key AS product_type_key;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @em2 NVARCHAR(400) = ERROR_MESSAGE();
    RAISERROR(@em2, 16, 1);
  END CATCH
END;
GO
