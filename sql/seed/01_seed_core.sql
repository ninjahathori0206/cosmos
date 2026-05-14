PRINT 'Seeding core data (roles, store, admin user)...';

USE [CosmosERP];

IF NOT EXISTS (SELECT 1 FROM dbo.roles WHERE role_key = 'super_admin')
BEGIN
  INSERT INTO dbo.roles (role_key, display_name, hierarchy_lvl, is_global)
  VALUES ('super_admin', 'Super Admin', 1, 1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.stores WHERE store_code = 'CORP-HQ-001')
BEGIN
  /* store_type key 'HQ' must match src/config/storeTypesCatalog.js */
  INSERT INTO dbo.stores (store_name, store_code, store_type, city, state, is_active)
  VALUES ('Corporate HQ', 'CORP-HQ-001', 'HQ', '—', '—', 1);
END;

/* Primary warehouse location = HQ store_id (used as stock_balances.location_id for WAREHOUSE hub). */
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'foundry_primary_warehouse_location_id')
BEGIN
  DECLARE @hqStoreId INT = (
    SELECT TOP 1 store_id FROM dbo.stores
    WHERE store_type = N'HQ' AND is_active = 1 AND status = N'ACTIVE'
    ORDER BY store_id
  );
  IF @hqStoreId IS NOT NULL
  BEGIN
    INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
    VALUES (
      N'foundry_primary_warehouse_location_id',
      CAST(@hqStoreId AS VARCHAR(20)),
      N'inventory',
      N'Primary WAREHOUSE stock_balances.location_id (HQ hub store_id).'
    );
  END;
END;

DECLARE @adminUserId INT;

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE username = 'admin')
BEGIN
  DECLARE @storeId INT = (
    SELECT TOP 1 store_id FROM dbo.stores
    WHERE store_type = N'HQ' AND is_active = 1
    ORDER BY store_id
  );

  INSERT INTO dbo.users (
    username,
    password_hash,
    full_name,
    email,
    phone,
    role_key,
    store_id,
    is_active
  )
  VALUES (
    'admin',
    -- bcrypt cost 12 for Admin@123 (documented in README)
    '$2a$12$AdZdrchil/qHA8BJn.6hBeBy1/mav1XUii2oYkqGIiylLpoG7WqfW',
    'System Administrator',
    'admin@eyewoot.com',
    '+91 00000 00000',
    'super_admin',
    @storeId,
    1
  );

  SET @adminUserId = SCOPE_IDENTITY();
END;
