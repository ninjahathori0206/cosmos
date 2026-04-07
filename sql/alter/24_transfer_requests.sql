-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 24: Transfer Request lifecycle tables
-- Implements PRD §8.3 store-to-HQ stock request workflow.
--   transfer_requests       — request header with status lifecycle
--   transfer_request_lines  — per-SKU line items with qty tracking
-- ═══════════════════════════════════════════════════════════════════════════════

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'transfer_requests' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.transfer_requests (
    request_id     INT IDENTITY(1,1) NOT NULL,
    store_id       INT               NOT NULL,
    requested_by   INT               NOT NULL,
    -- SUBMITTED → APPROVED | REJECTED → (if APPROVED) DISPATCHED → RECEIVED
    status         VARCHAR(20)       NOT NULL DEFAULT 'SUBMITTED',
    notes          NVARCHAR(500)     NULL,
    -- review fields (APPROVED or REJECTED)
    reviewed_by    INT               NULL,
    reviewed_at    DATETIME          NULL,
    review_notes   NVARCHAR(500)     NULL,
    -- dispatch fields
    dispatched_by  INT               NULL,
    dispatched_at  DATETIME          NULL,
    -- receipt fields
    received_by    INT               NULL,
    received_at    DATETIME          NULL,
    created_at     DATETIME          NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_at     DATETIME          NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),

    CONSTRAINT PK_transfer_requests   PRIMARY KEY (request_id),
    CONSTRAINT FK_TR_store            FOREIGN KEY (store_id)     REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_TR_requested_by     FOREIGN KEY (requested_by) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_TR_reviewed_by      FOREIGN KEY (reviewed_by)  REFERENCES dbo.users(user_id),
    CONSTRAINT FK_TR_dispatched_by    FOREIGN KEY (dispatched_by)REFERENCES dbo.users(user_id),
    CONSTRAINT FK_TR_received_by      FOREIGN KEY (received_by)  REFERENCES dbo.users(user_id),
    CONSTRAINT CHK_TR_status          CHECK (status IN ('SUBMITTED','APPROVED','DISPATCHED','RECEIVED','REJECTED'))
  );
  PRINT 'Created table dbo.transfer_requests';
END
ELSE
  PRINT 'Table dbo.transfer_requests already exists — skipped.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'transfer_request_lines' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.transfer_request_lines (
    line_id        INT IDENTITY(1,1) NOT NULL,
    request_id     INT               NOT NULL,
    sku_id         INT               NOT NULL,
    requested_qty  INT               NOT NULL,
    approved_qty   INT               NULL,
    dispatched_qty INT               NULL,
    received_qty   INT               NULL,

    CONSTRAINT PK_transfer_request_lines PRIMARY KEY (line_id),
    CONSTRAINT FK_TRL_request FOREIGN KEY (request_id) REFERENCES dbo.transfer_requests(request_id) ON DELETE CASCADE,
    CONSTRAINT FK_TRL_sku     FOREIGN KEY (sku_id)     REFERENCES dbo.skus(sku_id),
    CONSTRAINT CHK_TRL_req_qty CHECK (requested_qty > 0)
  );
  PRINT 'Created table dbo.transfer_request_lines';
END
ELSE
  PRINT 'Table dbo.transfer_request_lines already exists — skipped.';
GO
