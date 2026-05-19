/*
  Migration 51 — Unit-aware transfers + sku_units location custody

  - stock_transfer_doc_units (unique unit_id per transfer)
  - sku_units.location_type, location_id
  - Extended status / location CKs
  - Backfill AVAILABLE units at primary warehouse
  - Updates sp_SKUv2_AllocateUnits for new units at primary WH

  Deploy: npm run migrate:51-stock-transfer-doc-units
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'--- 51_stock_transfer_doc_units_and_unit_location.sql ---';
GO

IF OBJECT_ID(N'dbo.stock_transfer_doc_units', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_transfer_doc_units (
    doc_unit_id INT          NOT NULL IDENTITY(1,1),
    doc_id      INT          NOT NULL,
    line_id     INT          NOT NULL,
    unit_id     INT          NOT NULL,
    created_at  DATETIME2(0) NOT NULL CONSTRAINT DF_stdu_created DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT PK_stock_transfer_doc_units PRIMARY KEY (doc_unit_id),
    CONSTRAINT FK_stdu_doc FOREIGN KEY (doc_id) REFERENCES dbo.stock_transfer_docs(doc_id) ON DELETE CASCADE,
    CONSTRAINT FK_stdu_line FOREIGN KEY (line_id) REFERENCES dbo.stock_transfer_doc_lines(line_id),
    CONSTRAINT FK_stdu_unit FOREIGN KEY (unit_id) REFERENCES dbo.sku_units(unit_id),
    CONSTRAINT UQ_stock_transfer_doc_units_unit UNIQUE (unit_id)
  );
  CREATE INDEX IX_stdu_doc ON dbo.stock_transfer_doc_units (doc_id);
  CREATE INDEX IX_stdu_line ON dbo.stock_transfer_doc_units (line_id);
  PRINT N'Created dbo.stock_transfer_doc_units';
END
ELSE
  PRINT N'dbo.stock_transfer_doc_units already exists — skipped';
GO

IF COL_LENGTH(N'dbo.sku_units', N'location_type') IS NULL
BEGIN
  ALTER TABLE dbo.sku_units
    ADD location_type VARCHAR(20) NOT NULL
      CONSTRAINT DF_sku_units_location_type DEFAULT (N'WAREHOUSE');
  PRINT N'Added sku_units.location_type';
END
GO

IF COL_LENGTH(N'dbo.sku_units', N'location_id') IS NULL
BEGIN
  ALTER TABLE dbo.sku_units
    ADD location_id INT NULL;
  PRINT N'Added sku_units.location_id';
END
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_sku_units_status' AND parent_object_id = OBJECT_ID(N'dbo.sku_units'))
  ALTER TABLE dbo.sku_units DROP CONSTRAINT CK_sku_units_status;
GO

ALTER TABLE dbo.sku_units ADD CONSTRAINT CK_sku_units_status CHECK (
  status IN (N'AVAILABLE', N'RESERVED', N'SOLD', N'IN_TRANSIT', N'AT_STORE', N'AT_LAB', N'CONSUMED')
);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_sku_units_location_type' AND parent_object_id = OBJECT_ID(N'dbo.sku_units'))
  ALTER TABLE dbo.sku_units DROP CONSTRAINT CK_sku_units_location_type;
GO

ALTER TABLE dbo.sku_units ADD CONSTRAINT CK_sku_units_location_type CHECK (
  location_type IN (N'WAREHOUSE', N'IN_TRANSIT', N'STORE', N'LAB', N'CONSUMED')
);
GO

/* Backfill custody for existing units */
DECLARE @wh INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();

IF @wh IS NOT NULL
BEGIN
  UPDATE u
  SET
    location_type = N'WAREHOUSE',
    location_id   = @wh
  FROM dbo.sku_units u
  WHERE u.status = N'AVAILABLE'
    AND (u.location_id IS NULL OR u.location_type IS NULL OR u.location_type = N'WAREHOUSE');

  UPDATE u
  SET
    location_type = N'STORE',
    location_id   = u.sold_store_id
  FROM dbo.sku_units u
  WHERE u.status = N'SOLD'
    AND u.sold_store_id IS NOT NULL
    AND (u.location_id IS NULL OR u.location_type NOT IN (N'STORE', N'LAB', N'CONSUMED'));
END
GO

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

  DECLARE @wh INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
  IF @wh IS NULL
    RAISERROR('Primary warehouse is not configured.', 16, 1);

  DECLARE @unitNo INT = ISNULL((SELECT MAX(unit_no) FROM dbo.sku_units WHERE sku_id = @sku_id), 0) + 1;
  DECLARE @endNo INT = @unitNo + @qty - 1;
  DECLARE @unitBarcode CHAR(7);

  WHILE @unitNo <= @endNo
  BEGIN
    SET @unitBarcode = FORMAT(NEXT VALUE FOR dbo.seq_sku_unit_barcode, N'D7');
    INSERT INTO dbo.sku_units (sku_id, unit_no, unit_barcode, status, location_type, location_id)
    VALUES (@sku_id, @unitNo, @unitBarcode, N'AVAILABLE', N'WAREHOUSE', @wh);
    SET @unitNo += 1;
  END;
END;
GO

PRINT N'--- 51_stock_transfer_doc_units_and_unit_location.sql DONE ---';
GO
