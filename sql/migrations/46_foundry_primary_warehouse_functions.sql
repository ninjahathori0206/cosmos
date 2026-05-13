/*
  Migration 46 — Primary warehouse resolution (data-driven)

  Defines:
    dbo.fn_Foundry_PrimaryWarehouseLocationId() — INT, NULL if unresolved
    dbo.fn_Foundry_WarehouseDisplayName()      — NVARCHAR(200), fallback N'Warehouse'

  Resolution order for location id:
    1) app_settings.foundry_primary_warehouse_location_id when value parses to INT
       and dbo.stores has that store_id active.
    2) Else first active HQ row: store_type = 'HQ', is_active = 1, status = 'ACTIVE', ORDER BY store_id.

  Bootstraps app_settings row when missing and at least one HQ store exists.

  Deploy: run once, then redeploy sql/sp/stock_transfer_docs.sql and sql/sp/stock_transfers.sql if modified separately.
*/

USE [CosmosERP];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
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

  DECLARE @hq INT;
  SELECT TOP (1) @hq = store_id
  FROM dbo.stores
  WHERE store_type = N'HQ'
    AND is_active = 1
    AND status = N'ACTIVE'
  ORDER BY store_id;

  RETURN @hq;
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_Foundry_WarehouseDisplayName ()
RETURNS NVARCHAR(200)
AS
BEGIN
  DECLARE @id INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
  IF @id IS NULL
    RETURN N'Warehouse';

  DECLARE @name NVARCHAR(200);
  SELECT @name = store_name
  FROM dbo.stores
  WHERE store_id = @id;

  IF (@name IS NULL OR LTRIM(RTRIM(@name)) = N'')
    RETURN N'Warehouse';

  RETURN @name;
END;
GO

/* Bootstrap setting from first active HQ when row missing */
IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = N'foundry_primary_warehouse_location_id')
BEGIN
  DECLARE @hqBootstrap INT;
  SELECT TOP (1) @hqBootstrap = store_id
  FROM dbo.stores
  WHERE store_type = N'HQ'
    AND is_active = 1
    AND status = N'ACTIVE'
  ORDER BY store_id;

  IF @hqBootstrap IS NOT NULL
  BEGIN
    INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
    VALUES (
      N'foundry_primary_warehouse_location_id',
      CAST(@hqBootstrap AS VARCHAR(20)),
      N'inventory',
      N'Primary WAREHOUSE stock_balances.location_id (HQ hub store_id).'
    );
  END;
END;
GO

PRINT N'Migration 46: fn_Foundry_PrimaryWarehouseLocationId + fn_Foundry_WarehouseDisplayName installed.';
GO
