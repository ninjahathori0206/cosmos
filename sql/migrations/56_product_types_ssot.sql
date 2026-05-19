-- Product types SSOT: display metadata on pos_product_type_config; retire foundry_lookup_values.product_type
USE [CosmosERP];
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

-- ── A. config_id for API / Command Unit edit by numeric id ───────────────────
IF COL_LENGTH(N'dbo.pos_product_type_config', N'config_id') IS NULL
BEGIN
  ALTER TABLE dbo.pos_product_type_config ADD config_id INT IDENTITY(1, 1) NOT NULL;
  PRINT N'Added config_id to pos_product_type_config.';
END
ELSE
  PRINT N'config_id already on pos_product_type_config — skipping.';
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'UX_pos_ptc_config_id' AND object_id = OBJECT_ID(N'dbo.pos_product_type_config')
)
BEGIN
  CREATE UNIQUE INDEX UX_pos_ptc_config_id ON dbo.pos_product_type_config (config_id);
  PRINT N'Created UX_pos_ptc_config_id.';
END
GO

-- ── B. label, description, display_order ─────────────────────────────────────
IF COL_LENGTH(N'dbo.pos_product_type_config', N'label') IS NULL
BEGIN
  ALTER TABLE dbo.pos_product_type_config ADD label NVARCHAR(200) NULL;
  PRINT N'Added label to pos_product_type_config.';
END
GO

IF COL_LENGTH(N'dbo.pos_product_type_config', N'description') IS NULL
BEGIN
  ALTER TABLE dbo.pos_product_type_config ADD description NVARCHAR(500) NULL;
  PRINT N'Added description to pos_product_type_config.';
END
GO

IF COL_LENGTH(N'dbo.pos_product_type_config', N'display_order') IS NULL
BEGIN
  ALTER TABLE dbo.pos_product_type_config ADD display_order INT NOT NULL
    CONSTRAINT DF_pos_ptc_display_order DEFAULT 0;
  PRINT N'Added display_order to pos_product_type_config.';
END
GO

-- ── C. Seed pos rows from lookups that only exist in foundry_lookup_values ───
INSERT INTO dbo.pos_product_type_config (
  product_type_key, fulfillment_mode, rx_required, allow_qty_gt_1,
  requires_unit_barcode, is_active, lens_wizard_policy,
  label, description, display_order
)
SELECT
  UPPER(LTRIM(RTRIM(lv.lookup_key))),
  N'INSTANT',
  0,
  1,
  CASE WHEN UPPER(LTRIM(RTRIM(lv.lookup_key))) = N'CONTACT_LENS' THEN 0 ELSE 1 END,
  lv.is_active,
  N'NEVER',
  lv.lookup_label,
  lv.description,
  ISNULL(lv.display_order, 0)
FROM dbo.foundry_lookup_values lv
WHERE lv.lookup_type = N'product_type'
  AND NOT EXISTS (
    SELECT 1 FROM dbo.pos_product_type_config ptc
    WHERE LOWER(LTRIM(RTRIM(ptc.product_type_key))) = LOWER(LTRIM(RTRIM(lv.lookup_key)))
  );
GO

-- ── D. Merge lookup labels into existing pos rows ────────────────────────────
UPDATE ptc
SET
  label = COALESCE(NULLIF(LTRIM(RTRIM(lv.lookup_label)), N''), ptc.label),
  description = COALESCE(lv.description, ptc.description),
  display_order = CASE WHEN ISNULL(ptc.display_order, 0) = 0 THEN ISNULL(lv.display_order, 0) ELSE ptc.display_order END
FROM dbo.pos_product_type_config ptc
INNER JOIN dbo.foundry_lookup_values lv
  ON lv.lookup_type = N'product_type'
  AND LOWER(LTRIM(RTRIM(lv.lookup_key))) = LOWER(LTRIM(RTRIM(ptc.product_type_key)));
GO

-- ── E. Backfill label from key where still empty ─────────────────────────────
UPDATE dbo.pos_product_type_config
SET label = product_type_key
WHERE label IS NULL OR LTRIM(RTRIM(label)) = N'';
GO

ALTER TABLE dbo.pos_product_type_config ALTER COLUMN label NVARCHAR(200) NOT NULL;
GO

-- ── F. Remove duplicate product_type lookup rows ─────────────────────────────
DELETE FROM dbo.foundry_lookup_values WHERE lookup_type = N'product_type';
GO

PRINT N'56_product_types_ssot: product types consolidated on pos_product_type_config.';
GO
