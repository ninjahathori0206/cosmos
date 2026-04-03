USE [CosmosERP];

PRINT 'Creating Home Brand stored procedures...';

IF OBJECT_ID('dbo.sp_HomeBrand_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_HomeBrand_GetAll;
GO

CREATE PROCEDURE dbo.sp_HomeBrand_GetAll
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    brand_id,
    brand_name,
    brand_code,
    brand_description,
    brand_logo_url,
    is_active,
    created_by,
    created_at,
    updated_at
  FROM dbo.home_brands;
END;
GO

IF OBJECT_ID('dbo.sp_HomeBrand_GetById', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_HomeBrand_GetById;
GO

CREATE PROCEDURE dbo.sp_HomeBrand_GetById
  @brand_id INT
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    brand_id,
    brand_name,
    brand_code,
    brand_description,
    brand_logo_url,
    is_active,
    created_by,
    created_at,
    updated_at
  FROM dbo.home_brands
  WHERE brand_id = @brand_id;
END;
GO

IF OBJECT_ID('dbo.sp_HomeBrand_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_HomeBrand_Create;
GO

CREATE PROCEDURE dbo.sp_HomeBrand_Create
  @brand_name        VARCHAR(200),
  @brand_code        VARCHAR(10),
  @brand_description VARCHAR(500),
  @brand_logo_url    VARCHAR(500),
  @created_by        INT
AS
BEGIN
  SET NOCOUNT ON;

  INSERT INTO dbo.home_brands (
    brand_name,
    brand_code,
    brand_description,
    brand_logo_url,
    is_active,
    created_by
  )
  VALUES (
    @brand_name,
    @brand_code,
    @brand_description,
    @brand_logo_url,
    1,
    @created_by
  );

  SELECT SCOPE_IDENTITY() AS brand_id;
END;
GO

IF OBJECT_ID('dbo.sp_HomeBrand_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_HomeBrand_Update;
GO

CREATE PROCEDURE dbo.sp_HomeBrand_Update
  @brand_id          INT,
  @brand_name        VARCHAR(200),
  @brand_description VARCHAR(500),
  @brand_logo_url    VARCHAR(500)
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.home_brands
  SET
    brand_name = @brand_name,
    brand_description = @brand_description,
    brand_logo_url = @brand_logo_url,
    updated_at = GETDATE()
  WHERE brand_id = @brand_id;

  SELECT brand_id, brand_name, brand_code, brand_description, brand_logo_url, is_active, created_by, created_at, updated_at
  FROM dbo.home_brands WHERE brand_id = @brand_id;
END;
GO

IF OBJECT_ID('dbo.sp_HomeBrand_Deactivate', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_HomeBrand_Deactivate;
GO

CREATE PROCEDURE dbo.sp_HomeBrand_Deactivate
  @brand_id INT
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE dbo.home_brands
  SET
    is_active = 0,
    updated_at = GETDATE()
  WHERE brand_id = @brand_id;

  SELECT brand_id, brand_name, brand_code, is_active, updated_at
  FROM dbo.home_brands WHERE brand_id = @brand_id;
END;
GO

