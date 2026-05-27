/**
 * Redeploy partial receive SPs:
 *   sp_StockTransferDoc_Stock — delta stock, stay ACCEPTED until fully received
 *   sp_TransferRequest_SyncReceivedFromDocs — sum qty from ACCEPTED + STOCKED docs
 *
 * Usage: npm run migrate:77-partial-transfer-receive
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

async function deployProc(pool, filePath, procName) {
  const source = fs.readFileSync(filePath, 'utf8')
  const batches = batchesForProcedure(source, procName)
  for (const batch of batches) {
    await pool.request().query(batch)
  }
  console.log('[migration-77] OK — ' + procName)
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const pool = await sql.connect(config)
  try {
    const docsPath = path.join(__dirname, '..', 'sql', 'sp', 'stock_transfer_docs.sql')
    const reqPath = path.join(__dirname, '..', 'sql', 'sp', 'transfer_requests.sql')
    await deployProc(pool, docsPath, 'sp_StockTransferDoc_Stock')
    await deployProc(pool, reqPath, 'sp_TransferRequest_SyncReceivedFromDocs')
    console.log('[migration-77] Partial transfer receive SPs deployed.')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migration-77]', err.message || err)
  process.exit(1)
})
