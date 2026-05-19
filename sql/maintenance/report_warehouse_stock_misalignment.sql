-- Report WAREHOUSE stock not at the configured primary hub (read-only).
-- Primary: dbo.fn_Foundry_PrimaryWarehouseLocationId()
-- Optional filter: set @sku_code to a specific sku_code, or NULL for all.

SET NOCOUNT ON;

DECLARE @primary INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
DECLARE @sku_code VARCHAR(100) = NULL; /* runner may substitute via sp_executesql */

IF @primary IS NULL
BEGIN
  RAISERROR('Primary warehouse is not configured (fn_Foundry_PrimaryWarehouseLocationId returned NULL).', 16, 1);
  RETURN;
END;

SELECT
  @primary AS primary_warehouse_store_id,
  CAST(dbo.fn_Foundry_WarehouseDisplayName() AS NVARCHAR(200)) AS primary_warehouse_name,
  (SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'foundry_primary_warehouse_location_id') AS app_setting_store_id;

SELECT
  sk.sku_id,
  sk.sku_code,
  sb.location_id AS warehouse_store_id,
  s.store_name AS warehouse_store_name,
  s.store_type,
  sb.qty,
  sb.last_updated
FROM dbo.stock_balances sb
INNER JOIN dbo.skus sk ON sk.sku_id = sb.sku_id
LEFT JOIN dbo.stores s ON s.store_id = sb.location_id
WHERE sb.location_type = N'WAREHOUSE'
  AND sb.location_id <> @primary
  AND sb.qty > 0
  AND (@sku_code IS NULL OR sk.sku_code = @sku_code)
ORDER BY sk.sku_code, sb.location_id;

SELECT
  sk.sku_id,
  sk.sku_code,
  ISNULL(sb.qty, 0) AS qty_at_primary
FROM dbo.skus sk
LEFT JOIN dbo.stock_balances sb
  ON sb.sku_id = sk.sku_id
 AND sb.location_type = N'WAREHOUSE'
 AND sb.location_id = @primary
WHERE (@sku_code IS NULL OR sk.sku_code = @sku_code)
  AND EXISTS (
    SELECT 1
    FROM dbo.stock_balances o
    WHERE o.sku_id = sk.sku_id
      AND o.location_type = N'WAREHOUSE'
      AND o.location_id <> @primary
      AND o.qty > 0
  );
