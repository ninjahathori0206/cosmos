/**
 * Deploy dbo.sp_User_SetPosPin (Command Unit auto/regenerate POS PIN).
 * Usage: npm run deploy:sp-user-set-pos-pin
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
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const file = path.join(__dirname, '..', 'sql', 'migrations', '45_user_set_pos_pin_sp.sql')
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  const pool = await sql.connect(config)
  try {
    for (const batch of batches) {
      await pool.request().query(batch)
    }
    console.log('[deploy-sp-user-set-pos-pin] OK —', batches.length, 'batch(es)')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[deploy-sp-user-set-pos-pin] FAILED:', err.message)
  process.exit(1)
})
