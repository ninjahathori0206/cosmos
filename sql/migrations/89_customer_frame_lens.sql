-- Customer-owned frame: product type, order line photo/note columns, app setting placeholder.
-- After deploy: create virtual SKU in Foundry (product_type CUSTOMER_FRAME) and set:
--   app_settings.pos.customer_frame_sku_id = <sku_id>
USE [CosmosERP];
GO

IF NOT EXISTS (
  SELECT 1 FROM dbo.pos_product_type_config
  WHERE product_type_key = N'CUSTOMER_FRAME'
)
BEGIN
  INSERT INTO dbo.pos_product_type_config (
    product_type_key, fulfillment_mode, rx_required, allow_qty_gt_1,
    requires_unit_barcode, is_active, lens_wizard_policy,
    label, description, display_order
  )
  VALUES (
    N'CUSTOMER_FRAME',
    N'LAB',
    0,
    0,
    0,
    1,
    N'REQUIRED',
    N'Customer frame',
    N'Lenses fitted to customer-owned frame (no store unit scan)',
    950
  );
  PRINT N'Inserted product type CUSTOMER_FRAME.';
END
ELSE
  PRINT N'CUSTOMER_FRAME product type already exists — skipping insert.';
GO

IF COL_LENGTH(N'dbo.pos_order_items', N'customer_frame_photo_url') IS NULL
BEGIN
  ALTER TABLE dbo.pos_order_items ADD customer_frame_photo_url NVARCHAR(500) NULL;
  PRINT N'Added customer_frame_photo_url to pos_order_items.';
END
GO

IF COL_LENGTH(N'dbo.pos_order_items', N'customer_frame_note') IS NULL
BEGIN
  ALTER TABLE dbo.pos_order_items ADD customer_frame_note NVARCHAR(250) NULL;
  PRINT N'Added customer_frame_note to pos_order_items.';
END
GO

IF OBJECT_ID(N'dbo.oe_order_items', N'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.oe_order_items', N'customer_frame_photo_url') IS NULL
  BEGIN
    ALTER TABLE dbo.oe_order_items ADD customer_frame_photo_url NVARCHAR(500) NULL;
    PRINT N'Added customer_frame_photo_url to oe_order_items.';
  END
  IF COL_LENGTH(N'dbo.oe_order_items', N'customer_frame_note') IS NULL
  BEGIN
    ALTER TABLE dbo.oe_order_items ADD customer_frame_note NVARCHAR(250) NULL;
    PRINT N'Added customer_frame_note to oe_order_items.';
  END
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos.customer_frame_sku_id')
BEGIN
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (
    N'pos.customer_frame_sku_id',
    N'',
    N'pos',
    N'SKU id for virtual Lenses on customer frame product (Foundry). Required for Store OS customer-frame flow.'
  );
  PRINT N'Seeded app_settings pos.customer_frame_sku_id (set value after creating SKU).';
END
GO
