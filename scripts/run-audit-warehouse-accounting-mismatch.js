/**
 * Audit SKUs where Stock View would show hub qty in location list but accounting warehouse_qty = 0.
 * Patterns:
 *   A) WAREHOUSE stock at non-primary location_id (misaligned)
 *   B) Sum of all WAREHOUSE qty > 0 but qty at primary hub = 0
 *
 * Usage: node scripts/run-audit-warehouse-accounting-mismatch.js
 */
require('dotenv').config()
const sql = require('mssql')

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
}

async function main() {
  const pool = await sql.connect(config)
  try {
    const primaryQ = await pool.request().query(`
      SELECT
        dbo.fn_Foundry_PrimaryWarehouseLocationId() AS primary_id,
        CAST(dbo.fn_Foundry_WarehouseDisplayName() AS NVARCHAR(200)) AS primary_name
    `)
    const primary = primaryQ.recordset[0]
    console.log('[audit] Primary hub:', primary)

    const mismatches = await pool.request().query(`
      DECLARE @primary INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();

      SELECT
        sk.sku_id,
        sk.sku_code,
        ISNULL((SELECT SUM(sb.qty) FROM dbo.stock_balances sb
                WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE' AND sb.qty > 0), 0) AS all_warehouse_qty,
        ISNULL((SELECT sb.qty FROM dbo.stock_balances sb
                WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE'
                  AND sb.location_id = @primary), 0) AS primary_warehouse_qty,
        ISNULL((SELECT SUM(sb.qty) FROM dbo.stock_balances sb
                WHERE sb.sku_id = sk.sku_id AND sb.qty > 0), 0) AS total_stock,
        ISNULL((SELECT SUM(sb.qty) FROM dbo.stock_balances sb
                WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE'
                  AND sb.location_id <> @primary AND sb.qty > 0), 0) AS misaligned_warehouse_qty,
        STUFF((
          SELECT N', ' + CAST(sb.location_id AS NVARCHAR(20)) + N':' + CAST(sb.qty AS NVARCHAR(20))
          FROM dbo.stock_balances sb
          WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE' AND sb.qty > 0
          FOR XML PATH(''), TYPE
        ).value(N'.', N'NVARCHAR(400)'), 1, 2, N'') AS warehouse_locations
      FROM dbo.skus sk
      WHERE sk.status = N'LIVE'
        AND EXISTS (
          SELECT 1 FROM dbo.stock_balances sb
          WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE' AND sb.qty > 0
        )
        AND (
          ISNULL((SELECT sb.qty FROM dbo.stock_balances sb
                  WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE'
                    AND sb.location_id = @primary), 0) = 0
          OR EXISTS (
            SELECT 1 FROM dbo.stock_balances sb
            WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE'
              AND sb.location_id <> @primary AND sb.qty > 0
          )
        )
      ORDER BY sk.sku_code;
    `)

    const rows = mismatches.recordset || []
    console.log('[audit] SKUs with hub list vs Falshruti accounting mismatch:', rows.length)
    if (rows.length) {
      console.table(rows)
      process.exit(2)
    }
    console.log('[audit] OK — every LIVE SKU with WAREHOUSE stock has qty on primary hub (Falshruti).')

    const summary = await pool.request().query(`
      DECLARE @primary INT = dbo.fn_Foundry_PrimaryWarehouseLocationId();
      SELECT
        (SELECT COUNT(*) FROM dbo.stock_balances sb
         WHERE sb.location_type = N'WAREHOUSE' AND sb.qty > 0) AS warehouse_balance_rows,
        (SELECT COUNT(*) FROM dbo.stock_balances sb
         WHERE sb.location_type = N'WAREHOUSE' AND sb.location_id <> @primary AND sb.qty > 0) AS misaligned_rows,
        (SELECT COUNT(DISTINCT sb.sku_id) FROM dbo.stock_balances sb
         WHERE sb.location_type = N'WAREHOUSE' AND sb.qty > 0) AS skus_with_warehouse_stock,
        (SELECT COUNT(DISTINCT sk.sku_id) FROM dbo.skus sk
         WHERE EXISTS (
           SELECT 1 FROM dbo.stock_balances sb
           WHERE sb.sku_id = sk.sku_id AND sb.qty > 0
         )
         AND ISNULL((
           SELECT sb.qty FROM dbo.stock_balances sb
           WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE'
             AND sb.location_id = @primary
         ), 0) = 0
         AND EXISTS (
           SELECT 1 FROM dbo.stock_balances sb
           WHERE sb.sku_id = sk.sku_id AND sb.location_type = N'WAREHOUSE' AND sb.qty > 0
         )) AS skus_warehouse_visible_but_primary_zero
    `)
    console.log('[audit] Summary:', summary.recordset[0])

    const samples = await pool.request().query(`
      SELECT TOP 15
        sk.sku_code,
        sb.location_id,
        sb.location_name,
        sb.qty,
        sb.last_updated
      FROM dbo.stock_balances sb
      INNER JOIN dbo.skus sk ON sk.sku_id = sb.sku_id
      WHERE sb.location_type = N'WAREHOUSE' AND sb.qty > 0
      ORDER BY sb.last_updated DESC
    `)
    console.log('[audit] Latest WAREHOUSE balances (sample):')
    console.table(samples.recordset || [])
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[audit]', err.message || err)
  process.exit(1)
})
