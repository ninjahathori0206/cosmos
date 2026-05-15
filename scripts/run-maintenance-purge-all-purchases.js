/**
 * Purges all purchase pipeline rows + purchase-linked SKUs; reseeds purchase header IDENTITY.
 *
 * Usage:
 *   COSMOS_PURGE_CONFIRM=I_UNDERSTAND npm run maintenance:purge-all-purchases
 *
 * PowerShell:
 *   $env:COSMOS_PURGE_CONFIRM='I_UNDERSTAND'; npm run maintenance:purge-all-purchases
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
  if (process.env.COSMOS_PURGE_CONFIRM !== 'I_UNDERSTAND') {
    console.error(
      'Refusing to run. Set COSMOS_PURGE_CONFIRM=I_UNDERSTAND to delete all purchases and reseed IDs.'
    );
    process.exit(1);
  }
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }

  const file = path.join(__dirname, '..', 'sql', 'maintenance', 'purge_all_purchases_full_reset.sql');
  const source = fs.readFileSync(file, 'utf8');
  const batches = source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
  const pool = await sql.connect(config);
  try {
    for (let i = 0; i < batches.length; i += 1) {
      const result = await pool.request().query(batches[i]);
      if (result.recordset && result.recordset.length) {
        console.log('[purge-purchases] Result:', result.recordset[0]);
      }
    }
    console.log('[purge-purchases] OK — all purchases removed; next header_id will be 1 (barcode suffix -P1).');
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[purge-purchases]', err.message || err);
  process.exit(1);
});
