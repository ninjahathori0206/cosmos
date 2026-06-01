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
  for (const name of ['sp_PurchaseHeader_Create', 'sp_PurchaseHeader_ReplaceDraft']) {
    const r = await pool.request().query(`
      SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.${name}')) AS def
    `);
    const def = (r.recordset[0] && r.recordset[0].def) || '';
    console.log('\n===', name, '===');
    console.log('has reading_power:', /reading_power/i.test(def));
    const m = def.match(/INSERT INTO dbo\.purchase_item_colours[^;]+/i);
    if (m) console.log('INSERT:', m[0].slice(0, 200));
  }
  await pool.close();
})().catch(e => { console.error(e.message); process.exit(1); });
