-- Migration: foundry_lookup_values — generic master for all Foundry form dropdowns
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.foundry_lookup_values', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.foundry_lookup_values (
    lookup_id     INT IDENTITY(1,1) PRIMARY KEY,
    lookup_type   VARCHAR(50)  NOT NULL,
    lookup_key    VARCHAR(100) NOT NULL,
    lookup_label  VARCHAR(200) NOT NULL,
    description   VARCHAR(500) NULL,
    display_order INT          NOT NULL DEFAULT 0,
    is_active     BIT          NOT NULL DEFAULT 1,
    created_at    DATETIME     NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_at    DATETIME     NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT UQ_foundry_lookup UNIQUE (lookup_type, lookup_key)
  );
  PRINT 'Created dbo.foundry_lookup_values';
END
ELSE
  PRINT 'dbo.foundry_lookup_values already exists — skipped';
GO

-- ── Seed default values ──────────────────────────────────────────

-- source_type
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'source_type','LOCAL_SUPPLIER','Local Supplier (Home Brand)','Product sourced from a local vendor and re-branded under an Eyewoot Home Brand.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='source_type' AND lookup_key='LOCAL_SUPPLIER');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'source_type','DIRECT_BRAND','Direct Brand','Product sourced directly from a branded manufacturer (e.g. Ray-Ban, Titan) and sold as-is.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='source_type' AND lookup_key='DIRECT_BRAND');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'source_type','IMPORT','Import / International','Product imported from an international supplier. GST rules differ.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='source_type' AND lookup_key='IMPORT');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'source_type','INHOUSE','In-house / Private Label','Product designed and manufactured in-house or exclusively for Eyewoot.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='source_type' AND lookup_key='INHOUSE');

-- product_type
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'product_type','FRAMES','Frames','Prescription optical frames.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='product_type' AND lookup_key='FRAMES');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'product_type','SUNGLASSES','Sunglasses','UV-protective sunglasses.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='product_type' AND lookup_key='SUNGLASSES');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'product_type','READERS','Readers','Pre-powered reading glasses.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='product_type' AND lookup_key='READERS');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'product_type','ZERO_POWER','Zero Power','Non-prescription fashion frames.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='product_type' AND lookup_key='ZERO_POWER');

-- bypass_reason
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'bypass_reason','PRE_BRANDED','Pre-branded by supplier','The supplier ships products with branding already applied.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='bypass_reason' AND lookup_key='PRE_BRANDED');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'bypass_reason','IMPORT_BRANDED','Import with branding applied','Imported product arrives with approved branding from the overseas supplier.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='bypass_reason' AND lookup_key='IMPORT_BRANDED');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'bypass_reason','INHOUSE_NO_BRAND','In-house — no branding required','Inhouse product does not require external branding.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='bypass_reason' AND lookup_key='INHOUSE_NO_BRAND');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'bypass_reason','OTHER','Other','Another reason — specify in notes.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='bypass_reason' AND lookup_key='OTHER');

-- label_placement
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'label_placement','TEMPLE_LEFT','Temple (Left)','Label affixed on the left temple arm.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='label_placement' AND lookup_key='TEMPLE_LEFT');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'label_placement','TEMPLE_RIGHT','Temple (Right)','Label affixed on the right temple arm.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='label_placement' AND lookup_key='TEMPLE_RIGHT');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'label_placement','FRONT_BRIDGE','Front Bridge','Label placed on the front bridge of the frame.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='label_placement' AND lookup_key='FRONT_BRIDGE');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'label_placement','INNER_TEMPLE','Inner Temple','Label affixed on the inner side of the temple.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='label_placement' AND lookup_key='INNER_TEMPLE');

-- frame_material
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_material','TR90','TR-90','Lightweight thermoplastic nylon — flexible and durable.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_material' AND lookup_key='TR90');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_material','METAL','Metal','Stainless steel, monel, or titanium alloy construction.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_material' AND lookup_key='METAL');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_material','ACETATE','Acetate','Cellulose acetate — premium, rich colours and patterns.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_material' AND lookup_key='ACETATE');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_material','TITANIUM','Titanium','Pure titanium — ultra-lightweight and hypoallergenic.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_material' AND lookup_key='TITANIUM');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_material','MIXED','Mixed Material','Combination of metal and plastic components.',5
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_material' AND lookup_key='MIXED');

-- frame_shape
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_shape','ROUND','Round','Circular lens shape.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_shape' AND lookup_key='ROUND');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_shape','AVIATOR','Aviator','Classic teardrop pilot shape.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_shape' AND lookup_key='AVIATOR');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_shape','SQUARE','Square','Angular square lens shape.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_shape' AND lookup_key='SQUARE');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_shape','RECTANGLE','Rectangle','Wider rectangular lens shape.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_shape' AND lookup_key='RECTANGLE');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_shape','CAT_EYE','Cat-eye','Upswept outer corners — retro style.',5
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_shape' AND lookup_key='CAT_EYE');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_shape','OVAL','Oval','Soft oval lens shape.',6
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_shape' AND lookup_key='OVAL');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'frame_shape','WAYFARER','Wayfarer','Trapezoidal wayfarer silhouette.',7
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='frame_shape' AND lookup_key='WAYFARER');

-- gender
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'gender','UNISEX','Unisex','Suitable for all genders.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='gender' AND lookup_key='UNISEX');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'gender','MEN','Men','Primarily targeted at men.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='gender' AND lookup_key='MEN');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'gender','WOMEN','Women','Primarily targeted at women.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='gender' AND lookup_key='WOMEN');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'gender','KIDS','Kids','Designed for children.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='gender' AND lookup_key='KIDS');

-- payment_terms
INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'payment_terms','ADVANCE','Advance','Full payment before delivery.',1
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='payment_terms' AND lookup_key='ADVANCE');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'payment_terms','NET_15','Net 15','Payment due within 15 days of invoice.',2
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='payment_terms' AND lookup_key='NET_15');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'payment_terms','NET_30','Net 30','Payment due within 30 days of invoice.',3
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='payment_terms' AND lookup_key='NET_30');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'payment_terms','SPLIT_50','50% Advance · 50% on Delivery','Half payment upfront, remainder on delivery.',4
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='payment_terms' AND lookup_key='SPLIT_50');

INSERT INTO dbo.foundry_lookup_values (lookup_type, lookup_key, lookup_label, description, display_order)
SELECT 'payment_terms','COD','Cash on Delivery','Full payment at time of delivery.',5
WHERE NOT EXISTS (SELECT 1 FROM dbo.foundry_lookup_values WHERE lookup_type='payment_terms' AND lookup_key='COD');

GO
