-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 15: Finance AP tables — supplier_payments + payment_allocations
-- ─────────────────────────────────────────────────────────────────────────────
USE [CosmosERP];
GO

-- ── 1. supplier_payments ──────────────────────────────────────────────────────
IF OBJECT_ID('dbo.supplier_payments','U') IS NULL
BEGIN
  CREATE TABLE dbo.supplier_payments (
    payment_id     INT IDENTITY(1,1) PRIMARY KEY,
    supplier_id    INT NOT NULL,
    payment_date   DATE NOT NULL,
    amount         DECIMAL(12,2) NOT NULL,
    payment_mode   VARCHAR(30)  NOT NULL DEFAULT 'NEFT',  -- NEFT, RTGS, CHEQUE, CASH, UPI
    reference_no   VARCHAR(100) NULL,   -- UTR / cheque no.
    bank_account   VARCHAR(100) NULL,
    notes          VARCHAR(500) NULL,
    is_void        BIT NOT NULL DEFAULT 0,
    void_reason    VARCHAR(300) NULL,
    created_by     INT NULL,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_sp_supplier  FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(supplier_id),
    CONSTRAINT FK_sp_user      FOREIGN KEY (created_by)  REFERENCES dbo.users(user_id),
    CONSTRAINT CK_sp_mode      CHECK (payment_mode IN ('NEFT','RTGS','CHEQUE','CASH','UPI'))
  );
  PRINT 'Created dbo.supplier_payments';
END
ELSE PRINT 'supplier_payments already exists – skipped';
GO

-- ── 2. payment_allocations ────────────────────────────────────────────────────
IF OBJECT_ID('dbo.payment_allocations','U') IS NULL
BEGIN
  CREATE TABLE dbo.payment_allocations (
    allocation_id  INT IDENTITY(1,1) PRIMARY KEY,
    payment_id     INT NOT NULL,
    header_id      INT NOT NULL,
    allocated_amt  DECIMAL(12,2) NOT NULL,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_pa_payment FOREIGN KEY (payment_id) REFERENCES dbo.supplier_payments(payment_id),
    CONSTRAINT FK_pa_header  FOREIGN KEY (header_id)  REFERENCES dbo.purchase_headers(header_id),
    CONSTRAINT CK_pa_amt     CHECK (allocated_amt > 0)
  );
  PRINT 'Created dbo.payment_allocations';
END
ELSE PRINT 'payment_allocations already exists – skipped';
GO

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_sp_supplier_date' AND object_id=OBJECT_ID('dbo.supplier_payments'))
BEGIN
  CREATE INDEX IX_sp_supplier_date ON dbo.supplier_payments(supplier_id, payment_date);
  PRINT 'Created IX_sp_supplier_date';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pa_payment' AND object_id=OBJECT_ID('dbo.payment_allocations'))
BEGIN
  CREATE INDEX IX_pa_payment ON dbo.payment_allocations(payment_id);
  PRINT 'Created IX_pa_payment';
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_pa_header' AND object_id=OBJECT_ID('dbo.payment_allocations'))
BEGIN
  CREATE INDEX IX_pa_header ON dbo.payment_allocations(header_id);
  PRINT 'Created IX_pa_header';
END;
GO
