/**
 * Preview (and optionally apply) remap of GEN-* sku_code rows when a home brand can be resolved.
 * Edit sql/maintenance/remap_gen_sku_prefix_from_home_brand.sql to uncomment UPDATE after preview.
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
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'remap_gen_sku_prefix_from_home_brand.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) {
      const result = await pool.request().query(batch);
      if (result.recordset && result.recordset.length) {
        console.table(result.recordset);
      }
    }
    console.log('[maintenance:remap-gen-sku-prefix] Done.');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[maintenance:remap-gen-sku-prefix]', err.message || err);
  process.exit(1);
});
