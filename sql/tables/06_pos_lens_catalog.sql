PRINT 'Creating POS lens catalog tables...';

USE [CosmosERP];
GO

IF OBJECT_ID('dbo.pos_lens_categories', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_lens_categories (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(100) NOT NULL,
    sort_order INT             NOT NULL DEFAULT 0,
    is_active  BIT             NOT NULL DEFAULT 1
  );
END;
GO

IF OBJECT_ID('dbo.pos_lens_packages', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_lens_packages (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    category_id INT            NOT NULL,
    name        NVARCHAR(100) NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    sort_order  INT            NOT NULL DEFAULT 0,
    is_active   BIT            NOT NULL DEFAULT 1,
    CONSTRAINT FK_pos_lens_pkg_cat FOREIGN KEY (category_id) REFERENCES dbo.pos_lens_categories(id)
  );
END;
GO

IF OBJECT_ID('dbo.pos_lens_addons', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_lens_addons (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(100) NOT NULL,
    price      DECIMAL(10,2) NOT NULL,
    sort_order INT             NOT NULL DEFAULT 0,
    is_active  BIT             NOT NULL DEFAULT 1
  );
END;
GO

IF OBJECT_ID('dbo.pos_lens_pkg_addons', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.pos_lens_pkg_addons (
    package_id INT NOT NULL,
    addon_id   INT NOT NULL,
    CONSTRAINT PK_pos_lens_pkg_addons PRIMARY KEY (package_id, addon_id),
    CONSTRAINT FK_pos_lens_pkg_addons_pkg FOREIGN KEY (package_id) REFERENCES dbo.pos_lens_packages(id),
    CONSTRAINT FK_pos_lens_pkg_addons_addon FOREIGN KEY (addon_id) REFERENCES dbo.pos_lens_addons(id)
  );
END;
GO

-- Catalogue rows (categories, packages, add-ons) are created only via Foundry admin APIs.
-- One-time removal of legacy demo seeds: sql/maintenance/remove_lens_catalog_demo_seed.sql
