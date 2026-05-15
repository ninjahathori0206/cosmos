-- Migration 35a: Add challan + finance columns (no drops yet)
USE [CosmosERP];
GO

IF (SELECT COUNT(*) FROM dbo.purchase_headers) > 0 OR (SELECT COUNT(*) FROM dbo.purchase_items) > 0
BEGIN
  RAISERROR('Migration 35 requires empty purchase tables. Run maintenance:purge-all-purchases first.', 16, 1);
END;
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'bill_ref')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'challan_number')
  EXEC sp_rename 'dbo.purchase_headers.bill_ref', 'challan_number', 'COLUMN';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'challan_date')
  ALTER TABLE dbo.purchase_headers ADD challan_date DATETIME NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'finance_transport_amt')
  ALTER TABLE dbo.purchase_headers ADD finance_transport_amt DECIMAL(12,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'challan_payable_total')
  ALTER TABLE dbo.purchase_headers ADD challan_payable_total DECIMAL(12,2) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'payable_set_at')
  ALTER TABLE dbo.purchase_headers ADD payable_set_at DATETIME NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_headers') AND name = 'payable_set_by')
  ALTER TABLE dbo.purchase_headers ADD payable_set_by INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.purchase_items') AND name = 'finance_payable_amt')
  ALTER TABLE dbo.purchase_items ADD finance_payable_amt DECIMAL(12,2) NULL;
GO

IF OBJECT_ID('dbo.supplier_purchase_invoices','U') IS NULL
BEGIN
  CREATE TABLE dbo.supplier_purchase_invoices (
    invoice_id INT IDENTITY(1,1) PRIMARY KEY,
    supplier_id INT NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    invoice_date DATE NOT NULL,
    taxable_amt DECIMAL(12,2) NOT NULL DEFAULT 0,
    cgst_amt DECIMAL(12,2) NOT NULL DEFAULT 0,
    sgst_amt DECIMAL(12,2) NOT NULL DEFAULT 0,
    igst_amt DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amt DECIMAL(12,2) NOT NULL,
    file_url VARCHAR(500) NULL,
    discrepancy_note VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at DATETIME NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_spi_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(supplier_id),
    CONSTRAINT CK_spi_status CHECK (status IN ('POSTED','VOID'))
  );
  CREATE INDEX IX_spi_supplier_date ON dbo.supplier_purchase_invoices(supplier_id, invoice_date);
END;
GO

IF OBJECT_ID('dbo.invoice_challan_allocations','U') IS NULL
BEGIN
  CREATE TABLE dbo.invoice_challan_allocations (
    allocation_id INT IDENTITY(1,1) PRIMARY KEY,
    invoice_id INT NOT NULL,
    header_id INT NOT NULL,
    allocated_amt DECIMAL(12,2) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_ica_invoice FOREIGN KEY (invoice_id) REFERENCES dbo.supplier_purchase_invoices(invoice_id),
    CONSTRAINT FK_ica_header FOREIGN KEY (header_id) REFERENCES dbo.purchase_headers(header_id),
    CONSTRAINT CK_ica_amt CHECK (allocated_amt > 0)
  );
  CREATE INDEX IX_ica_header ON dbo.invoice_challan_allocations(header_id);
  CREATE INDEX IX_ica_invoice ON dbo.invoice_challan_allocations(invoice_id);
END;
GO

PRINT 'Migration 35a complete.';
GO
