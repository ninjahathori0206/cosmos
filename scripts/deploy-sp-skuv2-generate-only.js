/**
 * Deploy only dbo.sp_SKUv2_Generate from pipeline_v2.sql (unit allocation block).
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

async function main() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'sql', 'sp', 'pipeline_v2.sql'), 'utf8')
  const m = src.match(/CREATE PROCEDURE dbo\.sp_SKUv2_Generate[\s\S]*?^END;\s*$/m)
  if (!m) {
    console.error('sp_SKUv2_Generate not found in pipeline_v2.sql')
    process.exit(1)
  }
  const drop = "IF OBJECT_ID('dbo.sp_SKUv2_Generate','P') IS NOT NULL DROP PROCEDURE dbo.sp_SKUv2_Generate;"
  const pool = await sql.connect(config)
  try {
    await pool.request().query(drop)
    await pool.request().query(m[0])
    console.log('[deploy-sp-skuv2-generate-only] OK')
  } finally {
    await pool.close()
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
