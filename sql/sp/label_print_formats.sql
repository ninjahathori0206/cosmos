/*
  Label print formats — stored procedures (zone-aware)
  Deploy after migration 70.
*/
USE [CosmosERP];
GO

CREATE OR ALTER PROCEDURE dbo.sp_LabelPrintFormat_GetAll
  @active_only BIT = 1
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    format_key, name, description, config_json, is_default, sort_order, is_active,
    label_type, page_width_mm, page_height_mm,
    margin_left_mm, margin_right_mm, margin_top_mm, margin_bottom_mm,
    columns_count, col_gap_mm, row_gap_mm, label_width_mm, label_height_mm,
    zones_json, created_at, updated_at
  FROM dbo.label_print_formats
  WHERE (@active_only = 0 OR is_active = 1)
  ORDER BY sort_order, format_key;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LabelPrintFormat_GetByKey
  @format_key VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT
    format_key, name, description, config_json, is_default, sort_order, is_active,
    label_type, page_width_mm, page_height_mm,
    margin_left_mm, margin_right_mm, margin_top_mm, margin_bottom_mm,
    columns_count, col_gap_mm, row_gap_mm, label_width_mm, label_height_mm,
    zones_json, created_at, updated_at
  FROM dbo.label_print_formats
  WHERE format_key = @format_key;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LabelPrintFormat_Create
  @format_key       VARCHAR(50),
  @name             NVARCHAR(120),
  @description      NVARCHAR(500) = NULL,
  @config_json      NVARCHAR(MAX),
  @is_default       BIT = 0,
  @sort_order       INT = 0,
  @is_active        BIT = 1,
  @label_type       NVARCHAR(20) = NULL,
  @page_width_mm    DECIMAL(6,2) = NULL,
  @page_height_mm   DECIMAL(6,2) = NULL,
  @margin_left_mm   DECIMAL(6,2) = NULL,
  @margin_right_mm  DECIMAL(6,2) = NULL,
  @margin_top_mm    DECIMAL(6,2) = NULL,
  @margin_bottom_mm DECIMAL(6,2) = NULL,
  @columns_count    INT = NULL,
  @col_gap_mm       DECIMAL(6,2) = NULL,
  @row_gap_mm       DECIMAL(6,2) = NULL,
  @label_width_mm   DECIMAL(6,2) = NULL,
  @label_height_mm  DECIMAL(6,2) = NULL,
  @zones_json       NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRY
    BEGIN TRANSACTION;
    IF @is_default = 1
      UPDATE dbo.label_print_formats SET is_default = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE is_default = 1;

    INSERT INTO dbo.label_print_formats (
      format_key, name, description, config_json, is_default, sort_order, is_active,
      created_at, updated_at,
      label_type, page_width_mm, page_height_mm,
      margin_left_mm, margin_right_mm, margin_top_mm, margin_bottom_mm,
      columns_count, col_gap_mm, row_gap_mm, label_width_mm, label_height_mm, zones_json
    ) VALUES (
      @format_key, @name, @description, @config_json, @is_default, @sort_order, @is_active,
      DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()),
      @label_type, @page_width_mm, @page_height_mm,
      @margin_left_mm, @margin_right_mm, @margin_top_mm, @margin_bottom_mm,
      @columns_count, @col_gap_mm, @row_gap_mm, @label_width_mm, @label_height_mm, @zones_json
    );

    COMMIT TRANSACTION;
    EXEC dbo.sp_LabelPrintFormat_GetByKey @format_key = @format_key;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LabelPrintFormat_Update
  @format_key       VARCHAR(50),
  @name             NVARCHAR(120) = NULL,
  @description      NVARCHAR(500) = NULL,
  @config_json      NVARCHAR(MAX) = NULL,
  @is_default       BIT = NULL,
  @sort_order       INT = NULL,
  @is_active        BIT = NULL,
  @label_type       NVARCHAR(20) = NULL,
  @page_width_mm    DECIMAL(6,2) = NULL,
  @page_height_mm   DECIMAL(6,2) = NULL,
  @margin_left_mm   DECIMAL(6,2) = NULL,
  @margin_right_mm  DECIMAL(6,2) = NULL,
  @margin_top_mm    DECIMAL(6,2) = NULL,
  @margin_bottom_mm DECIMAL(6,2) = NULL,
  @columns_count    INT = NULL,
  @col_gap_mm       DECIMAL(6,2) = NULL,
  @row_gap_mm       DECIMAL(6,2) = NULL,
  @label_width_mm   DECIMAL(6,2) = NULL,
  @label_height_mm  DECIMAL(6,2) = NULL,
  @zones_json       NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRY
    IF NOT EXISTS (SELECT 1 FROM dbo.label_print_formats WHERE format_key = @format_key)
    BEGIN
      RAISERROR(N'Label format not found.', 16, 1);
      RETURN;
    END

    BEGIN TRANSACTION;
    IF @is_default = 1
      UPDATE dbo.label_print_formats SET is_default = 0, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE is_default = 1 AND format_key <> @format_key;

    UPDATE dbo.label_print_formats SET
      name             = COALESCE(@name, name),
      description      = CASE WHEN @description IS NOT NULL THEN @description ELSE description END,
      config_json      = COALESCE(@config_json, config_json),
      is_default       = COALESCE(@is_default, is_default),
      sort_order       = COALESCE(@sort_order, sort_order),
      is_active        = COALESCE(@is_active, is_active),
      label_type       = COALESCE(@label_type, label_type),
      page_width_mm    = COALESCE(@page_width_mm, page_width_mm),
      page_height_mm   = COALESCE(@page_height_mm, page_height_mm),
      margin_left_mm   = COALESCE(@margin_left_mm, margin_left_mm),
      margin_right_mm  = COALESCE(@margin_right_mm, margin_right_mm),
      margin_top_mm    = COALESCE(@margin_top_mm, margin_top_mm),
      margin_bottom_mm = COALESCE(@margin_bottom_mm, margin_bottom_mm),
      columns_count    = COALESCE(@columns_count, columns_count),
      col_gap_mm       = COALESCE(@col_gap_mm, col_gap_mm),
      row_gap_mm       = COALESCE(@row_gap_mm, row_gap_mm),
      label_width_mm   = COALESCE(@label_width_mm, label_width_mm),
      label_height_mm  = COALESCE(@label_height_mm, label_height_mm),
      zones_json       = COALESCE(@zones_json, zones_json),
      updated_at       = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE format_key = @format_key;

    COMMIT TRANSACTION;
    EXEC dbo.sp_LabelPrintFormat_GetByKey @format_key = @format_key;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
  END CATCH
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_LabelPrintFormat_Delete
  @format_key VARCHAR(50)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRY
    DECLARE @was_default BIT = 0;
    SELECT @was_default = CASE WHEN is_default = 1 THEN 1 ELSE 0 END
    FROM dbo.label_print_formats WHERE format_key = @format_key;

    IF @@ROWCOUNT = 0
    BEGIN
      RAISERROR(N'Label format not found.', 16, 1);
      RETURN;
    END

    DELETE FROM dbo.label_print_formats WHERE format_key = @format_key;

    IF @was_default = 1
    BEGIN
      ;WITH pick AS (
        SELECT TOP (1) format_key
        FROM dbo.label_print_formats
        WHERE is_active = 1
        ORDER BY sort_order, format_key
      )
      UPDATE f SET is_default = 1, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      FROM dbo.label_print_formats f
      INNER JOIN pick p ON p.format_key = f.format_key;
    END

    SELECT @format_key AS format_key, 1 AS deleted;
  END TRY
  BEGIN CATCH
    THROW;
  END CATCH
END;
GO
