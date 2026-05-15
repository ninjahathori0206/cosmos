/**
 * Remaps legacy SKU GEN-OLD-STD + pid GEN-OLD-STD-P38 to four-segment sku_code / pid / barcode.
 *
 * Usage: npm run maintenance:fix-sku-gen-old-std-p38
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
    console.error('Missing DB_NAME or DB_USER in .env — cannot connect.');
    process.exit(1);
  }
  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'fix_sku_GEN_OLD_STD_P38_four_segment.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (let i = 0; i < batches.length; i += 1) {
      await pool.request().query(batches[i]);
    }
    console.log('[maintenance:fix-sku-gen-old-std-p38] OK — ran', batches.length, 'batch(es).');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[maintenance:fix-sku-gen-old-std-p38]', err.message || err);
  process.exit(1);
});
