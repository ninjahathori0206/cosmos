-- Migration 35: Purchase challan (no money on Foundry) + Finance valuation + supplier invoices
-- Requires empty purchase_headers / purchase_items (post-purge). IST timestamps per cosmos rules.
USE [CosmosERP];
GO

IF (SELECT COUNT(*) FROM dbo.purchase_headers) > 0 OR (SELECT COUNT(*) FROM dbo.purchase_items) > 0
BEGIN
  RAISERROR('Migration 35 requires empty dbo.purchase_headers and dbo.purchase_items. Run maintenance:purge-all-purchases first.', 16, 1);
END;
GO

-- ── purchase_headers: rename bill_ref → challan_number ─────────────────────
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'bill_ref')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'challan_number')
BEGIN
  EXEC sp_rename 'dbo.purchase_headers.bill_ref', 'challan_number', 'COLUMN';
  PRINT 'Renamed bill_ref → challan_number';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'challan_date')
BEGIN
  ALTER TABLE dbo.purchase_headers ADD challan_date DATETIME NULL;
  PRINT 'Added challan_date';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'finance_transport_amt')
BEGIN
  ALTER TABLE dbo.purchase_headers ADD finance_transport_amt DECIMAL(12,2) NULL;
  PRINT 'Added finance_transport_amt';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'challan_payable_total')
BEGIN
  ALTER TABLE dbo.purchase_headers ADD challan_payable_total DECIMAL(12,2) NULL;
  PRINT 'Added challan_payable_total';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'payable_set_at')
BEGIN
  ALTER TABLE dbo.purchase_headers ADD payable_set_at DATETIME NULL;
  PRINT 'Added payable_set_at';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'payable_set_by')
BEGIN
  ALTER TABLE dbo.purchase_headers ADD payable_set_by INT NULL;
  PRINT 'Added payable_set_by';
END;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'transport_cost')
  ALTER TABLE dbo.purchase_headers DROP COLUMN transport_cost;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'expected_bill_amt')
  ALTER TABLE dbo.purchase_headers DROP COLUMN expected_bill_amt;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'actual_bill_amt')
  ALTER TABLE dbo.purchase_headers DROP COLUMN actual_bill_amt;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'bill_number')
  ALTER TABLE dbo.purchase_headers DROP COLUMN bill_number;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'bill_date')
  ALTER TABLE dbo.purchase_headers DROP COLUMN bill_date;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'discrepancy_note')
  ALTER TABLE dbo.purchase_headers DROP COLUMN discrepancy_note;
GO

DECLARE @df_pipe NVARCHAR(200);
SELECT @df_pipe = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.purchase_headers') AND c.name = 'pipeline_status';
IF @df_pipe IS NOT NULL EXEC('ALTER TABLE dbo.purchase_headers DROP CONSTRAINT ' + @df_pipe);
ALTER TABLE dbo.purchase_headers ADD CONSTRAINT DF_ph_pipeline_status DEFAULT ('DRAFT') FOR pipeline_status;
GO

DECLARE @df_bill NVARCHAR(200);
SELECT @df_bill = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID('dbo.purchase_headers') AND c.name = 'bill_status';
IF @df_bill IS NOT NULL EXEC('ALTER TABLE dbo.purchase_headers DROP CONSTRAINT ' + @df_bill);
ALTER TABLE dbo.purchase_headers ADD CONSTRAINT DF_ph_bill_status DEFAULT ('DRAFT') FOR bill_status;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'purchase_rate')
  ALTER TABLE dbo.purchase_items DROP COLUMN purchase_rate;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'gst_pct')
  ALTER TABLE dbo.purchase_items DROP COLUMN gst_pct;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'base_value')
  ALTER TABLE dbo.purchase_items DROP COLUMN base_value;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'gst_amt')
  ALTER TABLE dbo.purchase_items DROP COLUMN gst_amt;
GO
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'item_total')
  ALTER TABLE dbo.purchase_items DROP COLUMN item_total;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'finance_payable_amt')
BEGIN
  ALTER TABLE dbo.purchase_items ADD finance_payable_amt DECIMAL(12,2) NULL;
  PRINT 'Added finance_payable_amt on purchase_items';
END;
GO

IF OBJECT_ID('dbo.supplier_purchase_invoices','U') IS NULL
BEGIN
  CREATE TABLE dbo.supplier_purchase_invoices (
    invoice_id        INT IDENTITY(1,1) PRIMARY KEY,
    supplier_id       INT NOT NULL,
    invoice_number    VARCHAR(100) NOT NULL,
    invoice_date      DATE NOT NULL,
    taxable_amt       DECIMAL(12,2) NOT NULL DEFAULT 0,
    cgst_amt          DECIMAL(12,2) NOT NULL DEFAULT 0,
    sgst_amt          DECIMAL(12,2) NOT NULL DEFAULT 0,
    igst_amt          DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amt         DECIMAL(12,2) NOT NULL,
    file_url          VARCHAR(500) NULL,
    discrepancy_note  VARCHAR(500) NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    created_by        INT NULL,
    created_at        DATETIME NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at        DATETIME NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_spi_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(supplier_id),
    CONSTRAINT CK_spi_status CHECK (status IN ('POSTED','VOID'))
  );
  CREATE INDEX IX_spi_supplier_date ON dbo.supplier_purchase_invoices(supplier_id, invoice_date);
  PRINT 'Created supplier_purchase_invoices';
END;
GO

IF OBJECT_ID('dbo.invoice_challan_allocations','U') IS NULL
BEGIN
  CREATE TABLE dbo.invoice_challan_allocations (
    allocation_id   INT IDENTITY(1,1) PRIMARY KEY,
    invoice_id      INT NOT NULL,
    header_id       INT NOT NULL,
    allocated_amt   DECIMAL(12,2) NOT NULL,
    created_at      DATETIME NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_ica_invoice FOREIGN KEY (invoice_id) REFERENCES dbo.supplier_purchase_invoices(invoice_id),
    CONSTRAINT FK_ica_header  FOREIGN KEY (header_id)  REFERENCES dbo.purchase_headers(header_id),
    CONSTRAINT CK_ica_amt CHECK (allocated_amt > 0)
  );
  CREATE INDEX IX_ica_header ON dbo.invoice_challan_allocations(header_id);
  CREATE INDEX IX_ica_invoice ON dbo.invoice_challan_allocations(invoice_id);
  PRINT 'Created invoice_challan_allocations';
END;
GO

PRINT 'Migration 35 schema complete.';
GO
