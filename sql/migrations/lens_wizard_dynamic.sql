-- Dynamic lens wizard: wizard presentation fields on categories,
-- lens_wizard_policy on product type config, and the bridge table.
-- Safe to re-run. Run BEFORE sql/sp/pos.sql and sql/sp/lens_config.sql.

USE [CosmosERP];
GO

-- ── A. Wizard presentation fields on pos_lens_categories ─────────────────────

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'show_in_pos_wizard'
)
  ALTER TABLE dbo.pos_lens_categories ADD show_in_pos_wizard BIT NOT NULL CONSTRAINT DF_plc_show_wizard DEFAULT 1;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'wizard_subtitle'
)
  ALTER TABLE dbo.pos_lens_categories ADD wizard_subtitle NVARCHAR(250) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'wizard_icon'
)
  ALTER TABLE dbo.pos_lens_categories ADD wizard_icon NVARCHAR(20) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_lens_categories') AND name = N'wizard_tone'
)
  ALTER TABLE dbo.pos_lens_categories ADD wizard_tone TINYINT NULL;
GO

-- Backfill sensible defaults for existing categories (only where still NULL).
UPDATE dbo.pos_lens_categories SET
  show_in_pos_wizard = 1
WHERE show_in_pos_wizard IS NULL;

UPDATE dbo.pos_lens_categories SET wizard_icon = N'👁', wizard_tone = 1
WHERE wizard_icon IS NULL AND (
  CHARINDEX(N'single', LOWER(ISNULL(name, N''))) > 0
  OR CHARINDEX(N'single', LOWER(ISNULL(pos_name, N''))) > 0
);

UPDATE dbo.pos_lens_categories SET wizard_icon = N'🛡', wizard_tone = 2
WHERE wizard_icon IS NULL AND (
  CHARINDEX(N'zero', LOWER(ISNULL(name, N''))) > 0
  OR CHARINDEX(N'zero', LOWER(ISNULL(pos_name, N''))) > 0
);

UPDATE dbo.pos_lens_categories SET wizard_icon = N'📖', wizard_tone = 3
WHERE wizard_icon IS NULL AND (
  CHARINDEX(N'read', LOWER(ISNULL(name, N''))) > 0
  OR CHARINDEX(N'read', LOWER(ISNULL(pos_name, N''))) > 0
);

UPDATE dbo.pos_lens_categories SET wizard_icon = N'🪟', wizard_tone = 4
WHERE wizard_icon IS NULL AND (
  CHARINDEX(N'prog', LOWER(ISNULL(name, N''))) > 0
  OR CHARINDEX(N'bifoc', LOWER(ISNULL(name, N''))) > 0
  OR CHARINDEX(N'prog', LOWER(ISNULL(pos_name, N''))) > 0
  OR CHARINDEX(N'bifoc', LOWER(ISNULL(pos_name, N''))) > 0
);

UPDATE dbo.pos_lens_categories SET wizard_icon = N'📷', wizard_tone = 5
WHERE wizard_icon IS NULL;
GO

-- ── B. lens_wizard_policy on pos_product_type_config ─────────────────────────

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.pos_product_type_config') AND name = N'lens_wizard_policy'
)
  ALTER TABLE dbo.pos_product_type_config
    ADD lens_wizard_policy VARCHAR(20) NOT NULL
      CONSTRAINT CK_pos_ptc_lwp CHECK (lens_wizard_policy IN (N'NEVER', N'OPTIONAL', N'REQUIRED'))
      CONSTRAINT DF_pos_ptc_lwp DEFAULT N'NEVER';
GO

-- Set policy based on existing fulfillment_mode:
-- DUAL → OPTIONAL (customer can choose frame-only or with lenses)
-- everything else stays NEVER
UPDATE dbo.pos_product_type_config
SET lens_wizard_policy = N'OPTIONAL'
WHERE fulfillment_mode = N'DUAL'
  AND lens_wizard_policy = N'NEVER';
GO

-- ── C. Bridge: which lens categories appear per product type ──────────────────

IF OBJECT_ID(N'dbo.pos_product_type_lens_wizard_categories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_product_type_lens_wizard_categories (
    product_type_key NVARCHAR(100) NOT NULL,
    lens_category_id INT           NOT NULL,
    sort_order       INT           NOT NULL CONSTRAINT DF_pptlwc_sort DEFAULT 0,
    CONSTRAINT PK_pos_ppt_lwc PRIMARY KEY (product_type_key, lens_category_id),
    CONSTRAINT FK_ppt_lwc_ptc FOREIGN KEY (product_type_key)
      REFERENCES dbo.pos_product_type_config (product_type_key) ON DELETE CASCADE,
    CONSTRAINT FK_ppt_lwc_cat FOREIGN KEY (lens_category_id)
      REFERENCES dbo.pos_lens_categories (id) ON DELETE CASCADE
  );
END;
GO
-- No seed rows by default → all wizard-eligible categories show for any OPTIONAL type.

-- ── D. Ensure pos_product_type_config rows exist (RS4 / Lens wizard rules UI) ─
-- Same keys as sql/tables/05_pos_config.sql — safe if 05 already ran or table was cleared.
MERGE dbo.pos_product_type_config AS tgt
USING (
  SELECT * FROM (VALUES
    (N'FRAMES',       N'DUAL',    1, 1),
    (N'SUNGLASSES',   N'INSTANT', 0, 1),
    (N'ZERO_POWER',   N'INSTANT', 0, 1),
    (N'READERS',      N'INSTANT', 0, 1),
    (N'CONTACT_LENS', N'DUAL',    0, 1),
    (N'ACCESSORIES',  N'INSTANT', 0, 1)
  ) AS s(product_type_key, fulfillment_mode, rx_required, allow_qty_gt_1)
) AS src
ON tgt.product_type_key = src.product_type_key
WHEN MATCHED THEN UPDATE SET
  fulfillment_mode = src.fulfillment_mode,
  rx_required        = src.rx_required,
  allow_qty_gt_1     = src.allow_qty_gt_1,
  is_active          = 1
WHEN NOT MATCHED BY TARGET THEN
  INSERT (product_type_key, fulfillment_mode, rx_required, allow_qty_gt_1, is_active)
  VALUES (src.product_type_key, src.fulfillment_mode, src.rx_required, src.allow_qty_gt_1, 1);
GO

-- Align wizard policy with fulfillment for rows that still default to NEVER (incl. new MERGE inserts).
UPDATE dbo.pos_product_type_config
SET lens_wizard_policy = N'OPTIONAL'
WHERE fulfillment_mode = N'DUAL'
  AND lens_wizard_policy = N'NEVER';
GO
