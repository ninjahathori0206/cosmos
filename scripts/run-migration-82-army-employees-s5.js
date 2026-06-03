/**
 * Migration 82 — Army HR employees (S5)
 * Usage: npm run migrate:82-army-employees-s5
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
  const migFile = path.join(__dirname, '..', 'sql', 'migrations', '82_army_employees_s5.sql');
  const batches = fs.readFileSync(migFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) await pool.request().query(batch);
    console.log('[migration-82] OK — Army employee tables deployed.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-82]', err.message || err);
  process.exit(1);
});
