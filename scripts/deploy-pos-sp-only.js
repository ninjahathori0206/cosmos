'use strict'
/** Apply sql/sp/pos.sql only (CREATE OR ALTER procs) — fixes brand_name to include source_brand. */
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

async function main() {
  const file = path.join(__dirname, '..', 'sql', 'sp', 'pos.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (let i = 0; i < batches.length; i++) {
      await pool.request().query(batches[i])
    }
    console.log('[deploy_pos_sp] ok:', batches.length, 'batch(es) from sql/sp/pos.sql')

    const r = await pool.request().query(`
      EXEC dbo.sp_POS_StoreCatalogue @store_id = 10, @q = NULL, @brand = NULL
    `)
    const rows = (r.recordset || []).filter((x) => String(x.sku_code || '').startsWith('BLN-OLD'))
    console.log('\nSample after deploy (store 10, BLN-OLD*):')
    console.table(rows.map((x) => ({ sku_code: x.sku_code, brand_name: x.brand_name })))
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
