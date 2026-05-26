/*
  Migration 69 — 6-up 15×15 continuous roll uses compact label layout (QR + UID rail + footer)

  Deploy: npm run migrate:69-small-15x15-continuous-compact
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 69: small_15x15_continuous_109 compact layout';
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

UPDATE dbo.label_print_formats
SET
  description = N'6 columns · continuous rows · 109 mm roll · QR + unit id + brand/price on each sticker',
  config_json = N'{"v":1,"layoutType":"compact","marginTop":0,"marginBottom":0,"marginLeft":2,"marginRight":2,"gapRow":2,"gapCol":3,"labelWidthMm":15,"labelHeightMm":15,"labelsPerRow":6,"dotsPerMm":8,"qrCellSize":3,"qrVisualSizeMm":10,"qrTopRatio":0.02,"textTopRatio":0.68,"textXMul":1,"textYMul":1,"textFontId":2,"textFontPt":3.5,"bottomBandHeightMm":4,"rightRailWidthMm":3.5,"pageWidthMm":109}',
  updated_at = @now
WHERE format_key = N'small_15x15_continuous_109';

IF @@ROWCOUNT > 0
  PRINT N'Migration 69: updated small_15x15_continuous_109 to compact 6-up layout';
ELSE
  PRINT N'Migration 69: small_15x15_continuous_109 not found — run migration 68 first';
GO

PRINT N'Migration 69: complete.';
GO
