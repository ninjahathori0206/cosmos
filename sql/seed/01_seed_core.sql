PRINT 'Seeding core data (roles, store, admin user)...';

USE [CosmosERP];

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = 'super_admin')
BEGIN
  INSERT INTO dbo.roles (role_key, display_name, hierarchy_lvl, is_global)
  VALUES ('super_admin', 'Super Admin', 1, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.stores WHERE store_code = 'HQ-000')
BEGIN
  INSERT INTO dbo.stores (store_name, store_code, store_type, city, state, is_active)
  VALUES ('Eyewoot HQ', 'HQ-000', 'HQ', 'Surat', 'Gujarat', 1);
END;

DECLARE @adminUserId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = 'admin')
BEGIN
  DECLARE @storeId INT = (SELECT TOP 1 store_id FROM dbo.stores WHERE store_code = 'HQ-000');

  INSERT INTO dbo.users (
    username,
    password,
    full_name,
    email,
    phone,
    role_key,
    store_id,
    is_active
  )
  VALUES (
    'admin',
    'Admin@123',
    'System Administrator',
    'admin@eyewoot.com',
    '+91 00000 00000',
    'super_admin',
    @storeId,
    1
  );

  SET @adminUserId = SCOPE_IDENTITY();
END;

