/**
 * Migration 83 — Foundry Unit Search (sp_SKU_UnitTraceByBarcode + RBAC seed)
 * Usage: npm run migrate:83-sku-unit-trace
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

async function runBatches(pool, filePath, label) {
  const batches = fs.readFileSync(filePath, 'utf8').split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  for (const batch of batches) await pool.request().query(batch);
  console.log(`[migration-83] OK — ${label}`);
}

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }
  const root = path.join(__dirname, '..');
  const pool = await sql.connect(config);
  try {
    await runBatches(pool, path.join(root, 'sql', 'sp', 'sku_unit_trace.sql'), 'sp_SKU_UnitTraceByBarcode deployed');
    await runBatches(pool, path.join(root, 'sql', 'migrations', '83_sku_unit_trace.sql'), 'foundry.units.trace permission seeded');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-83]', err.message || err);
  process.exit(1);
});
