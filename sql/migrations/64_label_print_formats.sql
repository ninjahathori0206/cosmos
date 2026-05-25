/*
  Migration 64 — Named label print formats (org-wide QR label geometry)

  Deploy: npm run migrate:64-label-print-formats
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 64: label_print_formats';
GO

IF OBJECT_ID(N'dbo.label_print_formats', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.label_print_formats (
    format_key   VARCHAR(50)   NOT NULL CONSTRAINT PK_label_print_formats PRIMARY KEY,
    name         NVARCHAR(120) NOT NULL,
    description  NVARCHAR(500) NULL,
    config_json  NVARCHAR(MAX) NOT NULL,
    is_default   BIT           NOT NULL CONSTRAINT DF_label_print_formats_is_default DEFAULT (0),
    sort_order   INT           NOT NULL CONSTRAINT DF_label_print_formats_sort_order DEFAULT (0),
    is_active    BIT           NOT NULL CONSTRAINT DF_label_print_formats_is_active DEFAULT (1),
    created_at   DATETIME2(0)  NOT NULL CONSTRAINT DF_label_print_formats_created DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at   DATETIME2(0)  NOT NULL CONSTRAINT DF_label_print_formats_updated DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME()))
  );
  PRINT N'Migration 64: created dbo.label_print_formats';
END
ELSE
  PRINT N'Migration 64: dbo.label_print_formats already exists — skipped create';
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.label_print_formats WHERE format_key = N'large_label')
BEGIN
  INSERT INTO dbo.label_print_formats (format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at)
  VALUES (
    N'large_label',
    N'Large label',
    N'Roll label — 40×28 mm (default)',
    N'{"v":1,"marginTop":0,"marginBottom":0,"marginLeft":0,"marginRight":0,"gapRow":0,"gapCol":0,"labelWidthMm":40,"labelHeightMm":28,"labelsPerRow":1,"dotsPerMm":8,"qrCellSize":4,"qrVisualSizeMm":14,"qrTopRatio":0,"textTopRatio":0.72,"textXMul":2,"textYMul":2,"textFontId":2,"textFontPt":5}',
    1,
    10,
    1,
    @now,
    @now
  );
  PRINT N'Migration 64: seeded large_label';
END;

IF NOT EXISTS (SELECT 1 FROM dbo.label_print_formats WHERE format_key = N'small_label')
BEGIN
  INSERT INTO dbo.label_print_formats (format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at)
  VALUES (
    N'small_label',
    N'Small label',
    N'Small sticker — 15×15 mm',
    N'{"v":1,"marginTop":0,"marginBottom":0,"marginLeft":0,"marginRight":0,"gapRow":0,"gapCol":0,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":1,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0.02,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":4}',
    0,
    20,
    1,
    @now,
    @now
  );
  PRINT N'Migration 64: seeded small_label';
END;
GO

PRINT N'Migration 64: complete.';
GO
