/**
 * Deploy dbo.sp_Auth_Login and user-management procedures after migration 45.
 * Usage: npm run deploy:auth-users-sp
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

async function runBatches(pool, relPath) {
  const file = path.join(__dirname, '..', relPath)
  const source = fs.readFileSync(file, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  for (const batch of batches) {
    await pool.request().query(batch)
  }
  console.log('[deploy-auth-users-sp]', relPath, '—', batches.length, 'batch(es)')
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env')
    process.exit(1)
  }
  const pool = await sql.connect(config)
  try {
    await runBatches(pool, path.join('sql', 'sp', 'auth.sql'))
    await runBatches(pool, path.join('sql', 'sp', 'users.sql'))
    console.log('[deploy-auth-users-sp] OK')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[deploy-auth-users-sp]', err.message || err)
  process.exit(1)
})
