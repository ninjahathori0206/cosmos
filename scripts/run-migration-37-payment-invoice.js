/**
 * Migration 37: payment_invoice_allocations + invoice-only payment SPs
 * Usage: npm run migrate:37-payment-invoice
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
  'sql/alter/37_payment_invoice_allocations.sql',
  'sql/sp/finance_payment_invoice.sql'
];

async function runFile(pool, relPath) {
  const file = path.join(__dirname, '..', relPath);
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  for (let i = 0; i < batches.length; i += 1) {
    await pool.request().query(batches[i]);
  }
  console.log('[migration-37] OK —', relPath, `(${batches.length} batch(es))`);
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }
  const pool = await sql.connect(config);
  try {
    for (const rel of SQL_FILES) {
      await runFile(pool, rel);
    }
    console.log('[migration-37] Done.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-37] Failed:', err.message);
  process.exit(1);
});
