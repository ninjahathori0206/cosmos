/** Deploy reading_power on sp_SKU_GetAll + sp_PurchaseHeader_GetSKUs for label {power} token */
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
function splitGoBatches(source) {
  return source.split(/^\s*GO\s*$/im).map((b) => b.trim()).filter(Boolean);
}
(async () => {
  const pool = await sql.connect(config);
  try {
    const file = path.join(__dirname, '..', 'sql/alter/64_label_reading_power.sql');
    for (const batch of splitGoBatches(fs.readFileSync(file, 'utf8'))) {
      await pool.request().query(batch);
    }
    console.log('[migration-64] OK — SKU procs include reading_power');
  } finally {
    await pool.close();
  }
})().catch((e) => { console.error('[migration-64] FAILED:', e.message); process.exit(1); });
