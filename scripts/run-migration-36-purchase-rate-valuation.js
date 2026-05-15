/**
 * Migration 36: purchase_rate column + rate intelligence + challan valuation SPs
 * Usage: npm run migrate:36-purchase-rate-valuation
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

const SQL_FILES = [
  'sql/alter/36_purchase_item_purchase_rate.sql',
  'sql/sp/rate_intelligence.sql',
  'sql/sp/finance_challan_invoice.sql',
  'sql/alter/20_product_search.sql',
  'sql/sp/product_master.sql'
];

async function runFile(pool, relPath) {
  const file = path.join(__dirname, '..', relPath);
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  for (let i = 0; i < batches.length; i += 1) {
    await pool.request().query(batches[i]);
  }
  console.log('[migration-36] OK —', relPath, `(${batches.length} batch(es))`);
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }
  const pool = await sql.connect(config);
  try {
    for (const f of SQL_FILES) {
      await runFile(pool, f);
    }
    console.log('[migration-36] Complete — purchase rate + rate intelligence installed.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-36]', err.message || err);
  process.exit(1);
});
