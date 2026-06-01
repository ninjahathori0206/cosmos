require('dotenv').config()
const sql = require('mssql')
const { sqlNow } = require('../src/lib/cosmosIst')

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
    const m = await pool.request().query(
      "SELECT setting_value FROM dbo.app_settings WHERE setting_key = 'ist_utc_backfill_v1_completed_at'"
    )
    console.log('marker:', m.recordset[0]?.setting_value || '(none)')
    const n = await pool.request().query('SELECT ' + sqlNow() + ' AS ist_now')
    console.log('ist_now:', n.recordset[0].ist_now)
    for (const table of ['audit_logs', 'pos_orders', 'transfer_requests', 'purchase_headers']) {
      try {
        const r = await pool.request().query(
          'SELECT TOP 1 created_at AS ts, DATEDIFF(MINUTE, created_at, ' +
            sqlNow() +
            ') AS min_behind_ist FROM dbo.' +
            table +
            ' ORDER BY created_at DESC'
        )
        console.log(table + ':', r.recordset[0] || '(empty)')
      } catch (err) {
        console.log(table + ': skip —', err.message)
      }
    }
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
