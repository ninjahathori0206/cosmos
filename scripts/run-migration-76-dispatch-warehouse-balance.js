/**
 * Redeploy sp_StockTransferDoc_Dispatch — align WAREHOUSE stock_balances to primary hub
 * and validate unit-tracked dispatch against available sku_units.
 *
 * Usage: npm run migrate:76-dispatch-warehouse-balance
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sql = require('mssql')

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
}

function splitGoBatches(source) {
  return source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
}

function batchesForProcedure(source, procName) {
  const marker = `CREATE OR ALTER PROCEDURE dbo.${procName}`
  const idx = source.indexOf(marker)
  if (idx < 0) throw new Error(`Procedure ${procName} not found`)
  const slice = source.slice(idx)
  const nextProc = slice.search(/\r?\n-- ─+[\r\n]+\r?\n-- sp_/m)
  const body = nextProc > 0 ? slice.slice(0, nextProc) : slice
  return splitGoBatches(body).filter((b) => b.includes(marker))
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const pool = await sql.connect(config)
  try {
    const alignPath = path.join(__dirname, '..', 'sql', 'maintenance', 'align_warehouse_stock_to_primary.sql')
    const alignSql = fs.readFileSync(alignPath, 'utf8')
    const alignBatches = splitGoBatches(alignSql).filter((b) => !b.startsWith('USE '))
    for (const batch of alignBatches) {
      await pool.request().query(batch)
    }
    console.log('[migration-76] Aligned WAREHOUSE stock_balances to primary hub.')

    const spPath = path.join(__dirname, '..', 'sql', 'sp', 'stock_transfer_docs.sql')
    const spSource = fs.readFileSync(spPath, 'utf8')
    const spBatches = batchesForProcedure(spSource, 'sp_StockTransferDoc_Dispatch')
    for (const batch of spBatches) {
      await pool.request().query(batch)
    }
    console.log('[migration-76] OK — sp_StockTransferDoc_Dispatch redeployed. Retry shipment dispatch.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-76]', err.message || err)
  process.exit(1)
})
