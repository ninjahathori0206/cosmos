-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 25 — stock_transfer_docs + stock_transfer_doc_lines
--
-- Introduces the Transfer Document entity that separates HQ dispatch (WAREHOUSE
-- balance decrements) from store acceptance and verification (STORE balance
-- increments).  Both Direct Transfers and Request-based Transfers produce one
-- document.
-- ═══════════════════════════════════════════════════════════════════════════════
USE [CosmosERP];
GO

IF OBJECT_ID('dbo.stock_transfer_docs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_transfer_docs (
    doc_id            INT IDENTITY(1,1) PRIMARY KEY,
    doc_type          VARCHAR(10)  NOT NULL
                      CONSTRAINT CK_std_doc_type CHECK (doc_type IN ('DIRECT','REQUEST')),
    source_request_id INT NULL
                      CONSTRAINT FK_std_request
                        REFERENCES dbo.transfer_requests(request_id),
    to_store_id       INT NOT NULL
                      CONSTRAINT FK_std_store
                        REFERENCES dbo.stores(store_id),
    status            VARCHAR(12)  NOT NULL DEFAULT 'DISPATCHED'
                      CONSTRAINT CK_std_status CHECK (status IN ('DISPATCHED','ACCEPTED','STOCKED')),
    notes             NVARCHAR(500) NULL,
    dispatched_by     INT NULL CONSTRAINT FK_std_dispatched_by REFERENCES dbo.users(user_id),
    dispatched_at     DATETIME NULL,
    accepted_by       INT NULL CONSTRAINT FK_std_accepted_by   REFERENCES dbo.users(user_id),
    accepted_at       DATETIME NULL,
    stocked_by        INT NULL CONSTRAINT FK_std_stocked_by    REFERENCES dbo.users(user_id),
    stocked_at        DATETIME NULL,
    created_at        DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME())
  );
  PRINT 'Created dbo.stock_transfer_docs';
END
ELSE
  PRINT 'dbo.stock_transfer_docs already exists — skipped';
GO

IF OBJECT_ID('dbo.stock_transfer_doc_lines', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_transfer_doc_lines (
    line_id      INT IDENTITY(1,1) PRIMARY KEY,
    doc_id       INT NOT NULL
                 CONSTRAINT FK_stdl_doc
                   REFERENCES dbo.stock_transfer_docs(doc_id) ON DELETE CASCADE,
    sku_id       INT NOT NULL
                 CONSTRAINT FK_stdl_sku
                   REFERENCES dbo.skus(sku_id),
    qty_sent     INT NOT NULL CONSTRAINT CK_stdl_qty_sent     CHECK (qty_sent > 0),
    qty_received INT NULL     CONSTRAINT CK_stdl_qty_received CHECK (qty_received >= 0)
  );
  PRINT 'Created dbo.stock_transfer_doc_lines';
END
ELSE
  PRINT 'dbo.stock_transfer_doc_lines already exists — skipped';
GO
