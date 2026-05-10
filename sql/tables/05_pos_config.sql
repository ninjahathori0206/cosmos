PRINT 'Creating POS config tables and seeds...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_product_type_config', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_product_type_config (
    product_type_key NVARCHAR(100) NOT NULL,
    fulfillment_mode VARCHAR(10)  NOT NULL
      CONSTRAINT CK_pos_ptc_fulfillment CHECK (fulfillment_mode IN (N'INSTANT', N'LAB', N'DUAL')),
    rx_required      BIT           NOT NULL CONSTRAINT DF_pos_ptc_rx DEFAULT 0,
    allow_qty_gt_1   BIT           NOT NULL CONSTRAINT DF_pos_ptc_qty DEFAULT 1,
    is_active        BIT           NOT NULL CONSTRAINT DF_pos_ptc_active DEFAULT 1,
    CONSTRAINT PK_pos_product_type_config PRIMARY KEY (product_type_key)
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

-- Extra product types (align with Foundry catalogue keys).
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'product_type', N'CONTACT_LENS', N'Contact lens', N'Contact lenses.', 5
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'product_type' AND lookup_key = N'CONTACT_LENS');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'product_type', N'ACCESSORIES', N'Accessories', N'Accessories and care products.', 6
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'product_type' AND lookup_key = N'ACCESSORIES');
GO

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
  rx_required      = src.rx_required,
  allow_qty_gt_1   = src.allow_qty_gt_1,
  is_active        = 1
WHEN NOT MATCHED BY TARGET THEN
  INSERT (product_type_key, fulfillment_mode, rx_required, allow_qty_gt_1, is_active)
  VALUES (src.product_type_key, src.fulfillment_mode, src.rx_required, src.allow_qty_gt_1, 1);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.pos_lab_transitions)
BEGIN
  INSERT INTO dbo.pos_lab_transitions (from_status, to_status, actor_role, requires_note) VALUES
    (N'ORDER_PLACED',                    N'ADVANCE_PAID',                    N'store_in_charge', 0),
    (N'ADVANCE_PAID',                    N'SENT_TO_LAB',                     N'lab_manager',     0),
    (N'SENT_TO_LAB',                     N'FRAME_PENDING_LENS_BACKORDER',    N'lab_manager',     0),
    (N'FRAME_PENDING_LENS_BACKORDER',    N'FRAME_RECEIVED_LENS_BACKORDER',   N'lab_manager',     0),
    (N'FRAME_RECEIVED_LENS_BACKORDER',   N'FRAME_AND_LENS_RECEIVED',         N'lab_manager',     0),
    (N'FRAME_AND_LENS_RECEIVED',         N'LAB_FITTING',                     N'lab_manager',     0),
    (N'LAB_FITTING',                     N'QC_PASS',                         N'qc_team',         0),
    (N'LAB_FITTING',                     N'QC_FAIL_LAB',                     N'qc_team',         1),
    (N'QC_FAIL_LAB',                     N'LAB_FITTING',                     N'lab_manager',     0),
    (N'QC_PASS',                         N'DISPATCHED_TO_STORE',             N'lab_manager',     0),
    (N'DISPATCHED_TO_STORE',             N'RECEIVED_AT_STORE',               N'store_in_charge', 0),
    (N'RECEIVED_AT_STORE',               N'STORE_QC_PASS',                   N'store_in_charge', 0),
    (N'RECEIVED_AT_STORE',               N'STORE_QC_PARTIAL',                N'store_in_charge', 1),
    (N'RECEIVED_AT_STORE',               N'QC_FAIL_STORE',                   N'store_in_charge', 1),
    (N'QC_FAIL_STORE',                   N'SENT_TO_LAB',                     N'store_in_charge', 0),
    (N'STORE_QC_PASS',                   N'READY_FOR_DELIVERY',              N'store_staff',     0),
    (N'STORE_QC_PARTIAL',               N'READY_FOR_DELIVERY',              N'store_staff',     0),
    (N'READY_FOR_DELIVERY',              N'DELIVERED',                       N'store_staff',     0),
    (N'DELIVERED',                       N'BALANCE_COLLECTED',               N'store_staff',     0),
    (N'BALANCE_COLLECTED',               N'INVOICED',                        N'system',          0);
END;
GO

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_qc_fail_reason', N'POWER_MISMATCH', N'Power mismatch', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_qc_fail_reason' AND lookup_key = N'POWER_MISMATCH');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_qc_fail_reason', N'COATING_DEFECT', N'Coating defect', NULL, 2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_qc_fail_reason' AND lookup_key = N'COATING_DEFECT');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_qc_fail_reason', N'FRAME_SCRATCH', N'Frame scratch', NULL, 3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_qc_fail_reason' AND lookup_key = N'FRAME_SCRATCH');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_qc_fail_reason', N'AXIS_ERROR', N'Axis error', NULL, 4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_qc_fail_reason' AND lookup_key = N'AXIS_ERROR');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_qc_fail_reason', N'OTHER', N'Other', NULL, 5
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_qc_fail_reason' AND lookup_key = N'OTHER');
GO

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_call_outcome', N'ANSWERED', N'Answered', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_call_outcome' AND lookup_key = N'ANSWERED');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_call_outcome', N'CALLBACK_REQUESTED', N'Callback requested', NULL, 2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_call_outcome' AND lookup_key = N'CALLBACK_REQUESTED');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_call_outcome', N'NO_ANSWER', N'No answer', NULL, 3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_call_outcome' AND lookup_key = N'NO_ANSWER');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_call_outcome', N'WRONG_NUMBER', N'Wrong number', NULL, 4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_call_outcome' AND lookup_key = N'WRONG_NUMBER');
GO

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_payment_method', N'CASH', N'Cash', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_payment_method' AND lookup_key = N'CASH');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_payment_method', N'CARD', N'Card', NULL, 2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_payment_method' AND lookup_key = N'CARD');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_payment_method', N'UPI', N'UPI', NULL, 3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_payment_method' AND lookup_key = N'UPI');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_payment_method', N'POINTS', N'Points', NULL, 4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_payment_method' AND lookup_key = N'POINTS');
GO

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_order_source', N'POS', N'POS', NULL, 1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_order_source' AND lookup_key = N'POS');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_order_source', N'APP', N'App', NULL, 2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_order_source' AND lookup_key = N'APP');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT N'pos_order_source', N'ARMY', N'Army', NULL, 3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type = N'pos_order_source' AND lookup_key = N'ARMY');
GO

INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
SELECT N'lab_advance_pct', N'40', N'pos', N'Lab order advance percent (0–100).'
WHERE NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'lab_advance_pct');

INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
SELECT N'pos_gst_rate', N'0.05', N'pos', N'GST rate as decimal (e.g. 0.05 = 5%).'
WHERE NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_gst_rate');

INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
SELECT N'pos_invoice_prefix', N'EW-INV-', N'pos', N'GST invoice number prefix.'
WHERE NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_invoice_prefix');

INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
SELECT N'pos_points_maturity_days', N'30', N'pos', N'Days before points become redeemable.'
WHERE NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_points_maturity_days');

INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
SELECT N'pos_procurement_mode', N'STORE', N'pos', N'Default procurement: STORE | HQ.'
WHERE NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_procurement_mode');

INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
SELECT N'pos_order_seq', N'1000', N'pos', N'Monotonic order sequence (integer string).'
WHERE NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_order_seq');

INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
SELECT N'pos_msg_customer_ready', N'Your order is ready for pickup at {store_name}.', N'pos', N'Customer notification template.'
WHERE NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'pos_msg_customer_ready');
GO
