USE [CosmosERP];
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_FoundryLookup_GetByType  — all active values for one type
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_FoundryLookup_GetByType', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_FoundryLookup_GetByType;
GO

CREATE PROCEDURE dbo.sp_FoundryLookup_GetByType
  @lookup_type VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT lookup_id, lookup_type, lookup_key, lookup_label, description, display_order, is_active
  FROM dbo.foundry_lookup_values
  WHERE lookup_type = @lookup_type AND is_active = 1
  ORDER BY display_order, lookup_label;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_FoundryLookup_GetAll  — all values (all types, incl inactive)
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_FoundryLookup_GetAll', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_FoundryLookup_GetAll;
GO

CREATE PROCEDURE dbo.sp_FoundryLookup_GetAll
AS
BEGIN
  SET NOCOUNT ON;
  SELECT lookup_id, lookup_type, lookup_key, lookup_label, description, display_order, is_active, created_at, updated_at
  FROM dbo.foundry_lookup_values
  ORDER BY lookup_type, display_order, lookup_label;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_FoundryLookup_Create
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_FoundryLookup_Create', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_FoundryLookup_Create;
GO

CREATE PROCEDURE dbo.sp_FoundryLookup_Create
  @lookup_type  VARCHAR(50),
  @lookup_key   VARCHAR(100),
  @lookup_label VARCHAR(200),
  @description  VARCHAR(500) = NULL,
  @display_order INT = 0
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = @lookup_type AND lookup_key = @lookup_key)
    BEGIN
      RAISERROR('A value with this key already exists for this lookup type.', 16, 1);
      RETURN;
    END;
    INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order, is_active, created_at, updated_at)
    VALUES (@lookup_type, @lookup_key, @lookup_label, @description, ISNULL(@display_order,0), 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()));

    SELECT lookup_id, lookup_type, lookup_key, lookup_label, description, display_order, is_active, created_at, updated_at
    FROM dbo.foundry_lookup_values WHERE lookup_id = SCOPE_IDENTITY();
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_FoundryLookup_Update
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_FoundryLookup_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_FoundryLookup_Update;
GO

CREATE PROCEDURE dbo.sp_FoundryLookup_Update
  @lookup_id    INT,
  @lookup_label VARCHAR(200),
  @description  VARCHAR(500) = NULL,
  @display_order INT = 0,
  @is_active    BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_id = @lookup_id)
    BEGIN
      RAISERROR('Lookup value not found.', 16, 1);
      RETURN;
    END;
    UPDATE dbo.foundry_lookup_values
    SET lookup_label  = @lookup_label,
        description   = @description,
        display_order = ISNULL(@display_order, 0),
        is_active     = ISNULL(@is_active, 1),
        updated_at    = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE lookup_id = @lookup_id;

    SELECT lookup_id, lookup_type, lookup_key, lookup_label, description, display_order, is_active, created_at, updated_at
    FROM dbo.foundry_lookup_values WHERE lookup_id = @lookup_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO

-- ─────────────────────────────────────────────────────────────────
-- sp_FoundryLookup_Delete  — soft delete (is_active = 0)
-- ─────────────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.sp_FoundryLookup_Delete', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_FoundryLookup_Delete;
GO

CREATE PROCEDURE dbo.sp_FoundryLookup_Delete
  @lookup_id INT
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_id = @lookup_id)
    BEGIN
      RAISERROR('Lookup value not found.', 16, 1);
      RETURN;
    END;
    UPDATE dbo.foundry_lookup_values
    SET is_active = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE lookup_id = @lookup_id;
    SELECT lookup_id, is_active, updated_at FROM dbo.foundry_lookup_values WHERE lookup_id = @lookup_id;
  END TRY
  BEGIN CATCH
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(@ErrMsg, 16, 1);
  END CATCH;
END;
GO
