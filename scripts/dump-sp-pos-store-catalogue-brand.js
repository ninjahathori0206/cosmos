'use strict'
require('dotenv').config()
const { getPool } = require('../src/config/db')

async function main() {
  const pool = await getPool()
  const r = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.sp_POS_StoreCatalogue')) AS def
  `)
  const d = (r.recordset[0] && r.recordset[0].def) || ''
  const m = d.match(/LTRIM\s*\(\s*RTRIM\s*\(\s*COALESCE[\s\S]{0,1200}?\)\)\)\s*\)\s*\)\s*AS\s*brand_name/i)
  if (m) {
    console.log('--- brand_name expression in deployed SP ---\n')
    console.log(m[0])
  } else {
    console.log('Could not locate brand_name COALESCE; first 3000 chars of SP:\n')
    console.log(d.slice(0, 3000))
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
