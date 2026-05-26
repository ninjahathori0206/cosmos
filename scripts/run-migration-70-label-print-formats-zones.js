/**
 * Migration 70 — zones_json on label_print_formats
 * Usage: npm run migrate:70-label-print-formats-zones
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '70_label_print_formats_zones.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    const spFile = path.join(__dirname, '..', 'sql', 'sp', 'label_print_formats.sql');
    const spBatches = fs.readFileSync(spFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
    for (const batch of spBatches) {
      await pool.request().query(batch);
    }
    console.log('[migration-70] OK — migration + SPs deployed.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-70]', err.message || err);
  process.exit(1);
});
