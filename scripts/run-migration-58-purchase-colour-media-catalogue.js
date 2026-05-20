/**
 * Sync digitization colour media to SKUs; fix catalogue/purchase SKU image reads.
 *
 * Usage: npm run migrate:58-purchase-colour-media-catalogue
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

async function runBatches(pool, absPath, label) {
  const source = fs.readFileSync(absPath, 'utf8')
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean)
  for (const batch of batches) {
    await pool.request().query(batch)
  }
  console.log('[migrate-58-colour-media]', label, batches.length, 'batch(es).')
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.')
    process.exit(1)
  }
  const root = path.join(__dirname, '..')
  const migration = path.join(root, 'sql', 'migrations', '58_purchase_colour_media_catalogue.sql')
  if (!fs.existsSync(migration)) {
    console.error('Missing file:', migration)
    process.exit(1)
  }

  const pool = await sql.connect(config)
  try {
    await runBatches(pool, migration, 'sql/migrations/58_purchase_colour_media_catalogue.sql')
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[migrate-58-colour-media]', err.message || err)
  process.exit(1)
})
