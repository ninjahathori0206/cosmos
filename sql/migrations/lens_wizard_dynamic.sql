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

-- Category wizard icon/tone: set in Foundry only (no name-pattern backfill).

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

-- Align wizard policy with fulfillment for rows that still default to NEVER.
UPDATE dbo.pos_product_type_config
SET lens_wizard_policy = N'OPTIONAL'
WHERE fulfillment_mode = N'DUAL'
  AND lens_wizard_policy = N'NEVER';
GO
