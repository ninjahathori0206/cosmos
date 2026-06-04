/**
 * Expire overdue store_visitors (IST expiry_at).
 * Usage: npm run gatepass:expire
 * Optional: GATEPASS_EXPIRE_STORE_ID=16 node scripts/gatepass-expire-visitors.js
 */
require('dotenv').config();
const sql = require('mssql');
const { executeStoredProcedure } = require('../src/config/db');

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
  const storeIdRaw = process.env.GATEPASS_EXPIRE_STORE_ID;
  const storeId = storeIdRaw != null && String(storeIdRaw).trim() !== ''
    ? Number(storeIdRaw)
    : null;

  await sql.connect(config);
  try {
    const result = await executeStoredProcedure('sp_gatepass_expire_visitors', {
      store_id: { type: sql.Int, value: Number.isFinite(storeId) ? storeId : null }
    });
    const row = (result.recordset || [])[0];
    const count = row && row.expired_count != null ? Number(row.expired_count) : 0;
    console.log('[gatepass:expire] Expired visitors:', count, storeId ? `(store ${storeId})` : '(all stores)');
  } finally {
    await sql.close();
  }
}

main().catch((err) => {
  console.error('[gatepass:expire]', err.message || err);
  process.exit(1);
});
