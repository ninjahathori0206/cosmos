/**
 * Migration 89 — Store bank opening balance + treasury SPs
 * Usage: npm run migrate:89-store-bank-opening-balance
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
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }
  const migFile = path.join(__dirname, '..', 'sql', 'migrations', '89_store_bank_opening_balance.sql');
  const spFile = path.join(__dirname, '..', 'sql', 'sp', 'store_collections.sql');
  const migBatches = fs.readFileSync(migFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const spBatches = fs.readFileSync(spFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of migBatches) await pool.request().query(batch);
    for (const batch of spBatches) await pool.request().query(batch);
    console.log('[migration-89] OK — opening_balance column + SPs deployed.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-89]', err.message || err);
  process.exit(1);
});
