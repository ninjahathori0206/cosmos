/**
 * Product types SSOT — label/description on pos_product_type_config; retire foundry lookup rows.
 * Usage: npm run migrate:56-product-types-ssot
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
  const file = path.join(__dirname, '..', 'sql', 'migrations', '56_product_types_ssot.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    const check = await pool.request().query(`
      SELECT COUNT(*) AS n FROM dbo.pos_product_type_config;
      SELECT COUNT(*) AS n FROM dbo.foundry_lookup_values WHERE lookup_type = N'product_type';
    `);
    const ptc = check.recordsets[0][0].n;
    const lv = check.recordsets[1][0].n;
    console.log('[migration-56] OK —', batches.length, 'batch(es).');
    console.log('[migration-56] pos_product_type_config rows:', ptc);
    console.log('[migration-56] foundry_lookup_values product_type rows (expect 0):', lv);
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[migration-56]', err.message || err);
  process.exit(1);
});
