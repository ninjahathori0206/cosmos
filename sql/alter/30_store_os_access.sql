/*
  Store OS access: tablets, order sessions, PIN attempt log, system_config, role flags.
  Army owns users.store_id — no user_store table.

  Run against CosmosERP. Deploy SPs from sql/sp/pos.sql after.
*/
USE [CosmosERP];
GO

IF COL_LENGTH('dbo.roles', 'can_initiate_refund') IS NULL
  ALTER TABLE dbo.roles ADD can_initiate_refund BIT NOT NULL CONSTRAINT DF_roles_can_initiate_refund DEFAULT 0;
GO
IF COL_LENGTH('dbo.roles', 'can_view_reports') IS NULL
  ALTER TABLE dbo.roles ADD can_view_reports BIT NOT NULL CONSTRAINT DF_roles_can_view_reports DEFAULT 0;
GO
IF COL_LENGTH('dbo.roles', 'can_manage_staff') IS NULL
  ALTER TABLE dbo.roles ADD can_manage_staff BIT NOT NULL CONSTRAINT DF_roles_can_manage_staff DEFAULT 0;
GO

IF OBJECT_ID('dbo.tablets', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.tablets (
    tablet_id     INT IDENTITY(1,1) PRIMARY KEY,
    store_id      INT NOT NULL,
    device_name   VARCHAR(100) NOT NULL,
    pin_hash      VARCHAR(200) NOT NULL,
    is_active     BIT NOT NULL CONSTRAINT DF_tablets_is_active DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at    DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_at    DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_tablets_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_order_sessions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_order_sessions (
    session_id          INT IDENTITY(1,1) PRIMARY KEY,
    tablet_id           INT NOT NULL,
    user_id             INT NOT NULL,
    store_id            INT NOT NULL,
    role_key_snapshot   VARCHAR(50) NOT NULL,
    can_refund_snapshot BIT NOT NULL CONSTRAINT DF_pos_sess_can_refund DEFAULT 0,
    status              VARCHAR(20) NOT NULL CONSTRAINT DF_pos_sess_status DEFAULT 'ACTIVE',
    started_at          DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    completed_at        DATETIME NULL,
    cancelled_at        DATETIME NULL,
    cancel_reason       VARCHAR(200) NULL,
    CONSTRAINT FK_pos_session_tablet FOREIGN KEY (tablet_id) REFERENCES dbo.tablets(tablet_id),
    CONSTRAINT FK_pos_session_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_pos_session_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_pin_attempts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_pin_attempts (
    attempt_id   INT IDENTITY(1,1) PRIMARY KEY,
    user_id      INT NULL,
    tablet_id    INT NULL,
    store_id     INT NOT NULL,
    success      BIT NOT NULL,
    attempted_at DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    CONSTRAINT FK_pin_attempt_user FOREIGN KEY (user_id) REFERENCES dbo.users(user_id),
    CONSTRAINT FK_pin_attempt_tablet FOREIGN KEY (tablet_id) REFERENCES dbo.tablets(tablet_id),
    CONSTRAINT FK_pin_attempt_store FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id)
  );
END;
GO

IF OBJECT_ID('dbo.system_config', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.system_config (
    config_key   VARCHAR(100) NOT NULL PRIMARY KEY,
    config_value VARCHAR(500) NOT NULL,
    description  VARCHAR(500) NULL,
    updated_at   DATETIME NOT NULL DEFAULT DATEADD(MINUTE, 330, SYSUTCDATETIME()),
    updated_by   INT NULL,
    CONSTRAINT FK_system_config_updated_by FOREIGN KEY (updated_by) REFERENCES dbo.users(user_id)
  );
END;
GO

IF NOT EXISTS (SELECT 1 FROM dbo.system_config WHERE config_key = N'pos_max_pin_attempts')
  INSERT INTO dbo.system_config (config_key, config_value, description)
  VALUES (
    N'pos_max_pin_attempts',
    N'3',
    N'Failed staff PIN attempts for same user+store within 10 minutes before lockout alert'
  );
GO

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = N'store_incharge')
  INSERT INTO dbo.roles
    (role_key, display_name, hierarchy_lvl, is_global, can_initiate_refund, can_view_reports, can_manage_staff)
  VALUES
    (N'store_incharge', N'Store In-charge', 20, 0, 1, 1, 1);
ELSE
  UPDATE dbo.roles
  SET can_initiate_refund = 1,
      can_view_reports    = 1,
      can_manage_staff    = 1,
      updated_at          = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE role_key = N'store_incharge';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = N'sales_executive')
  INSERT INTO dbo.roles
    (role_key, display_name, hierarchy_lvl, is_global, can_initiate_refund, can_view_reports, can_manage_staff)
  VALUES
    (N'sales_executive', N'Sales Executive', 10, 0, 0, 0, 0);
ELSE
  UPDATE dbo.roles
  SET can_initiate_refund = 0,
      can_view_reports    = 0,
      can_manage_staff    = 0,
      updated_at          = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE role_key = N'sales_executive';
GO
