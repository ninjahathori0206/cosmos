-- Ensures a catalogue row exists for Lens wizard "Zero Power" (substring match "zero").
-- Run after lens_config_display_fields.sql. Safe to re-run.

USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1
  FROM dbo.pos_lens_categories
  WHERE is_active = 1
    AND (
      CHARINDEX(N'zero', LOWER(LTRIM(RTRIM(ISNULL(name, N''))))) > 0
      OR CHARINDEX(N'zero', LOWER(LTRIM(RTRIM(ISNULL(pos_name, N''))))) > 0
      OR CHARINDEX(N'zero', LOWER(LTRIM(RTRIM(ISNULL(internal_name, N''))))) > 0
    )
)
BEGIN
  INSERT INTO dbo.pos_lens_categories (name, pos_brand, pos_name, internal_brand, internal_name, sort_order, is_active)
  VALUES (N'Zero Power', N'', N'Zero Power', N'', N'Zero Power', 5, 1);
END;
GO

DECLARE @zc INT;

SELECT TOP 1 @zc = id
FROM dbo.pos_lens_categories
WHERE is_active = 1
  AND (
    CHARINDEX(N'zero', LOWER(LTRIM(RTRIM(ISNULL(name, N''))))) > 0
    OR CHARINDEX(N'zero', LOWER(LTRIM(RTRIM(ISNULL(pos_name, N''))))) > 0
    OR CHARINDEX(N'zero', LOWER(LTRIM(RTRIM(ISNULL(internal_name, N''))))) > 0
  )
ORDER BY sort_order ASC, id ASC;

IF @zc IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE category_id = @zc AND is_active = 1)
BEGIN
  INSERT INTO dbo.pos_lens_packages (category_id, name, pos_brand, pos_name, price, sort_order, is_active)
  VALUES (@zc, N'Blue-Cut Standard', N'', N'Blue-Cut Standard', 799.00, 1, 1);
END;
GO
