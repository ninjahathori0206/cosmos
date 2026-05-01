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

DECLARE @cat_sv INT, @cat_pr INT, @cat_bf INT, @cat_ph INT;

IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_categories WHERE name = N'Single Vision')
  INSERT INTO dbo.pos_lens_categories (name, sort_order) VALUES (N'Single Vision', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_categories WHERE name = N'Progressive')
  INSERT INTO dbo.pos_lens_categories (name, sort_order) VALUES (N'Progressive', 2);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_categories WHERE name = N'Bifocal')
  INSERT INTO dbo.pos_lens_categories (name, sort_order) VALUES (N'Bifocal', 3);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_categories WHERE name = N'Photochromic')
  INSERT INTO dbo.pos_lens_categories (name, sort_order) VALUES (N'Photochromic', 4);

SELECT @cat_sv = id FROM dbo.pos_lens_categories WHERE name = N'Single Vision';
SELECT @cat_pr = id FROM dbo.pos_lens_categories WHERE name = N'Progressive';
SELECT @cat_bf = id FROM dbo.pos_lens_categories WHERE name = N'Bifocal';
SELECT @cat_ph = id FROM dbo.pos_lens_categories WHERE name = N'Photochromic';

IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE name = N'SV Standard' AND category_id = @cat_sv)
  INSERT INTO dbo.pos_lens_packages (category_id, name, price, sort_order) VALUES (@cat_sv, N'SV Standard', 799, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE name = N'SV Thin' AND category_id = @cat_sv)
  INSERT INTO dbo.pos_lens_packages (category_id, name, price, sort_order) VALUES (@cat_sv, N'SV Thin', 1299, 2);

IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE name = N'Prog Essential' AND category_id = @cat_pr)
  INSERT INTO dbo.pos_lens_packages (category_id, name, price, sort_order) VALUES (@cat_pr, N'Prog Essential', 2499, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE name = N'Prog Premium' AND category_id = @cat_pr)
  INSERT INTO dbo.pos_lens_packages (category_id, name, price, sort_order) VALUES (@cat_pr, N'Prog Premium', 3999, 2);

IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE name = N'Bifocal FT28' AND category_id = @cat_bf)
  INSERT INTO dbo.pos_lens_packages (category_id, name, price, sort_order) VALUES (@cat_bf, N'Bifocal FT28', 1899, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_packages WHERE name = N'Photo Grey' AND category_id = @cat_ph)
  INSERT INTO dbo.pos_lens_packages (category_id, name, price, sort_order) VALUES (@cat_ph, N'Photo Grey', 2199, 1);
GO

IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_addons WHERE name = N'Anti-Reflection')
  INSERT INTO dbo.pos_lens_addons (name, price, sort_order) VALUES (N'Anti-Reflection', 399, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_addons WHERE name = N'Blue Cut')
  INSERT INTO dbo.pos_lens_addons (name, price, sort_order) VALUES (N'Blue Cut', 499, 2);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_addons WHERE name = N'UV400')
  INSERT INTO dbo.pos_lens_addons (name, price, sort_order) VALUES (N'UV400', 199, 3);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_addons WHERE name = N'Scratch Resistant')
  INSERT INTO dbo.pos_lens_addons (name, price, sort_order) VALUES (N'Scratch Resistant', 249, 4);
IF NOT EXISTS (SELECT 1 FROM dbo.pos_lens_addons WHERE name = N'Photochromic coating')
  INSERT INTO dbo.pos_lens_addons (name, price, sort_order) VALUES (N'Photochromic coating', 599, 5);
GO

DECLARE @p1 INT, @p2 INT, @p3 INT, @p4 INT, @p5 INT;
SELECT @p1 = id FROM dbo.pos_lens_packages WHERE name = N'SV Standard';
SELECT @p2 = id FROM dbo.pos_lens_packages WHERE name = N'SV Thin';
SELECT @p3 = id FROM dbo.pos_lens_packages WHERE name = N'Prog Essential';
SELECT @p4 = id FROM dbo.pos_lens_packages WHERE name = N'Prog Premium';
SELECT @p5 = id FROM dbo.pos_lens_packages WHERE name = N'Bifocal FT28';

DECLARE @a1 INT, @a2 INT, @a3 INT, @a4 INT, @a5 INT;
SELECT @a1 = id FROM dbo.pos_lens_addons WHERE name = N'Anti-Reflection';
SELECT @a2 = id FROM dbo.pos_lens_addons WHERE name = N'Blue Cut';
SELECT @a3 = id FROM dbo.pos_lens_addons WHERE name = N'UV400';
SELECT @a4 = id FROM dbo.pos_lens_addons WHERE name = N'Scratch Resistant';
SELECT @a5 = id FROM dbo.pos_lens_addons WHERE name = N'Photochromic coating';

IF @p1 IS NOT NULL AND @a1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p1 AND addon_id = @a1)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p1, @a1);
IF @p1 IS NOT NULL AND @a3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p1 AND addon_id = @a3)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p1, @a3);
IF @p1 IS NOT NULL AND @a4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p1 AND addon_id = @a4)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p1, @a4);

IF @p2 IS NOT NULL AND @a1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p2 AND addon_id = @a1)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p2, @a1);
IF @p2 IS NOT NULL AND @a2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p2 AND addon_id = @a2)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p2, @a2);
IF @p2 IS NOT NULL AND @a4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p2 AND addon_id = @a4)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p2, @a4);

IF @p3 IS NOT NULL AND @a1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p3 AND addon_id = @a1)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p3, @a1);
IF @p3 IS NOT NULL AND @a2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p3 AND addon_id = @a2)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p3, @a2);
IF @p3 IS NOT NULL AND @a5 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p3 AND addon_id = @a5)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p3, @a5);

IF @p4 IS NOT NULL AND @a1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p4 AND addon_id = @a1)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p4, @a1);
IF @p4 IS NOT NULL AND @a2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p4 AND addon_id = @a2)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p4, @a2);
IF @p4 IS NOT NULL AND @a4 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p4 AND addon_id = @a4)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p4, @a4);
IF @p4 IS NOT NULL AND @a5 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p4 AND addon_id = @a5)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p4, @a5);

IF @p5 IS NOT NULL AND @a1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p5 AND addon_id = @a1)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p5, @a1);
IF @p5 IS NOT NULL AND @a3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.pos_lens_pkg_addons WHERE package_id = @p5 AND addon_id = @a3)
  INSERT INTO dbo.pos_lens_pkg_addons (package_id, addon_id) VALUES (@p5, @a3);
GO
