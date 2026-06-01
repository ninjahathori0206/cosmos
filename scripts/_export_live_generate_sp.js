require('dotenv').config();
const fs = require('fs');
const sql = require('mssql');
const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};
(async () => {
  const pool = await sql.connect(config);
  const r = await pool.request().query(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_SKUv2_Generate')) AS def`);
  const d = r.recordset[0].def || '';
  fs.writeFileSync('scripts/_live_sp_SKUv2_Generate.sql', d, 'utf8');
  console.log('written', d.length, 'chars');
  const cols = await pool.request().query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='purchase_items' ORDER BY ORDINAL_POSITION
  `);
  console.log('purchase_items cols:', cols.recordset.map(r => r.COLUMN_NAME).join(', '));
  await pool.close();
})().catch(e => { console.error(e); process.exit(1); });
