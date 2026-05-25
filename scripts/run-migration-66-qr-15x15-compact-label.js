/**
 * Updates small_label to compact 15×15 layout + brand_code on sp_PurchaseHeader_GetSKUs.
 *
 * Usage: npm run migrate:66-qr-15x15-compact-label
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '66_qr_15x15_compact_label.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('[migration-66] OK — ran', batches.length, 'batch(es).');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-66]', err.message || err);
  process.exit(1);
});
