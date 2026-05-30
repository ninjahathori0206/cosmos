/**
 * Reader power columns + redeploy pipeline_v2 / pos catalogue procs.
 * Usage: node scripts/run-migration-62-reader-power.js
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

async function runSqlFile(pool, relativePath, label) {
  const file = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(file)) {
    console.warn(`[migration-62] Skip missing file: ${relativePath}`);
    return 0;
  }
  const batches = splitGoBatches(fs.readFileSync(file, 'utf8'));
  for (const batch of batches) {
    await pool.request().query(batch);
  }
  console.log(`[migration-62] OK — ${label} (${batches.length} batch(es))`);
  return batches.length;
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }
  const pool = await sql.connect(config);
  try {
    await runSqlFile(pool, 'sql/alter/62_reader_power.sql', '62_reader_power columns');
    try {
      await runSqlFile(pool, 'sql/sp/pos.sql', 'pos catalogue procs');
    } catch (posErr) {
      console.warn('[migration-62] pos.sql deploy skipped:', posErr.message);
    }
    try {
      await runSqlFile(pool, 'sql/sp/pipeline_v2_challan.sql', 'pipeline_v2_challan procs');
    } catch (chErr) {
      console.warn('[migration-62] pipeline_v2_challan deploy skipped:', chErr.message);
    }
    console.warn('[migration-62] Full pipeline_v2.sql not auto-deployed (schema may differ). reading_power is applied post-save via purchases API.');

    const check = await pool.request().query(`
      SELECT
        CASE WHEN COL_LENGTH('dbo.skus', 'reading_power') IS NOT NULL THEN 1 ELSE 0 END AS skus_col,
        CASE WHEN COL_LENGTH('dbo.purchase_item_colours', 'reading_power') IS NOT NULL THEN 1 ELSE 0 END AS pic_col;
    `);
    const row = check.recordset[0];
    console.log('[migration-62] skus.reading_power column:', row.skus_col ? 'yes' : 'NO');
    console.log('[migration-62] purchase_item_colours.reading_power column:', row.pic_col ? 'yes' : 'NO');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-62] FAILED:', err.message);
  process.exit(1);
});
