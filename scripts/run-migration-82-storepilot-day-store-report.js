/**
 * Migration 82 — StorePilot Day Store Report SP
 * Usage: npm run migrate:82-storepilot-day-store-report
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
  const spFile = path.join(__dirname, '..', 'sql', 'sp', 'storepilot_day_store_report.sql');
  const spBatches = fs.readFileSync(spFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of spBatches) await pool.request().query(batch);
    console.log('[migration-82] OK — sp_StorePilot_DayStoreReport deployed.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-82]', err.message || err);
  process.exit(1);
});
