/**
 * Deploy sp_SKUv2_Generate with reading power in sku_code / barcode / skus.reading_power.
 * Usage: node scripts/run-migration-63-generate-reader-power.js
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

function splitGoBatches(source) {
  return source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
}

async function main() {
  const pool = await sql.connect(config);
  try {
    const file = path.join(__dirname, '..', 'sql/alter/63_sp_SKUv2_Generate_reader_power.sql');
    const batches = splitGoBatches(fs.readFileSync(file, 'utf8'));
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('[migration-63] OK — sp_SKUv2_Generate deployed (' + batches.length + ' batches)');

    const check = await pool.request().query(`
      SELECT CASE WHEN OBJECT_DEFINITION(OBJECT_ID('dbo.sp_SKUv2_Generate')) LIKE '%powerPfx%' THEN 1 ELSE 0 END AS ok
    `);
    console.log('[migration-63] powerPfx in live SP:', check.recordset[0].ok ? 'yes' : 'NO');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-63] FAILED:', err.message);
  process.exit(1);
});
