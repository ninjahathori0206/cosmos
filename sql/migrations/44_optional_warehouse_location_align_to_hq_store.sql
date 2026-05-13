-- ═══════════════════════════════════════════════════════════════════════════════
-- OPTIONAL one-time migration: repoint primary WAREHOUSE rows from legacy
-- location_id (typically 1) to the active HQ store_id, then update app_settings.
--
-- Run ONLY after backup and validation. Requires migration 43 (functions + settings).
-- If HQ store_id already equals the current primary warehouse id, this is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════════
USE [CosmosERP];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

DECLARE @hq INT;
SELECT TOP (1) @hq = store_id
FROM dbo.stores WITH (UPDLOCK, HOLDLOCK)
WHERE store_type = 'HQ'
  AND is_active = 1
  AND status = 'ACTIVE'
ORDER BY store_id;

IF @hq IS NULL
BEGIN
  ROLLBACK TRANSACTION;
  RAISERROR('44_optional_warehouse: no active HQ store row (store_type HQ).', 16, 1);
  RETURN;
END;

DECLARE @old INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();

IF @old = @hq
BEGIN
  UPDATE dbo.app_settings
  SET setting_value = CAST(@hq AS VARCHAR(500)), updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
  WHERE setting_key = 'foundry_primary_warehouse_location_id';

  COMMIT TRANSACTION;
  SELECT @hq AS primary_warehouse_location_id, 'already_aligned' AS migration_result;
  RETURN;
END;

-- Merge quantities where both legacy warehouse row and HQ-target row exist
UPDATE h
SET
  h.qty         = h.qty + o.qty,
  h.last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
FROM dbo.stock_balances h
INNER JOIN dbo.stock_balances o
  ON o.sku_id = h.sku_id
 AND o.location_type = 'WAREHOUSE'
 AND o.location_id = @old
WHERE h.location_type = 'WAREHOUSE'
  AND h.location_id = @hq;

DELETE o
FROM dbo.stock_balances o
WHERE o.location_type = 'WAREHOUSE'
  AND o.location_id = @old
  AND EXISTS (
    SELECT 1
    FROM dbo.stock_balances h
    WHERE h.sku_id = o.sku_id
      AND h.location_type = 'WAREHOUSE'
      AND h.location_id = @hq
  );

-- Remaining legacy rows: single WAREHOUSE row per SKU — change location_id
UPDATE dbo.stock_balances
SET
  location_id    = @hq,
  last_updated   = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE location_type = 'WAREHOUSE'
  AND location_id = @old;

-- Historical movements (optional consistency for reporting)
UPDATE dbo.stock_movements
SET from_location_id = @hq
WHERE movement_type = 'HQ_TO_STORE'
  AND from_location_type = 'WAREHOUSE'
  AND from_location_id = @old;

UPDATE dbo.app_settings
SET setting_value = CAST(@hq AS VARCHAR(500)), updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
WHERE setting_key = 'foundry_primary_warehouse_location_id';

COMMIT TRANSACTION;

SELECT @hq AS primary_warehouse_location_id, @old AS previous_location_id, 'repointed' AS migration_result;
GO
