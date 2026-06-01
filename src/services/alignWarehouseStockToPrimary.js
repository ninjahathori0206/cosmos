const { getPool } = require('../config/db');

/**
 * Merge WAREHOUSE stock_balances into fn_Foundry_PrimaryWarehouseLocationId().
 * Idempotent — safe after inventory hub change or purchase warehouse-ready.
 */
async function alignWarehouseStockToPrimary(existingPool) {
  const pool = existingPool || (await getPool());
  const result = await pool.request().query(`
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @primary INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();

    IF @primary IS NULL
      THROW 50001, 'Primary warehouse is not configured (fn_Foundry_PrimaryWarehouseLocationId returned NULL).', 1;

    DECLARE @primary_name NVARCHAR(200);
    SELECT @primary_name = store_name FROM dbo.stores WHERE store_id = @primary;

    IF @primary_name IS NULL OR LTRIM(RTRIM(@primary_name)) = N''
      SET @primary_name = N'Warehouse';

    BEGIN TRANSACTION;

    UPDATE h
    SET
      h.qty = h.qty + o.qty,
      h.last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    FROM dbo.stock_balances h
    INNER JOIN dbo.stock_balances o
      ON o.sku_id = h.sku_id
     AND o.location_type = N'WAREHOUSE'
     AND o.location_id <> @primary
     AND o.qty > 0
    WHERE h.location_type = N'WAREHOUSE'
      AND h.location_id = @primary;

    DELETE o
    FROM dbo.stock_balances o
    WHERE o.location_type = N'WAREHOUSE'
      AND o.location_id <> @primary
      AND o.qty > 0
      AND EXISTS (
        SELECT 1
        FROM dbo.stock_balances h
        WHERE h.sku_id = o.sku_id
          AND h.location_type = N'WAREHOUSE'
          AND h.location_id = @primary
      );

    UPDATE dbo.stock_balances
    SET
      location_id = @primary,
      location_name = LEFT(CAST(@primary_name AS VARCHAR(200)), 200),
      last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE location_type = N'WAREHOUSE'
      AND location_id <> @primary
      AND qty > 0;

    UPDATE dbo.sku_units
    SET
      location_type = N'WAREHOUSE',
      location_id = @primary
    WHERE status = N'AVAILABLE'
      AND location_type = N'WAREHOUSE'
      AND (location_id IS NULL OR location_id <> @primary);

    COMMIT TRANSACTION;

    SELECT
      @primary AS primary_warehouse_store_id,
      CAST(@primary_name AS NVARCHAR(200)) AS primary_warehouse_name,
      (
        SELECT COUNT(*)
        FROM dbo.stock_balances sb
        WHERE sb.location_type = N'WAREHOUSE'
          AND sb.location_id <> @primary
          AND sb.qty > 0
      ) AS remaining_misaligned_balance_rows,
      (
        SELECT COUNT(*)
        FROM dbo.sku_units u
        WHERE u.status = N'AVAILABLE'
          AND u.location_type = N'WAREHOUSE'
          AND u.location_id <> @primary
      ) AS remaining_misaligned_unit_rows;
  `);
  return (result.recordset && result.recordset[0]) || null;
}

module.exports = { alignWarehouseStockToPrimary };
