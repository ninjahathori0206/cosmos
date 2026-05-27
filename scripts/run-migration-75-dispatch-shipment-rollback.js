/**
 * Fix "cannot use the rollback statement within an insert exec statement"
 * when creating a goods-request shipment (Request #26 partial dispatch, etc.).
 *
 * Usage: npm run migrate:75-dispatch-shipment-rollback
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
  if (idx < 0) {
    throw new Error(`Procedure ${procName} not found in source`)
  }
  const slice = source.slice(idx)
  const nextProc = slice.search(/\r?\n-- ─+[\r\n]+\r?\n-- sp_/m)
  const body = nextProc > 0 ? slice.slice(0, nextProc) : slice
  return splitGoBatches(body).filter((b) => b.includes(marker))
}

async function runFile(pool, relPath, procNames) {
  const file = path.join(__dirname, '..', relPath)
  const source = fs.readFileSync(file, 'utf8')
  const batches = []
  procNames.forEach((name) => {
    batches.push(...batchesForProcedure(source, name))
  })
  if (!batches.length) {
    throw new Error(`No batches for ${relPath}`)
  }
  for (const batch of batches) {
    await pool.request().query(batch)
  }
  return batches.length
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const pool = await sql.connect(config)
  try {
    const n1 = await runFile(pool, 'sql/sp/stock_transfer_docs.sql', ['sp_StockTransferDoc_Dispatch'])
    const n2 = await runFile(pool, 'sql/sp/transfer_requests.sql', ['sp_TransferRequest_DispatchShipment'])
    console.log('[migration-75] OK — redeployed', n1 + n2, 'procedure batch(es). Retry shipment dispatch.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-75]', err.message || err)
  process.exit(1)
})
