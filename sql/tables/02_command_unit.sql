PRINT 'Creating Command Unit tables...';

USE [CosmosERP];

IF OBJECT_ID('dbo.home_brands', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.home_brands (
    brand_id          INT IDENTITY(1,1) PRIMARY KEY,
    brand_name        VARCHAR(200) NOT NULL,
    brand_code        VARCHAR(10) NOT NULL UNIQUE,
    brand_description VARCHAR(500) NULL,
    brand_logo_url    VARCHAR(500) NULL,
    is_active         BIT NOT NULL DEFAULT 1,
    created_by        INT NULL,
    created_at        DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at        DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_home_brands_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.membership_tiers', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.membership_tiers (
    membership_id   INT IDENTITY(1,1) PRIMARY KEY,
    tier_name       VARCHAR(200) NOT NULL,
    annual_fee      DECIMAL(10,2) NOT NULL,
    benefits        VARCHAR(500) NULL,
    loyalty_tier    VARCHAR(50) NULL,
    promoter_commission DECIMAL(10,2) NULL,
    is_active       BIT NOT NULL DEFAULT 1,
    created_by      INT NULL,
    created_at      DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_membership_tiers_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.leave_types', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.leave_types (
    leave_type_id  INT IDENTITY(1,1) PRIMARY KEY,
    leave_name     VARCHAR(200) NOT NULL,
    annual_quota   INT NULL,
    max_carry_fwd  INT NULL,
    requires_approval BIT NOT NULL DEFAULT 1,
    is_paid        BIT NOT NULL DEFAULT 1,
    affects_score  BIT NOT NULL DEFAULT 1,
    is_active      BIT NOT NULL DEFAULT 1,
    created_by     INT NULL,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_leave_types_created_by
      FOREIGN KEY (created_by) REFERENCES dbo.users(user_id)
  );
END;

IF OBJECT_ID('dbo.gst_rates', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.gst_rates (
    gst_id        INT IDENTITY(1,1) PRIMARY KEY,
    hsn_sac       VARCHAR(50) NOT NULL,
    category      VARCHAR(200) NOT NULL,
    gst_rate      DECIMAL(5,2) NOT NULL,
    cgst_rate     DECIMAL(5,2) NOT NULL,
    sgst_rate     DECIMAL(5,2) NOT NULL,
    applied_to    VARCHAR(500) NULL,
    is_active     BIT NOT NULL DEFAULT 1,
    created_at    DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at    DATETIME NOT NULL DEFAULT GETDATE()
  );
END;

