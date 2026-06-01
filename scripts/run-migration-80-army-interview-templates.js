/**
 * Migration 80 — Army HR interview templates
 * Usage: npm run migrate:80-army-interview-templates
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
  const migFile = path.join(__dirname, '..', 'sql', 'migrations', '80_army_interview_templates.sql');
  const batches = fs.readFileSync(migFile, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) await pool.request().query(batch);
    console.log('[migration-80] OK — Army interview template tables deployed.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-80]', err.message || err);
  process.exit(1);
});
