/**
 * Creates dbo.sp_PurchaseHeader_RevertToDraft (revert from bill verify / discrepancy → DRAFT).
 *
 * Usage: npm run migrate:33-purchase-revert-to-draft
 *
 * Canonical procedure text also lives in sql/sp/pipeline_v2.sql
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
  const file = path.join(__dirname, '..', 'sql', 'alter', '33_purchase_revert_to_draft.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (let i = 0; i < batches.length; i += 1) {
      await pool.request().query(batches[i]);
    }
    console.log('[migration-33] OK — ran', batches.length, 'batch(es). sp_PurchaseHeader_RevertToDraft is installed.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-33]', err.message || err);
  process.exit(1);
});
