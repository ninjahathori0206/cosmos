/*
  Migration 48 — Store type semantic roles (SQL mirror of src/config/storeTypesCatalog.js)

  - dbo.store_type_catalog_roles: links type_key → role_key (e.g. HQ → warehouse_hub)
  - Updates dbo.fn_Foundry_PrimaryWarehouseLocationId fallback to use roles, not hardcoded 'HQ'

  Keep MERGE rows in sync with STORE_TYPE_ROLES + STORE_TYPES_CATALOG.roles in Node.

  Deploy: npm run migrate:48-store-type-catalog-roles
*/
USE [CosmosERP];
GO

SET NOCOUNT ON;
PRINT N'Migration 48: store_type_catalog_roles';
GO

IF OBJECT_ID(N'dbo.store_type_catalog_roles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.store_type_catalog_roles (
    type_key  VARCHAR(50)  NOT NULL,
    role_key  VARCHAR(50)  NOT NULL,
    CONSTRAINT PK_store_type_catalog_roles PRIMARY KEY (type_key, role_key),
    CONSTRAINT FK_store_type_catalog_roles_type
      FOREIGN KEY (type_key) REFERENCES dbo.store_type_catalog(type_key)
  );
  PRINT N'Migration 48: created dbo.store_type_catalog_roles';
END;
GO

MERGE dbo.store_type_catalog_roles AS tgt
USING (
  SELECT *
  FROM (VALUES
    (N'HQ', N'warehouse_hub')
  ) AS v(type_key, role_key)
) AS src
ON tgt.type_key = src.type_key AND tgt.role_key = src.role_key
WHEN NOT MATCHED THEN INSERT (type_key, role_key) VALUES (src.type_key, src.role_key);
GO

CREATE OR ALTER FUNCTION dbo.fn_Foundry_PrimaryWarehouseLocationId ()
RETURNS INT
AS
BEGIN
  DECLARE @parsed INT;
  DECLARE @v VARCHAR(500);

  SELECT @v = setting_value
  FROM dbo.app_settings
  WHERE setting_key = N'foundry_primary_warehouse_location_id';

  IF (@v IS NOT NULL AND LEN(LTRIM(RTRIM(@v))) > 0)
  BEGIN
    SET @parsed = TRY_CONVERT(INT, LTRIM(RTRIM(@v)));
    IF @parsed IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM dbo.stores s
         WHERE s.store_id = @parsed
           AND s.is_active = 1
           AND s.status = N'ACTIVE'
       )
      RETURN @parsed;
  END;

  DECLARE @hub INT;
  SELECT TOP (1) @hub = s.store_id
  FROM dbo.stores AS s
  INNER JOIN dbo.store_type_catalog_roles AS r ON r.type_key = s.store_type
  WHERE r.role_key = N'warehouse_hub'
    AND s.is_active = 1
    AND s.status = N'ACTIVE'
  ORDER BY s.store_id;

  RETURN @hub;
END;
GO

/* Bootstrap setting from first active warehouse-hub store when row missing */
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'foundry_primary_warehouse_location_id')
BEGIN
  DECLARE @hubBootstrap INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();

  IF @hubBootstrap IS NOT NULL
  BEGIN
    INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
    VALUES (
      N'foundry_primary_warehouse_location_id',
      CAST(@hubBootstrap AS VARCHAR(20)),
      N'inventory',
      N'Primary WAREHOUSE stock_balances.location_id (warehouse hub store_id).'
    );
  END;
END;
GO

PRINT N'Migration 48: complete.';
GO
