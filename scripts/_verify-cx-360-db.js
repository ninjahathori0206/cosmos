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

async function main () {
  const pool = await sql.connect(config)
  const r = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.loyalty_ledger) AS ledger_rows,
      (SELECT COUNT(*) FROM dbo.customer_lifestyle) AS lifestyle_rows,
      (SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'loyalty_engine_v2') AS engine_flag
  `)
  console.log('[verify-cx-360]', r.recordset[0])
  await pool.close()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
