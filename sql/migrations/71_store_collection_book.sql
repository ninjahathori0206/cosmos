/*
  Migration 71 — Store Collection Book (treasury ledgers)

  Deploy: npm run migrate:71-store-collection-book
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 71: store collection book tables';
GO

IF OBJECT_ID(N'dbo.store_bank_accounts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_bank_accounts (
    bank_account_id  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    store_id           INT            NOT NULL,
    bank_name          NVARCHAR(200)  NOT NULL,
    account_no         NVARCHAR(50)   NOT NULL,
    ifsc               NVARCHAR(20)   NULL,
    account_holder     NVARCHAR(200)  NULL,
    is_primary         BIT            NOT NULL DEFAULT 1,
    is_active          BIT            NOT NULL DEFAULT 1,
    created_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_store_bank_accounts_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id)
  );
  CREATE INDEX IX_store_bank_accounts_store ON dbo.store_bank_accounts(store_id, is_active);
  PRINT N'Migration 71: created store_bank_accounts';
END
ELSE
  PRINT N'Migration 71: store_bank_accounts already exists — skipped';
GO

IF OBJECT_ID(N'dbo.store_payment_machines', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_payment_machines (
    machine_id         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    store_id           INT            NOT NULL,
    provider_key       NVARCHAR(50)   NOT NULL,
    merchant_id        NVARCHAR(100)  NULL,
    terminal_label     NVARCHAR(200)  NULL,
    is_active          BIT            NOT NULL DEFAULT 1,
    created_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_store_payment_machines_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT UQ_store_payment_machines_store UNIQUE (store_id)
  );
  PRINT N'Migration 71: created store_payment_machines';
END
ELSE
  PRINT N'Migration 71: store_payment_machines already exists — skipped';
GO

IF OBJECT_ID(N'dbo.store_treasury_transfers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_treasury_transfers (
    transfer_id        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    store_id           INT            NOT NULL,
    transfer_type      NVARCHAR(30)   NOT NULL,
    period_from        DATE           NULL,
    period_to          DATE           NULL,
    gross_amount       DECIMAL(12,2)  NOT NULL,
    charges_amount     DECIMAL(12,2)  NOT NULL DEFAULT 0,
    net_amount         DECIMAL(12,2)  NOT NULL,
    from_ledger_key    NVARCHAR(30)   NOT NULL,
    to_ledger_key      NVARCHAR(30)   NOT NULL,
    bank_account_id    INT            NULL,
    bank_ref           NVARCHAR(200)  NULL,
    transfer_date      DATE           NOT NULL,
    notes              NVARCHAR(500)  NULL,
    status             NVARCHAR(20)   NOT NULL DEFAULT N'posted',
    void_reason        NVARCHAR(300)  NULL,
    voided_by          INT            NULL,
    voided_at          DATETIME2(0)   NULL,
    created_by         INT            NULL,
    created_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at         DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_store_treasury_transfers_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_store_treasury_transfers_bank FOREIGN KEY (bank_account_id) REFERENCES dbo.store_bank_accounts(bank_account_id),
    CONSTRAINT CK_store_treasury_transfers_type CHECK (transfer_type IN (N'cash_deposit', N'machine_settlement')),
    CONSTRAINT CK_store_treasury_transfers_status CHECK (status IN (N'posted', N'void'))
  );
  CREATE INDEX IX_store_treasury_transfers_store ON dbo.store_treasury_transfers(store_id, status, transfer_type);
  PRINT N'Migration 71: created store_treasury_transfers';
END
ELSE
  PRINT N'Migration 71: store_treasury_transfers already exists — skipped';
GO

PRINT N'Migration 71 complete.';
GO
