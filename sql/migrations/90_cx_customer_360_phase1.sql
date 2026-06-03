/*
  90_cx_customer_360_phase1.sql
  ------------------------------
  PRD-06 Phase 1: CX Customer 360 foundation tables, loyalty_settings seed,
  lifestyle backfill from pos_customers.lifestyle_prefs, feature flag (engine off).

  Run: npm run migrate:90-cx-customer-360-phase1
  Balance migration from pos_points_ledger: npm run migrate:90-cx-loyalty-opening-balance
*/
PRINT N'--- 90_cx_customer_360_phase1.sql ---';

USE [CosmosERP];
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

/* ── customer_lifestyle (one row per customer) ── */
IF OBJECT_ID(N'dbo.customer_lifestyle', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_lifestyle (
    customer_id       INT            NOT NULL PRIMARY KEY,
    screen_hrs        NVARCHAR(50)   NULL,
    frame_pref        NVARCHAR(100)  NULL,
    budget_min        INT            NULL,
    budget_max        INT            NULL,
    notes             NVARCHAR(500)  NULL,
    updated_at        DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_by_user_id INT           NULL,
    CONSTRAINT FK_cl_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_cl_updated_by FOREIGN KEY (updated_by_user_id)
      REFERENCES dbo.users(user_id)
  );
  PRINT N'customer_lifestyle created.';
END
ELSE
  PRINT N'customer_lifestyle already exists — skipped.';
GO

/* ── loyalty_settings (singleton row settings_id = 1) ── */
IF OBJECT_ID(N'dbo.loyalty_settings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.loyalty_settings (
    settings_id                 INT            NOT NULL PRIMARY KEY,
    earn_percent                DECIMAL(5,2)   NOT NULL DEFAULT 5.00,
    credit_delay_days           INT            NOT NULL DEFAULT 7,
    redemption_coins_per_rupee  INT            NOT NULL DEFAULT 10,
    max_redeem_percent_of_bill  DECIMAL(5,2)   NULL,
    updated_at                  DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_by_user_id          INT            NULL,
    CONSTRAINT CK_loyalty_settings_singleton CHECK (settings_id = 1),
    CONSTRAINT FK_ls_updated_by FOREIGN KEY (updated_by_user_id)
      REFERENCES dbo.users(user_id),
    CONSTRAINT CK_ls_earn_percent CHECK (earn_percent >= 0 AND earn_percent <= 100),
    CONSTRAINT CK_ls_credit_delay CHECK (credit_delay_days >= 0 AND credit_delay_days <= 365),
    CONSTRAINT CK_ls_redemption_rate CHECK (redemption_coins_per_rupee >= 1)
  );
  PRINT N'loyalty_settings created.';
END
ELSE
  PRINT N'loyalty_settings already exists — skipped.';
GO

/* ── loyalty_ledger ── */
IF OBJECT_ID(N'dbo.loyalty_ledger', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.loyalty_ledger (
    ledger_id                 BIGINT         IDENTITY(1,1) PRIMARY KEY,
    customer_id               INT            NOT NULL,
    triggered_by_customer_id  INT            NULL,
    order_id                  INT            NULL,
    invoice_id                INT            NULL,
    entry_type                NVARCHAR(20)   NOT NULL,
    status                    NVARCHAR(20)   NOT NULL,
    coins_delta               INT            NOT NULL,
    balance_after             INT            NOT NULL,
    reason                    NVARCHAR(200)  NULL,
    available_at              DATETIME2(0)   NULL,
    created_at                DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    created_by_user_id        INT            NULL,
    CONSTRAINT FK_ll_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_ll_triggered_by FOREIGN KEY (triggered_by_customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_ll_order FOREIGN KEY (order_id)
      REFERENCES dbo.pos_orders(order_id),
    CONSTRAINT FK_ll_invoice FOREIGN KEY (invoice_id)
      REFERENCES dbo.pos_invoices(invoice_id),
    CONSTRAINT FK_ll_created_by FOREIGN KEY (created_by_user_id)
      REFERENCES dbo.users(user_id),
    CONSTRAINT CK_ll_entry_type CHECK (entry_type IN (
      N'EARN', N'REDEEM', N'MANUAL', N'ADJUST', N'MIGRATION'
    )),
    CONSTRAINT CK_ll_status CHECK (status IN (N'PENDING', N'LIVE', N'CANCELLED'))
  );
  CREATE INDEX IX_ll_customer_status ON dbo.loyalty_ledger(customer_id, status, ledger_id DESC);
  CREATE INDEX IX_ll_status_available ON dbo.loyalty_ledger(status, available_at);
  PRINT N'loyalty_ledger created.';
END
ELSE
  PRINT N'loyalty_ledger already exists — skipped.';
GO

/* ── customer_offer_assignments ── */
IF OBJECT_ID(N'dbo.customer_offer_assignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.customer_offer_assignments (
    assignment_id         INT IDENTITY(1,1) PRIMARY KEY,
    customer_id           INT            NOT NULL,
    offer_id              INT            NOT NULL,
    assigned_at           DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    assigned_by_user_id   INT            NULL,
    revoked_at            DATETIME2(0)   NULL,
    revoked_by_user_id    INT            NULL,
    notes                 NVARCHAR(500)  NULL,
    CONSTRAINT FK_coa_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_coa_offer FOREIGN KEY (offer_id)
      REFERENCES dbo.customer_offers(offer_id),
    CONSTRAINT FK_coa_assigned_by FOREIGN KEY (assigned_by_user_id)
      REFERENCES dbo.users(user_id),
    CONSTRAINT FK_coa_revoked_by FOREIGN KEY (revoked_by_user_id)
      REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_coa_customer ON dbo.customer_offer_assignments(customer_id, revoked_at, offer_id);
  PRINT N'customer_offer_assignments created.';
END
ELSE
  PRINT N'customer_offer_assignments already exists — skipped.';
GO

/* ── cx_audit_log ── */
IF OBJECT_ID(N'dbo.cx_audit_log', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cx_audit_log (
    audit_id        BIGINT         IDENTITY(1,1) PRIMARY KEY,
    customer_id     INT            NULL,
    entity_type     NVARCHAR(50)   NOT NULL,
    entity_id       INT            NULL,
    action          NVARCHAR(30)   NOT NULL,
    field_name      NVARCHAR(100)  NULL,
    old_value       NVARCHAR(MAX)  NULL,
    new_value       NVARCHAR(MAX)  NULL,
    actor_user_id   INT            NULL,
    created_at      DATETIME2(0)   NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_cx_audit_customer FOREIGN KEY (customer_id)
      REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_cx_audit_actor FOREIGN KEY (actor_user_id)
      REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_cx_audit_customer ON dbo.cx_audit_log(customer_id, created_at DESC);
  PRINT N'cx_audit_log created.';
END
ELSE
  PRINT N'cx_audit_log already exists — skipped.';
GO

/* ── Seed loyalty_settings (mirror legacy app_settings when present) ── */
DECLARE @now2 DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
DECLARE @redemption INT = 10;
DECLARE @delayDays INT = 7;

IF OBJECT_ID(N'dbo.app_settings', N'U') IS NOT NULL
BEGIN
  SELECT @redemption = TRY_CAST(setting_value AS INT)
  FROM dbo.app_settings WHERE setting_key = N'coin_redemption_rate';
  IF @redemption IS NULL OR @redemption < 1 SET @redemption = 10;

  SELECT @delayDays = TRY_CAST(setting_value AS INT)
  FROM dbo.app_settings WHERE setting_key = N'pos_points_maturity_days';
  IF @delayDays IS NULL OR @delayDays < 0 SET @delayDays = 7;
END

IF NOT EXISTS (SELECT 1 FROM dbo.loyalty_settings WHERE settings_id = 1)
BEGIN
  INSERT INTO dbo.loyalty_settings (
    settings_id, earn_percent, credit_delay_days, redemption_coins_per_rupee,
    max_redeem_percent_of_bill, updated_at
  )
  VALUES (1, 5.00, @delayDays, @redemption, 50.00, @now2);
  PRINT N'Seeded loyalty_settings row 1.';
END
ELSE
  PRINT N'loyalty_settings row 1 already exists — skipped insert.';
GO

/* ── Feature flag: loyalty engine v2 (off until Phase 4 cutover) ── */
IF OBJECT_ID(N'dbo.app_settings', N'U') IS NOT NULL
BEGIN
  MERGE dbo.app_settings AS tgt
  USING (
    SELECT
      N'loyalty_engine_v2' AS setting_key,
      N'0' AS setting_value,
      N'loyalty' AS setting_group,
      N'1 = loyalty_ledger engine; 0 = legacy pos_points_ledger' AS description
  ) AS src
  ON tgt.setting_key = src.setting_key
  WHEN NOT MATCHED BY TARGET THEN
    INSERT (setting_key, setting_value, setting_group, description)
    VALUES (src.setting_key, src.setting_value, src.setting_group, src.description);
  PRINT N'Seeded loyalty_engine_v2=0.';
END
GO

/* ── Backfill customer_lifestyle from lifestyle_prefs JSON ── */
IF OBJECT_ID(N'dbo.customer_lifestyle', N'U') IS NOT NULL
  AND COL_LENGTH(N'dbo.pos_customers', N'lifestyle_prefs') IS NOT NULL
BEGIN
  INSERT INTO dbo.customer_lifestyle (
    customer_id, screen_hrs, frame_pref, budget_min, budget_max, updated_at
  )
  SELECT
    c.customer_id,
    NULLIF(LTRIM(RTRIM(JSON_VALUE(c.lifestyle_prefs, '$.screen_hrs'))), N''),
    NULLIF(LTRIM(RTRIM(JSON_VALUE(c.lifestyle_prefs, '$.frame_pref'))), N''),
    TRY_CAST(JSON_VALUE(c.lifestyle_prefs, '$.budget_min') AS INT),
    TRY_CAST(JSON_VALUE(c.lifestyle_prefs, '$.budget_max') AS INT),
    DATEADD(MINUTE, 330, SYSUTCDATETIME())
  FROM dbo.pos_customers c
  WHERE c.lifestyle_prefs IS NOT NULL
    AND LEN(LTRIM(RTRIM(c.lifestyle_prefs))) > 2
    AND ISJSON(c.lifestyle_prefs) = 1
    AND NOT EXISTS (
      SELECT 1 FROM dbo.customer_lifestyle cl WHERE cl.customer_id = c.customer_id
    );
  PRINT N'Backfilled customer_lifestyle from lifestyle_prefs: ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + N' rows.';
END
GO

PRINT N'--- 90_cx_customer_360_phase1.sql complete ---';
GO
