require('dotenv').config();
const sql = require('mssql');
const config = { server: process.env.DB_HOST, port: Number(process.env.DB_PORT||1433), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, options: { encrypt: false, trustServerCertificate: true } };
(async () => {
  const p = await sql.connect(config);
  // Find the PK column name
  const cols = await p.request().query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='label_print_formats' ORDER BY ORDINAL_POSITION`);
  console.log('columns:', cols.recordset.map(r=>r.COLUMN_NAME).join(', '));
  const r = await p.request().query(`SELECT TOP 20 * FROM label_print_formats ORDER BY sort_order`);
  r.recordset.forEach(row => {
    const {zones, config, ...meta} = row;
    console.log(JSON.stringify(meta));
  });
  await p.close();
})().catch(e=>console.error(e.message));
