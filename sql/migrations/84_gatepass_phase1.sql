/*
  GatePass Phase 1 — store_visitors, audit log, hybrid VMS config, core SPs.
  Deploy against CosmosERP, then staff re-login for gatepass.* permissions.
*/
USE [CosmosERP];
GO

DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

-- ─── Global VMS defaults ─────────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'vms.visitor_expiry_minutes')
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (N'vms.visitor_expiry_minutes', N'240', N'gatepass', N'Minutes before auto-expiry (global default)');

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'vms.self_checkin_enabled')
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (N'vms.self_checkin_enabled', N'1', N'gatepass', N'Self check-in QR enabled (global default)');

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'vms.max_active_visitors')
  INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
  VALUES (N'vms.max_active_visitors', N'50', N'gatepass', N'Max active visitors per store (global default)');
GO

-- ─── Per-store overrides ─────────────────────────────────────────────────────
IF OBJECT_ID('dbo.store_app_settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_app_settings (
    store_id       INT           NOT NULL,
    setting_key    VARCHAR(100)  NOT NULL,
    setting_value  NVARCHAR(500) NOT NULL,
    updated_at     DATETIME2(0)  NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT PK_store_app_settings PRIMARY KEY (store_id, setting_key),
    CONSTRAINT FK_store_app_settings_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id)
  );
END;
GO

-- ─── store_visitors ──────────────────────────────────────────────────────────
IF OBJECT_ID('dbo.store_visitors', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_visitors (
    visitor_id          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name                NVARCHAR(100)     NOT NULL,
    phone               VARCHAR(15)       NOT NULL,
    customer_id         INT               NULL,
    store_id            INT               NOT NULL,
    purpose             VARCHAR(50)       NULL,
    checkin_at          DATETIME2(0)      NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    checkin_channel     VARCHAR(20)       NOT NULL,
    checkin_by_user_id  INT               NULL,
    assigned_user_id    INT               NULL,
    status              VARCHAR(20)       NOT NULL DEFAULT ('waiting'),
    status_changed_at   DATETIME2(0)      NULL,
    checkout_at         DATETIME2(0)      NULL,
    expiry_at           DATETIME2(0)      NOT NULL,
    notes               NVARCHAR(500)     NULL,
    created_at          DATETIME2(0)      NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    updated_at          DATETIME2(0)      NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    CONSTRAINT FK_store_visitors_customer FOREIGN KEY (customer_id) REFERENCES dbo.pos_customers(customer_id),
    CONSTRAINT FK_store_visitors_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id),
    CONSTRAINT FK_store_visitors_checkin_user FOREIGN KEY (checkin_by_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_store_visitors_assigned_user FOREIGN KEY (assigned_user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT CK_store_visitors_status CHECK (status IN ('waiting','in_service','completed','no_show','expired')),
    CONSTRAINT CK_store_visitors_channel CHECK (checkin_channel IN ('staff_desktop','staff_tablet','self_qr'))
  );
  CREATE INDEX IX_store_visitors_store_status ON dbo.store_visitors(store_id, status, checkin_at);
  CREATE INDEX IX_store_visitors_store_phone ON dbo.store_visitors(store_id, phone);
END;
GO

-- ─── visitor_audit_log ───────────────────────────────────────────────────────
IF OBJECT_ID('dbo.visitor_audit_log', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.visitor_audit_log (
    log_id        BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    visitor_id    INT                  NOT NULL,
    action        VARCHAR(50)          NOT NULL,
    old_value     NVARCHAR(200)        NULL,
    new_value     NVARCHAR(200)        NULL,
    performed_by  INT                  NULL,
    performed_at  DATETIME2(0)         NOT NULL DEFAULT (DATEADD(MINUTE, 330, SYSUTCDATETIME())),
    ip_address    VARCHAR(45)          NULL,
    CONSTRAINT FK_visitor_audit_visitor FOREIGN KEY (visitor_id) REFERENCES dbo.store_visitors(visitor_id),
    CONSTRAINT FK_visitor_audit_user FOREIGN KEY (performed_by) REFERENCES dbo.users(user_id)
  );
  CREATE INDEX IX_visitor_audit_visitor ON dbo.visitor_audit_log(visitor_id, performed_at DESC);
END;
GO

-- ─── Resolve int setting (store override → global) ───────────────────────────
CREATE OR ALTER FUNCTION dbo.fn_gatepass_setting_int(
  @store_id     INT,
  @setting_key  VARCHAR(100),
  @default_val  INT
)
RETURNS INT
AS
BEGIN
  DECLARE @raw NVARCHAR(500);
  SELECT @raw = sas.setting_value
  FROM dbo.store_app_settings sas
  WHERE sas.store_id = @store_id AND sas.setting_key = @setting_key;

  IF @raw IS NULL
    SELECT @raw = a.setting_value FROM dbo.app_settings a WHERE a.setting_key = @setting_key;

  IF @raw IS NULL OR LTRIM(RTRIM(@raw)) = N''
    RETURN @default_val;

  DECLARE @n INT = TRY_CAST(LTRIM(RTRIM(@raw)) AS INT);
  IF @n IS NULL OR @n < 1
    RETURN @default_val;
  RETURN @n;
END;
GO

-- ─── sp_gatepass_checkin ─────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_checkin
  @name                 NVARCHAR(100),
  @phone                VARCHAR(15),
  @store_id             INT,
  @channel              VARCHAR(20),
  @checkin_by_user_id   INT = NULL,
  @purpose              VARCHAR(50) = NULL,
  @notes                NVARCHAR(500) = NULL,
  @ip_address           VARCHAR(45) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @today DATE = CAST(@now AS DATE);
  DECLARE @max_active INT = dbo.fn_gatepass_setting_int(@store_id, 'vms.max_active_visitors', 50);
  DECLARE @expiry_min INT = dbo.fn_gatepass_setting_int(@store_id, 'vms.visitor_expiry_minutes', 240);
  DECLARE @active_count INT;
  DECLARE @visitor_id INT;
  DECLARE @already BIT = 0;

  SELECT @active_count = COUNT(*)
  FROM dbo.store_visitors sv
  WHERE sv.store_id = @store_id AND sv.status IN ('waiting', 'in_service');

  IF @active_count >= @max_active
  BEGIN
    RAISERROR('Maximum active visitors reached for this store.', 16, 1);
    RETURN;
  END;

  SELECT TOP 1 @visitor_id = sv.visitor_id, @already = 1
  FROM dbo.store_visitors sv WITH (UPDLOCK, ROWLOCK)
  WHERE sv.store_id = @store_id
    AND sv.phone = @phone
    AND sv.status IN ('waiting', 'in_service')
  ORDER BY sv.checkin_at DESC;

  IF @visitor_id IS NOT NULL
  BEGIN
    SELECT
      sv.visitor_id, sv.name, sv.phone, sv.customer_id,
      CAST(CASE WHEN sv.customer_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
      sv.store_id, sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at,
      sv.checkin_channel, sv.notes,
      DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes,
      @already AS already_checked_in
    FROM dbo.store_visitors sv
    WHERE sv.visitor_id = @visitor_id;
    RETURN;
  END;

  SELECT TOP 1 @visitor_id = sv.visitor_id
  FROM dbo.store_visitors sv WITH (UPDLOCK, ROWLOCK)
  WHERE sv.store_id = @store_id
    AND sv.phone = @phone
    AND sv.status IN ('completed', 'no_show', 'expired')
    AND CAST(sv.checkin_at AS DATE) = @today
  ORDER BY sv.checkin_at DESC;

  BEGIN TRY
    BEGIN TRAN;

    IF @visitor_id IS NOT NULL
    BEGIN
      UPDATE dbo.store_visitors
      SET name = @name,
          purpose = @purpose,
          notes = COALESCE(@notes, notes),
          status = 'waiting',
          status_changed_at = @now,
          checkin_at = @now,
          checkout_at = NULL,
          expiry_at = DATEADD(MINUTE, @expiry_min, @now),
          checkin_channel = @channel,
          checkin_by_user_id = @checkin_by_user_id,
          updated_at = @now
      WHERE visitor_id = @visitor_id;

      INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
      VALUES (@visitor_id, 'checked_in', N'reopened', N'waiting', @checkin_by_user_id, @ip_address);
    END
    ELSE
    BEGIN
      INSERT INTO dbo.store_visitors (
        name, phone, store_id, purpose, checkin_at, checkin_channel, checkin_by_user_id,
        status, status_changed_at, expiry_at, notes, created_at, updated_at
      )
      VALUES (
        @name, @phone, @store_id, @purpose, @now, @channel, @checkin_by_user_id,
        'waiting', @now, DATEADD(MINUTE, @expiry_min, @now), @notes, @now, @now
      );
      SET @visitor_id = SCOPE_IDENTITY();

      INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
      VALUES (@visitor_id, 'checked_in', NULL, N'waiting', @checkin_by_user_id, @ip_address);
    END;

    COMMIT TRAN;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
  END CATCH;

  SELECT
    sv.visitor_id, sv.name, sv.phone, sv.customer_id,
    CAST(CASE WHEN sv.customer_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.store_id, sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at,
    sv.checkin_channel, sv.notes,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes,
    @already AS already_checked_in
  FROM dbo.store_visitors sv
  WHERE sv.visitor_id = @visitor_id;
END;
GO

-- ─── sp_gatepass_search ──────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_search
  @phone_fragment VARCHAR(15),
  @store_id       INT
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @frag VARCHAR(15) = ISNULL(@phone_fragment, '');
  DECLARE @max_active INT = dbo.fn_gatepass_setting_int(@store_id, 'vms.max_active_visitors', 50);

  SELECT TOP (@max_active)
    sv.visitor_id, sv.name, sv.phone, sv.customer_id,
    CAST(CASE WHEN sv.customer_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.purpose, sv.status, sv.checkin_at, sv.checkout_at,
    u.full_name AS assigned_staff_name,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes
  FROM dbo.store_visitors sv
  LEFT JOIN dbo.users u ON u.user_id = sv.assigned_user_id
  WHERE sv.store_id = @store_id
    AND sv.status IN ('waiting', 'in_service')
    AND (@frag = '' OR sv.phone LIKE '%' + @frag + '%')
  ORDER BY sv.checkin_at ASC;

  SELECT TOP 5
    sv.visitor_id, sv.name, sv.phone, sv.customer_id,
    CAST(CASE WHEN sv.customer_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.purpose, sv.status, sv.checkin_at, sv.checkout_at,
    u.full_name AS assigned_staff_name,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes
  FROM dbo.store_visitors sv
  LEFT JOIN dbo.users u ON u.user_id = sv.assigned_user_id
  WHERE sv.store_id = @store_id
    AND sv.status = 'completed'
    AND sv.checkout_at IS NOT NULL
    AND sv.checkout_at >= DATEADD(HOUR, -24, @now)
    AND (@frag = '' OR sv.phone LIKE '%' + @frag + '%')
  ORDER BY sv.checkout_at DESC;
END;
GO

-- ─── sp_gatepass_queue ───────────────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_queue
  @store_id       INT,
  @status_filter  VARCHAR(50) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

  SELECT
    sv.visitor_id, sv.name, sv.phone, sv.customer_id,
    CAST(CASE WHEN sv.customer_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at, sv.notes,
    u.full_name AS assigned_staff_name,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes
  FROM dbo.store_visitors sv
  LEFT JOIN dbo.users u ON u.user_id = sv.assigned_user_id
  WHERE sv.store_id = @store_id
    AND (
      @status_filter IS NULL OR LTRIM(RTRIM(@status_filter)) = ''
      OR sv.status = LTRIM(RTRIM(@status_filter))
    )
    AND sv.status IN ('waiting', 'in_service')
  ORDER BY sv.checkin_at ASC;
END;
GO

-- ─── sp_gatepass_update_status ───────────────────────────────────────────────
CREATE OR ALTER PROCEDURE dbo.sp_gatepass_update_status
  @visitor_id     INT,
  @new_status     VARCHAR(20),
  @store_id       INT = NULL,
  @performed_by   INT = NULL,
  @ip_address     VARCHAR(45) = NULL,
  @allow_system   BIT = 0
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;

  DECLARE @now DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());
  DECLARE @old_status VARCHAR(20);
  DECLARE @visitor_store INT;

  SELECT @old_status = sv.status, @visitor_store = sv.store_id
  FROM dbo.store_visitors sv WITH (UPDLOCK, ROWLOCK)
  WHERE sv.visitor_id = @visitor_id;

  IF @old_status IS NULL
  BEGIN
    RAISERROR('Visitor not found.', 16, 1);
    RETURN;
  END;

  IF @store_id IS NOT NULL AND @visitor_store <> @store_id
  BEGIN
    RAISERROR('Visitor not found for this store.', 16, 1);
    RETURN;
  END;

  IF @new_status = 'expired' AND @allow_system = 0
  BEGIN
    RAISERROR('Expired status is system-only.', 16, 1);
    RETURN;
  END;

  IF NOT (
    (@old_status = 'waiting' AND @new_status IN ('in_service', 'no_show', 'expired'))
    OR (@old_status = 'in_service' AND @new_status IN ('completed', 'no_show', 'expired'))
  )
  BEGIN
    RAISERROR('Invalid status transition.', 16, 1);
    RETURN;
  END;

  BEGIN TRY
    BEGIN TRAN;

    UPDATE dbo.store_visitors
    SET status = @new_status,
        status_changed_at = @now,
        checkout_at = CASE WHEN @new_status IN ('completed', 'no_show') THEN @now ELSE checkout_at END,
        updated_at = @now
    WHERE visitor_id = @visitor_id;

    INSERT INTO dbo.visitor_audit_log (visitor_id, action, old_value, new_value, performed_by, ip_address)
    VALUES (@visitor_id, 'status_changed', @old_status, @new_status, @performed_by, @ip_address);

    COMMIT TRAN;
  END TRY
  BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
  END CATCH;

  SELECT
    sv.visitor_id, sv.name, sv.phone, sv.customer_id,
    CAST(CASE WHEN sv.customer_id IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS has_customer,
    sv.store_id, sv.purpose, sv.status, sv.checkin_at, sv.checkout_at, sv.expiry_at,
    DATEDIFF(MINUTE, sv.checkin_at, @now) AS wait_minutes
  FROM dbo.store_visitors sv
  WHERE sv.visitor_id = @visitor_id;
END;
GO

-- ─── Seed gatepass.* for POS-capable roles ───────────────────────────────────
DECLARE @seedNow DATETIME2(0) = DATEADD(MINUTE, 330, SYSUTCDATETIME());

INSERT INTO dbo.role_permissions (role_key, permission, created_at)
SELECT DISTINCT rp.role_key, v.perm, @seedNow
FROM dbo.role_permissions rp
CROSS JOIN (VALUES
  (N'gatepass.view'),
  (N'gatepass.checkin'),
  (N'gatepass.action')
) AS v(perm)
WHERE LOWER(LTRIM(RTRIM(rp.permission))) IN (
  N'pos.customers.view',
  N'pos.orders.create',
  N'pos.catalogue.view'
)
AND NOT EXISTS (
  SELECT 1 FROM dbo.role_permissions x
  WHERE x.role_key = rp.role_key
    AND LOWER(LTRIM(RTRIM(x.permission))) = LOWER(LTRIM(RTRIM(v.perm)))
);
GO

PRINT 'GatePass Phase 1 migration complete.';
GO
