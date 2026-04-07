USE [CosmosERP];
GO

-- ── sp_MakerMaster_GetAll ─────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_MakerMaster_GetAll','P') IS NOT NULL DROP PROCEDURE dbo.sp_MakerMaster_GetAll;
GO
CREATE PROCEDURE dbo.sp_MakerMaster_GetAll @include_inactive BIT = 0
AS BEGIN
  SET NOCOUNT ON;
  SELECT maker_id, maker_name, maker_code, description, country, is_active, created_at, updated_at
  FROM dbo.maker_master
  WHERE (@include_inactive = 1 OR is_active = 1)
  ORDER BY maker_name;
END;
GO

-- ── sp_MakerMaster_GetById ────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_MakerMaster_GetById','P') IS NOT NULL DROP PROCEDURE dbo.sp_MakerMaster_GetById;
GO
CREATE PROCEDURE dbo.sp_MakerMaster_GetById @maker_id INT
AS BEGIN
  SET NOCOUNT ON;
  SELECT maker_id, maker_name, maker_code, description, country, is_active, created_at, updated_at
  FROM dbo.maker_master WHERE maker_id = @maker_id;
END;
GO

-- ── sp_MakerMaster_Create ─────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_MakerMaster_Create','P') IS NOT NULL DROP PROCEDURE dbo.sp_MakerMaster_Create;
GO
CREATE PROCEDURE dbo.sp_MakerMaster_Create
  @maker_name VARCHAR(200),
  @maker_code VARCHAR(50),
  @description VARCHAR(500) = NULL,
  @country     VARCHAR(100) = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.maker_master WHERE maker_code = @maker_code)
    BEGIN RAISERROR('Maker code already exists.',16,1); RETURN; END;
    INSERT INTO dbo.maker_master (maker_name, maker_code, description, country, is_active, created_at, updated_at)
    VALUES (@maker_name, @maker_code, @description, @country, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));
    DECLARE @id INT = SCOPE_IDENTITY();
    SELECT maker_id, maker_name, maker_code, description, country, is_active, created_at
    FROM dbo.maker_master WHERE maker_id = @id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO

-- ── sp_MakerMaster_Update ─────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_MakerMaster_Update','P') IS NOT NULL DROP PROCEDURE dbo.sp_MakerMaster_Update;
GO
CREATE PROCEDURE dbo.sp_MakerMaster_Update
  @maker_id    INT,
  @maker_name  VARCHAR(200) = NULL,
  @maker_code  VARCHAR(50)  = NULL,
  @description VARCHAR(500) = NULL,
  @country     VARCHAR(100) = NULL,
  @is_active   BIT          = NULL
AS BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.maker_master WHERE maker_id = @maker_id)
    BEGIN RAISERROR('Maker not found.',16,1); RETURN; END;
    IF @maker_code IS NOT NULL AND EXISTS (
      SELECT 1 FROM dbo.maker_master WHERE maker_code = @maker_code AND maker_id <> @maker_id)
    BEGIN RAISERROR('Maker code already used by another maker.',16,1); RETURN; END;
    UPDATE dbo.maker_master SET
      maker_name  = ISNULL(@maker_name,  maker_name),
      maker_code  = ISNULL(@maker_code,  maker_code),
      description = ISNULL(@description, description),
      country     = ISNULL(@country,     country),
      is_active   = ISNULL(@is_active,   is_active),
      updated_at  = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE maker_id = @maker_id;
    SELECT maker_id, maker_name, maker_code, description, country, is_active, updated_at
    FROM dbo.maker_master WHERE maker_id = @maker_id;
  END TRY
  BEGIN CATCH DECLARE @e NVARCHAR(4000)=ERROR_MESSAGE(); RAISERROR(@e,16,1); END CATCH;
END;
GO
