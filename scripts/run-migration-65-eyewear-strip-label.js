/**
 * Seeds eyewear_strip_12x100 + adds brand_name to sp_PurchaseHeader_GetSKUs.
 *
 * Usage: npm run migrate:65-eyewear-strip-label
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.');
    process.exit(1);
  }
  const file = path.join(__dirname, '..', 'sql', 'migrations', '65_eyewear_strip_label_format.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('[migration-65] OK — ran', batches.length, 'batch(es).');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-65]', err.message || err);
  process.exit(1);
});
