/**
 * Verify sp_TransferRequest_DispatchShipment exists and sync SP is callable.
 * Usage: node scripts/verify-atomic-dispatch-shipment.js
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
    const procs = await pool.request().query(`
      SELECT name
      FROM sys.procedures
      WHERE name IN (
        N'sp_TransferRequest_DispatchShipment',
        N'sp_TransferRequest_SyncDispatchedFromDocs'
      )
      ORDER BY name
    `)
    const names = (procs.recordset || []).map((r) => r.name)
    const required = [
      'sp_TransferRequest_DispatchShipment',
      'sp_TransferRequest_SyncDispatchedFromDocs'
    ]
    for (const p of required) {
      if (!names.includes(p)) {
        console.error('FAIL: missing procedure', p)
        process.exit(1)
      }
    }
    const params = await pool.request().query(`
      SELECT OBJECT_NAME(object_id) AS proc_name, name AS param_name
      FROM sys.parameters
      WHERE object_id = OBJECT_ID(N'dbo.sp_StockTransferDoc_Dispatch')
        AND name = N'@caller_manages_transaction'
    `)
    if (!(params.recordset || []).length) {
      console.error('FAIL: sp_StockTransferDoc_Dispatch missing @caller_manages_transaction')
      process.exit(1)
    }
    console.log('OK — atomic dispatch procedures deployed')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[verify-atomic-dispatch-shipment]', err.message || err)
  process.exit(1)
})
