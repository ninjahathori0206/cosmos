-- Per-piece 7-digit unit barcodes + POS requires_unit_barcode on product types
PRINT N'--- 50_sku_units_and_pos_unit_barcode.sql ---';

-- Sequence for globally unique 7-digit unit codes
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'seq_sku_unit_barcode' AND SCHEMA_NAME(schema_id) = N'dbo')
BEGIN
  CREATE SEQUENCE dbo.seq_sku_unit_barcode
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9999999
    NO CYCLE;
  PRINT N'Created dbo.seq_sku_unit_barcode.';
END
ELSE
  PRINT N'dbo.seq_sku_unit_barcode already exists — skipping.';
GO

IF OBJECT_ID(N'dbo.sku_units', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sku_units (
    unit_id          INT           NOT NULL IDENTITY(1,1),
    sku_id           INT           NOT NULL,
    unit_no          INT           NOT NULL,
    unit_barcode     CHAR(7)       NOT NULL,
    status           VARCHAR(20)   NOT NULL CONSTRAINT DF_sku_units_status DEFAULT (N'AVAILABLE'),
    sold_at          DATETIME2(0)  NULL,
    sold_store_id    INT           NULL,
    order_id         INT           NULL,
    order_item_id    INT           NULL,
    created_at       DATETIME2(0)  NOT NULL CONSTRAINT DF_sku_units_created DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT PK_sku_units PRIMARY KEY (unit_id),
    CONSTRAINT FK_sku_units_sku FOREIGN KEY (sku_id) REFERENCES dbo.skus(sku_id),
    CONSTRAINT UQ_sku_units_barcode UNIQUE (unit_barcode),
    CONSTRAINT UQ_sku_units_sku_no UNIQUE (sku_id, unit_no),
    CONSTRAINT CK_sku_units_barcode_len CHECK (LEN(unit_barcode) = 7 AND unit_barcode NOT LIKE N'%[^0-9]%'),
    CONSTRAINT CK_sku_units_status CHECK (status IN (N'AVAILABLE', N'SOLD', N'RESERVED'))
  );
  CREATE INDEX IX_sku_units_sku_status ON dbo.sku_units (sku_id, status);
  PRINT N'Created dbo.sku_units.';
END
ELSE
  PRINT N'dbo.sku_units already exists — skipping.';
GO

IF OBJECT_ID(N'dbo.order_item_units', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.order_item_units (
    order_item_unit_id INT NOT NULL IDENTITY(1,1),
    order_item_id      INT NOT NULL,
    unit_id            INT NOT NULL,
    created_at         DATETIME2(0) NOT NULL CONSTRAINT DF_oiu_created DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT PK_order_item_units PRIMARY KEY (order_item_unit_id),
    CONSTRAINT FK_order_item_units_unit FOREIGN KEY (unit_id) REFERENCES dbo.sku_units(unit_id),
    CONSTRAINT UQ_order_item_units_unit UNIQUE (unit_id),
    CONSTRAINT UQ_order_item_units_item UNIQUE (order_item_id, unit_id)
  );
  PRINT N'Created dbo.order_item_units.';
END
ELSE
  PRINT N'dbo.order_item_units already exists — skipping.';
GO

IF COL_LENGTH(N'dbo.pos_product_type_config', N'requires_unit_barcode') IS NULL
BEGIN
  ALTER TABLE dbo.pos_product_type_config
    ADD requires_unit_barcode BIT NOT NULL
      CONSTRAINT DF_pos_ptc_requires_unit_bc DEFAULT (1);
  PRINT N'Added requires_unit_barcode to pos_product_type_config.';
END
ELSE
  PRINT N'requires_unit_barcode already on pos_product_type_config — skipping.';
GO

-- Only CONTACT_LENS is exempt (back-order catalogue type)
UPDATE dbo.pos_product_type_config
SET requires_unit_barcode = CASE
  WHEN product_type_key = N'CONTACT_LENS' THEN 0
  ELSE 1
END;
GO

-- Ensure common catalogue keys exist with correct flag (idempotent MERGE)
MERGE dbo.pos_product_type_config AS tgt
USING (
  SELECT * FROM (VALUES
    (N'FRAMES',            N'DUAL',    1, 1, 1),
    (N'EYEGLASSES',        N'DUAL',    1, 1, 1),
    (N'SUNGLASSES',        N'INSTANT', 0, 1, 1),
    (N'ZERO_POWER',        N'INSTANT', 0, 1, 1),
    (N'READERS',           N'INSTANT', 0, 1, 1),
    (N'ACCESSORIES',       N'INSTANT', 0, 1, 1),
    (N'GLASSES_CARE',      N'INSTANT', 0, 1, 1),
    (N'CONTACT_LENS_CARE', N'INSTANT', 0, 1, 1),
    (N'CONTACT_LENS',       N'DUAL',    0, 1, 0)
  ) AS s(product_type_key, fulfillment_mode, rx_required, allow_qty_gt_1, requires_unit_barcode)
) AS src
ON tgt.product_type_key = src.product_type_key
WHEN MATCHED THEN UPDATE SET
  requires_unit_barcode = src.requires_unit_barcode,
  is_active = 1
WHEN NOT MATCHED BY TARGET THEN
  INSERT (product_type_key, fulfillment_mode, rx_required, allow_qty_gt_1, is_active, requires_unit_barcode)
  VALUES (src.product_type_key, src.fulfillment_mode, src.rx_required, src.allow_qty_gt_1, 1, src.requires_unit_barcode);
GO

-- Allocate N unit barcodes for a SKU (digitisation / restock)
IF OBJECT_ID(N'dbo.sp_SKUv2_AllocateUnits', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKUv2_AllocateUnits;
GO
CREATE PROCEDURE dbo.sp_SKUv2_AllocateUnits
  @sku_id INT,
  @qty    INT
AS
BEGIN
  SET NOCOUNT ON;
  IF @sku_id IS NULL OR @qty IS NULL OR @qty < 1 RETURN;

  DECLARE @unitNo INT = ISNULL((SELECT MAX(unit_no) FROM dbo.sku_units WHERE sku_id = @sku_id), 0) + 1;
  DECLARE @endNo INT = @unitNo + @qty - 1;
  DECLARE @unitBarcode CHAR(7);

  WHILE @unitNo <= @endNo
  BEGIN
    SET @unitBarcode = FORMAT(NEXT VALUE FOR dbo.seq_sku_unit_barcode, 'D7');
    INSERT INTO dbo.sku_units (sku_id, unit_no, unit_barcode, status)
    VALUES (@sku_id, @unitNo, @unitBarcode, N'AVAILABLE');
    SET @unitNo += 1;
  END;
END;
GO

-- POS / scan: resolve 7-digit unit barcode (optional store stock check)
IF OBJECT_ID(N'dbo.sp_SKU_LookupUnitByBarcode', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKU_LookupUnitByBarcode;
GO
CREATE PROCEDURE dbo.sp_SKU_LookupUnitByBarcode
  @unit_barcode VARCHAR(20),
  @store_id     INT = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @code CHAR(7) = RIGHT(REPLICATE(N'0', 7) + LTRIM(RTRIM(@unit_barcode)), 7);
  IF @code NOT LIKE N'[0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
  BEGIN
    RAISERROR(N'Invalid unit barcode. Expected 7 digits.', 16, 1);
    RETURN;
  END;

  SELECT TOP 1
    u.unit_id,
    u.sku_id,
    u.unit_no,
    u.unit_barcode,
    u.status,
    sk.sku_code,
    sk.barcode AS batch_barcode,
    sk.pid,
    sk.sale_price,
    pm.product_type,
    LTRIM(RTRIM(COALESCE(
      NULLIF(LTRIM(RTRIM(ISNULL(hb.brand_name, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(pm.source_brand, ''))), ''),
      NULLIF(LTRIM(RTRIM(ISNULL(mm.maker_name, ''))), ''),
      ''
    ))) AS brand_name,
    pic.colour_name,
    ISNULL(pm.ew_collection, '') + ' · ' + ISNULL(pm.style_model, '') AS product_name,
    ISNULL(sb.qty, 0) AS store_qty
  FROM dbo.sku_units u
  JOIN dbo.skus sk ON sk.sku_id = u.sku_id
  JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
  LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
  LEFT JOIN dbo.maker_master mm ON mm.maker_id = pm.maker_master_id
  LEFT JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
  LEFT JOIN dbo.stock_balances sb
    ON sb.sku_id = sk.sku_id
   AND sb.location_type = N'STORE'
   AND sb.location_id = @store_id
  WHERE u.unit_barcode = @code;
END;
GO

-- Units for label print / APIs
IF OBJECT_ID(N'dbo.sp_SKU_GetUnits', N'P') IS NOT NULL
  DROP PROCEDURE dbo.sp_SKU_GetUnits;
GO
CREATE PROCEDURE dbo.sp_SKU_GetUnits
  @sku_id INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT unit_id, sku_id, unit_no, unit_barcode, status
  FROM dbo.sku_units
  WHERE sku_id = @sku_id
  ORDER BY unit_no;
END;
GO

PRINT N'--- 50_sku_units_and_pos_unit_barcode.sql DONE ---';
