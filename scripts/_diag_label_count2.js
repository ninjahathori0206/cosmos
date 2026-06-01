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
  for (const hid of [6, 7]) {
    console.log('\n=== HEADER', hid, '===');
    const items = await pool.request().input('hid', sql.Int, hid).query(`
      SELECT pi.item_id, pi.quantity, pi.category, pm.ew_collection, pm.style_model
      FROM purchase_items pi JOIN product_master pm ON pm.product_id = pi.product_master_id
      WHERE pi.header_id = @hid ORDER BY pi.item_id`);
    console.log('items:', items.recordset);
    const sum = items.recordset.reduce((s, r) => s + Number(r.quantity), 0);
    console.log('sum item qty', sum);

    const getSkus = await pool.request().input('hid', sql.Int, hid).query('EXEC dbo.sp_PurchaseHeader_GetSKUs @header_id=@hid');
    console.log('GetSKUs count', getSkus.recordset.length, getSkus.recordset.map(r => ({ sku_id: r.sku_id, sku_code: r.sku_code, colour_qty: r.quantity, is_restock: r.is_restock })));

    const units = await pool.request().input('hid', sql.Int, hid).query(`
      SELECT sk.sku_id, sk.sku_code, sk.quantity AS sku_qty, pic.quantity AS colour_qty,
        COUNT(u.unit_id) AS unit_count
      FROM skus sk
      LEFT JOIN purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
      LEFT JOIN sku_units u ON u.sku_id = sk.sku_id
      WHERE sk.header_id = @hid
      GROUP BY sk.sku_id, sk.sku_code, sk.quantity, pic.quantity
    `);
    console.table(units.recordset);
    console.log('total units', units.recordset.reduce((s,r)=>s+Number(r.unit_count),0));
  }
  await pool.close();
})();
