PRINT 'Creating POS config tables (DDL only — no reference data seeds)...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_product_type_config', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_product_type_config (
    config_id        INT IDENTITY(1, 1) NOT NULL,
    product_type_key NVARCHAR(100) NOT NULL,
    label            NVARCHAR(200) NOT NULL,
    description      NVARCHAR(500) NULL,
    display_order    INT           NOT NULL CONSTRAINT DF_pos_ptc_display_order DEFAULT 0,
    fulfillment_mode VARCHAR(10)  NOT NULL
      CONSTRAINT CK_pos_ptc_fulfillment CHECK (fulfillment_mode IN (N'INSTANT', N'LAB', N'DUAL')),
    rx_required      BIT           NOT NULL CONSTRAINT DF_pos_ptc_rx DEFAULT 0,
    allow_qty_gt_1   BIT           NOT NULL CONSTRAINT DF_pos_ptc_qty DEFAULT 1,
    requires_unit_barcode BIT      NOT NULL CONSTRAINT DF_pos_ptc_requires_unit_bc DEFAULT 1,
    lens_wizard_policy VARCHAR(10) NULL,
    is_active        BIT           NOT NULL CONSTRAINT DF_pos_ptc_active DEFAULT 1,
    CONSTRAINT PK_pos_product_type_config PRIMARY KEY (product_type_key),
    CONSTRAINT UX_pos_ptc_config_id UNIQUE (config_id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_lab_transitions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_lab_transitions (
    id            INT IDENTITY(1,1) NOT NULL,
    from_status   VARCHAR(30) NOT NULL,
    to_status     VARCHAR(30) NOT NULL,
    actor_role    VARCHAR(50) NOT NULL,
    requires_note BIT           NOT NULL CONSTRAINT DF_pos_lab_note DEFAULT 0,
    CONSTRAINT PK_pos_lab_transitions PRIMARY KEY (id),
    CONSTRAINT UQ_pos_lab_transitions UNIQUE (from_status, to_status, actor_role)
  );
END;
GO

-- Reference data (product types, lab transitions, lookups, app_settings) is configured in
-- Command Unit / Foundry / POS settings — not inserted by deploy scripts.
GO
