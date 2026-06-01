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
    SELECT TOP 10
      pic.colour_id, pic.item_id, pic.colour_name, pic.quantity,
      pic.reading_power, pi.header_id, pi.category, pi.product_master_id
    FROM dbo.purchase_item_colours pic
    JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
    WHERE pi.category = 'READERS'
    ORDER BY pic.colour_id DESC
  `);
  console.log(JSON.stringify(r.recordset, null, 2));
  await pool.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
