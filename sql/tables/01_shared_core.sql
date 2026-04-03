PRINT 'Creating shared core tables...';
GO

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    user_id      INT IDENTITY(1,1) PRIMARY KEY,
    username     VARCHAR(100) NOT NULL,
    password     VARCHAR(200) NOT NULL,
    full_name    VARCHAR(200) NOT NULL,
    email        VARCHAR(200) NULL,
    phone        VARCHAR(20) NULL,
    role_key     VARCHAR(50) NOT NULL,
    store_id     INT NULL,
    is_active    BIT NOT NULL DEFAULT 1,
    last_login   DATETIME NULL,
    created_at   DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at   DATETIME NOT NULL DEFAULT GETDATE()
  );
END;
GO

IF OBJECT_ID('dbo.roles', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.roles (
    role_key      VARCHAR(50) NOT NULL PRIMARY KEY,
    display_name  VARCHAR(200) NOT NULL,
    hierarchy_lvl INT NOT NULL,
    is_global     BIT NOT NULL DEFAULT 0,
    created_at    DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at    DATETIME NOT NULL DEFAULT GETDATE()
  );
END;
GO

IF OBJECT_ID('dbo.role_permissions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.role_permissions (
    id           INT IDENTITY(1,1) PRIMARY KEY,
    role_key     VARCHAR(50) NOT NULL,
    permission   VARCHAR(200) NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_role_permissions_role
      FOREIGN KEY (role_key) REFERENCES dbo.roles(role_key)
  );
END;
GO

IF OBJECT_ID('dbo.stores', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.stores (
    store_id      INT IDENTITY(1,1) PRIMARY KEY,
    store_name    VARCHAR(200) NOT NULL,
    store_code    VARCHAR(20) NOT NULL UNIQUE,
    store_type    VARCHAR(50) NOT NULL,
    gstin         VARCHAR(20) NULL,
    address       VARCHAR(500) NULL,
    city          VARCHAR(100) NULL,
    state         VARCHAR(100) NULL,
    pincode       VARCHAR(10) NULL,
    phone         VARCHAR(20) NULL,
    gps_lat       VARCHAR(20) NULL,
    gps_lng       VARCHAR(20) NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    is_active     BIT NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at    DATETIME NOT NULL DEFAULT GETDATE()
  );
END;
GO

IF OBJECT_ID('dbo.store_module_access', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_module_access (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    store_id    INT NOT NULL,
    module_key  VARCHAR(50) NOT NULL,
    is_enabled  BIT NOT NULL DEFAULT 1,
    created_at  DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at  DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_store_module_access_store
      FOREIGN KEY (store_id) REFERENCES dbo.stores(store_id)
  );
END;
GO

IF OBJECT_ID('dbo.app_settings', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.app_settings (
    setting_id    INT IDENTITY(1,1) PRIMARY KEY,
    setting_key   VARCHAR(100) NOT NULL UNIQUE,
    setting_value VARCHAR(500) NOT NULL,
    setting_group VARCHAR(100) NULL,
    description   VARCHAR(500) NULL,
    updated_by    INT NULL,
    updated_at    DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_app_settings_updated_by
      FOREIGN KEY (updated_by) REFERENCES dbo.users(user_id)
  );
END;
GO

IF OBJECT_ID('dbo.token_blacklist', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.token_blacklist (
    blacklist_id INT IDENTITY(1,1) PRIMARY KEY,
    token_hash   VARCHAR(200) NOT NULL,
    user_id      INT NOT NULL,
    expires_at   DATETIME NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_token_blacklist_user
      FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
  );
END;
GO

IF OBJECT_ID('dbo.audit_logs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.audit_logs (
    audit_id    INT IDENTITY(1,1) PRIMARY KEY,
    user_id     INT NULL,
    action      VARCHAR(100) NOT NULL,
    module      VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id   INT NULL,
    old_value   VARCHAR(500) NULL,
    new_value   VARCHAR(500) NULL,
    ip_address  VARCHAR(50) NULL,
    created_at  DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_audit_logs_user
      FOREIGN KEY (user_id) REFERENCES dbo.users(user_id)
  );
END;
GO

