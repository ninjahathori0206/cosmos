/**
 * Link OWN-OWNE-OWN-STD (or arg) to pos.customer_frame_sku_id and fix product_type if needed.
 * Usage: node scripts/_link_customer_frame_sku.js [sku_code]
 */
require('dotenv').config()
const sql = require('mssql')

const SKU_CODE = (process.argv[2] || 'OWN-OWNE-OWN-STD').trim()

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
}

async function main() {
  const pool = await sql.connect(config)
  const r = await pool.request()
    .input('code', sql.VarChar(100), SKU_CODE)
    .query(`
      SELECT sk.sku_id, sk.sku_code, sk.status, sk.sale_price,
             UPPER(LTRIM(RTRIM(pm.product_type))) AS product_type,
             pm.product_id
      FROM dbo.skus sk
      INNER JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      WHERE sk.sku_code = @code
    `)
  const row = r.recordset && r.recordset[0]
  if (!row) {
    console.error('SKU not found:', SKU_CODE)
    process.exit(1)
  }
  const skuId = Number(row.sku_id)
  const pt = String(row.product_type || '').trim().toUpperCase()
  if (pt !== 'CUSTOMER_FRAME') {
    await pool.request()
      .input('pid', sql.Int, row.product_id)
      .query(`
        UPDATE dbo.product_master
        SET product_type = N'CUSTOMER_FRAME'
        WHERE product_id = @pid
      `)
    console.log('Updated product_type to CUSTOMER_FRAME for product_id', row.product_id)
  }
  await pool.request()
    .input('val', sql.NVarChar(50), String(skuId))
    .query(`
      UPDATE dbo.app_settings
      SET setting_value = @val
      WHERE setting_key = N'pos.customer_frame_sku_id'
    `)
  console.log('Linked pos.customer_frame_sku_id =', skuId, '(' + row.sku_code + ', status=' + row.status + ')')
  await pool.close()
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
