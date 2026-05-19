/**
 * Migration 57: branding bypass matches brand_code; deploy sp_SKUv2_Generate from pipeline_v2.
 *
 * Usage: npm run migrate:57-sku-brand-code-prefix
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

async function runSqlFile(filePath) {
  const sql = require('mssql');
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }
  const source = fs.readFileSync(filePath, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('[migration-57] OK —', path.basename(filePath), batches.length, 'batch(es)');
  } finally {
    await pool.close();
  }
}

async function main() {
  const alter = path.join(__dirname, '..', 'sql', 'alter', '57_sku_brand_code_prefix.sql');
  await runSqlFile(alter);
  execSync('node scripts/deploy-sp-skuv2-generate-only.js', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
  console.log('[migration-57] sp_SKUv2_Generate deployed from pipeline_v2.sql');
}

main().catch((err) => {
  console.error('[migration-57]', err.message || err);
  process.exit(1);
});
