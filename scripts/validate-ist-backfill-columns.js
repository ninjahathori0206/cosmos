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

const src = fs.readFileSync(
  path.join(__dirname, '..', 'sql', 'migrations', 'ist_backfill_utc_stored_rows.sql'),
  'utf8'
)
const tables = [...src.matchAll(/^\s*UPDATE dbo\.(\w+) SET([\s\S]*?);/gm)]

async function main() {
  const pool = await sql.connect(config)
  try {
    for (const m of tables) {
      const table = m[1]
      const body = m[2]
      const cols = [...body.matchAll(/(\w+)\s*=\s*DATEADD/g)].map((x) => x[1])
      for (const col of cols) {
        const r = await pool.request().query(
          `SELECT COL_LENGTH('dbo.${table}', '${col}') AS len`
        )
        if (r.recordset[0].len == null) {
          console.log('MISSING', table + '.' + col)
        }
      }
    }
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
