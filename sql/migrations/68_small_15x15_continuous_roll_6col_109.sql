/*
  Migration 68 — 15×15 mm continuous roll, 6 columns across 109 mm

  Deploy: npm run migrate:68-small-15x15-continuous-roll-109
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 68: small_15x15_continuous_109 label format';
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.label_print_formats WHERE format_key = N'small_15x15_continuous_109')
BEGIN
  INSERT INTO dbo.label_print_formats (format_key, name, description, config_json, is_default, sort_order, is_active, created_at, updated_at)
  VALUES (
    N'small_15x15_continuous_109',
    N'15×15mm Label — Continuous Roll',
    N'6 columns · continuous rows · 109 mm roll · QR + unit id + brand/price on each sticker',
    N'{"v":1,"layoutType":"compact","marginTop":0,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0.02,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":3.5,"bottomBandHeightMm":4,"rightRailWidthMm":3.5,"pageWidthMm":109}',
    0,
    25,
    1,
    @now,
    @now
  );
  PRINT N'Migration 68: seeded small_15x15_continuous_109';
END
ELSE
  PRINT N'Migration 68: small_15x15_continuous_109 already exists — skipped';
GO

PRINT N'Migration 68: complete.';
GO
