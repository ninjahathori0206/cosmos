-- Foundry admin: lens catalogue CRUD (categories, packages, add-ons, package–add-on links).
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_AdminGet
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    id,
    name,
    pos_brand,
    pos_name,
    internal_brand,
    internal_name,
    sort_order,
    CAST(is_active AS BIT) AS is_active,
    notes
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

  SELECT package_id, addon_id
  FROM dbo.pos_lens_pkg_addons;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LensConfig_Category_Save
  @id              INT           = NULL,
  @pos_brand       NVARCHAR(100) = N'',
  @pos_name        NVARCHAR(100) = NULL,
  @internal_brand  NVARCHAR(100) = N'',
  @internal_name   NVARCHAR(100) = NULL,
  @sort_order      INT           = 0,
  @is_active       BIT           = 1,
  @notes           NVARCHAR(500) = NULL
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
    INSERT INTO dbo.pos_lens_categories (name, pos_brand, pos_name, internal_brand, internal_name, sort_order, is_active, notes)
    VALUES (@nm, @pos_brand, @pos_name, @internal_brand, @internal_name, @sort_order, @is_active, @notes);
    SET @id = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.pos_lens_categories
    SET
      name           = @nm,
      pos_brand      = @pos_brand,
      pos_name       = @pos_name,
      internal_brand = @internal_brand,
      internal_name  = @internal_name,
      sort_order     = @sort_order,
      is_active      = @is_active,
      notes          = @notes
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
  @price          DECIMAL(10, 2),
  @sort_order     INT            = 0,
  @is_active      BIT            = 1
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
    INSERT INTO dbo.pos_lens_packages (category_id, name, pos_brand, pos_name, internal_brand, internal_name, price, sort_order, is_active)
    VALUES (@category_id, @nm, @pos_brand, @pos_name, @internal_brand, @internal_name, @price, @sort_order, @is_active);
    SET @id = SCOPE_IDENTITY();
  END
  ELSE
  BEGIN
    UPDATE dbo.pos_lens_packages
    SET
      category_id    = @category_id,
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
