IF OBJECT_ID('dbo.sp_Store_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Store_GetAll;
GO

CREATE PROCEDURE dbo.sp_Store_GetAll
AS
BEGIN
  SET NOCOUNT ON;

  SELECT
    s.store_id,
    s.store_name,
    s.store_code,
    s.store_type,
    s.gstin,
    s.address,
    s.city,
    s.state,
    s.phone,
    s.status,
    s.is_active,
    s.created_at,
    s.updated_at
  FROM dbo.stores s;
END;
GO

IF OBJECT_ID('dbo.sp_Store_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Store_Create;
GO

CREATE PROCEDURE dbo.sp_Store_Create
  @store_name   VARCHAR(200),
  @store_code   VARCHAR(20),
  @store_type   VARCHAR(50),
  @gstin        VARCHAR(20) = NULL,
  @address      VARCHAR(500) = NULL,
  @city         VARCHAR(100) = NULL,
  @state        VARCHAR(100) = NULL,
  @phone        VARCHAR(20) = NULL,
  @status       VARCHAR(20) = 'ACTIVE'
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    INSERT INTO dbo.stores (
      store_name,
      store_code,
      store_type,
      gstin,
      address,
      city,
      state,
      phone,
      status,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      @store_name,
      @store_code,
      @store_type,
      @gstin,
      @address,
      @city,
      @state,
      @phone,
      @status,
      CASE
        WHEN @status = 'INACTIVE' THEN 0
        ELSE 1
      END,
      DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      DATEADD(MINUTE, 330, SYSUTCDATETIME())
    );

    SELECT
      s.store_id,
      s.store_name,
      s.store_code,
      s.store_type,
      s.gstin,
      s.address,
      s.city,
      s.state,
      s.phone,
      s.status,
      s.is_active,
      s.created_at,
      s.updated_at
    FROM dbo.stores s
    WHERE s.store_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Store_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Store_Update;
GO

CREATE PROCEDURE dbo.sp_Store_Update
  @store_id     INT,
  @store_name   VARCHAR(200),
  @store_code   VARCHAR(20),
  @store_type   VARCHAR(50),
  @gstin        VARCHAR(20) = NULL,
  @address      VARCHAR(500) = NULL,
  @city         VARCHAR(100) = NULL,
  @state        VARCHAR(100) = NULL,
  @phone        VARCHAR(20) = NULL,
  @status       VARCHAR(20) = 'ACTIVE'
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    UPDATE dbo.stores
    SET
      store_name = @store_name,
      store_code = @store_code,
      store_type = @store_type,
      gstin = @gstin,
      address = @address,
      city = @city,
      state = @state,
      phone = @phone,
      status = @status,
      is_active =
        CASE
          WHEN @status = 'INACTIVE' THEN 0
          ELSE 1
        END,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE store_id = @store_id;

    SELECT
      s.store_id,
      s.store_name,
      s.store_code,
      s.store_type,
      s.gstin,
      s.address,
      s.city,
      s.state,
      s.phone,
      s.status,
      s.is_active,
      s.created_at,
      s.updated_at
    FROM dbo.stores s
    WHERE s.store_id = @store_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg2 NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg2, 16, 1);
  END CATCH;
END;
GO

IF OBJECT_ID('dbo.sp_Store_Delete', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_Store_Delete;
GO

CREATE PROCEDURE dbo.sp_Store_Delete
  @store_id INT
AS
BEGIN
  SET NOCOUNT ON;

  BEGIN TRY
    UPDATE dbo.stores
    SET
      is_active = 0,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE store_id = @store_id;

    SELECT
      s.store_id,
      s.store_name,
      s.store_code,
      s.store_type,
      s.gstin,
      s.address,
      s.city,
      s.state,
      s.phone,
      s.is_active,
      s.created_at,
      s.updated_at
    FROM dbo.stores s
    WHERE s.store_id = @store_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg3 NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg3, 16, 1);
  END CATCH;
END;
GO

