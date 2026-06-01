require('dotenv').config();
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
  const r = await pool.request().query(`
    SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.sp_SKUv2_Generate')) AS def
  `);
  const d = (r.recordset[0] && r.recordset[0].def) || '';
  console.log('has powerPfx:', /powerPfx/i.test(d));
  console.log('has reading_power:', /reading_power/i.test(d));
  const idx = d.indexOf('@powerPfx');
  if (idx >= 0) console.log(d.slice(idx, idx + 350));
  await pool.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
