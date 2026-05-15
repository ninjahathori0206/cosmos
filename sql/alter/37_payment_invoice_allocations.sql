-- Migration 37: Payments allocate only to supplier purchase invoices
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.payment_invoice_allocations', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.payment_invoice_allocations (
    allocation_id  INT IDENTITY(1,1) PRIMARY KEY,
    payment_id     INT NOT NULL,
    invoice_id     INT NOT NULL,
    allocated_amt  DECIMAL(12,2) NOT NULL,
    created_at     DATETIME2(0) NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_pia_payment FOREIGN KEY (payment_id) REFERENCES dbo.supplier_payments(payment_id),
    CONSTRAINT FK_pia_invoice  FOREIGN KEY (invoice_id)  REFERENCES dbo.supplier_purchase_invoices(invoice_id),
    CONSTRAINT CK_pia_amt     CHECK (allocated_amt > 0)
  );
  CREATE INDEX IX_pia_payment ON dbo.payment_invoice_allocations(payment_id);
  CREATE INDEX IX_pia_invoice ON dbo.payment_invoice_allocations(invoice_id);
  PRINT 'Created dbo.payment_invoice_allocations';
END
ELSE PRINT 'payment_invoice_allocations already exists – skipped';
GO

PRINT 'Migration 37 complete.';
