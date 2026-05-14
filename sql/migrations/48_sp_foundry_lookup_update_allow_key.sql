/*
  Migration 48 — Allow editing lookup_key on Foundry lookup values

  Adds @lookup_key to dbo.sp_FoundryLookup_Update (nullable: NULL keeps existing key).

  Deploy: run once (same body as sql/sp/foundry_lookups.sql sp_FoundryLookup_Update section).
*/

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.sp_FoundryLookup_Update', 'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_FoundryLookup_Update;
GO

CREATE PROCEDURE dbo.sp_FoundryLookup_Update
  @lookup_id    INT,
  @lookup_label VARCHAR(200),
  @description  VARCHAR(500) = NULL,
  @display_order INT = 0,
  @is_active    BIT = 1,
  @lookup_key   VARCHAR(100) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_id = @lookup_id)
    BEGIN
      RAISERROR('Lookup value not found.', 16, 1);
      RETURN;
    END;

    DECLARE @newKey VARCHAR(100) = NULL;
    IF @lookup_key IS NOT NULL AND LEN(LTRIM(RTRIM(@lookup_key))) > 0
      SET @newKey = LTRIM(RTRIM(@lookup_key));

    IF @newKey IS NOT NULL
    BEGIN
      DECLARE @lt VARCHAR(50);
      SELECT @lt = lookup_type FROM dbo.foundry_lookup_values WHERE lookup_id = @lookup_id;
      IF EXISTS (
        SELECT 1 FROM dbo.foundry_lookup_values
        WHERE lookup_type = @lt AND lookup_key = @newKey AND lookup_id <> @lookup_id
      )
      BEGIN
        RAISERROR('A value with this key already exists for this lookup type.', 16, 1);
        RETURN;
      END;
    END;

    UPDATE dbo.foundry_lookup_values
    SET lookup_key    = ISNULL(@newKey, lookup_key),
        lookup_label  = @lookup_label,
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

PRINT N'Migration 48: sp_FoundryLookup_Update now accepts optional @lookup_key.';
GO
