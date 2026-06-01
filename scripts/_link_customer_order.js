process.env.TZ = 'Asia/Kolkata'
require('dotenv').config()
const { getPool } = require('../src/config/db')

const ORDER_NO = process.argv[2] || 'EW-ORD-2'
const CUSTOMER_NAME = process.argv[3] || 'Athira Merlin'

async function main () {
  const pool = await getPool()

  const before = await pool.request().input('ono', ORDER_NO).query(`
    SELECT o.order_id, o.order_no, o.customer_id, o.store_id, o.status, o.total_amount,
           c.full_name AS customer_name
    FROM dbo.pos_orders o
    LEFT JOIN dbo.pos_customers c ON c.customer_id = o.customer_id
    WHERE o.order_no = @ono
  `)
  if (!before.recordset.length) {
    console.error('Order not found:', ORDER_NO)
    process.exit(1)
  }
  console.log('Before:')
  console.table(before.recordset)

  const cust = await pool.request().input('name', `%${CUSTOMER_NAME}%`).query(`
    SELECT TOP 1 customer_id, full_name, phone, home_store_id
    FROM dbo.pos_customers
    WHERE full_name LIKE @name
    ORDER BY customer_id
  `)
  if (!cust.recordset.length) {
    console.error('Customer not found:', CUSTOMER_NAME)
    process.exit(1)
  }
  const customerId = cust.recordset[0].customer_id
  console.log('Linking to customer:')
  console.table(cust.recordset)

  const orderId = before.recordset[0].order_id
  await pool
    .request()
    .input('cid', customerId)
    .input('oid', orderId)
    .query(`
      UPDATE dbo.pos_orders
      SET customer_id = @cid
      WHERE order_id = @oid
    `)

  const oeExists = (
    await pool.request().query(`SELECT OBJECT_ID('dbo.oe_orders','U') AS oid`)
  ).recordset[0].oid
  if (oeExists) {
    await pool
      .request()
      .input('cid', customerId)
      .input('oid', orderId)
      .query(`
        UPDATE dbo.oe_orders
        SET customer_id = @cid
        WHERE legacy_pos_order_id = @oid OR order_id = @oid
      `)
  }

  const after = await pool.request().input('ono', ORDER_NO).query(`
    SELECT o.order_id, o.order_no, o.customer_id, c.full_name AS customer_name,
           o.store_id, st.store_name, o.status, o.total_amount, o.created_at
    FROM dbo.pos_orders o
    LEFT JOIN dbo.pos_customers c ON c.customer_id = o.customer_id
    LEFT JOIN dbo.stores st ON st.store_id = o.store_id
    WHERE o.order_no = @ono
  `)
  console.log('\nAfter:')
  console.table(after.recordset)
  console.log('Done — linked', ORDER_NO, 'to', CUSTOMER_NAME)
  process.exit(0)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})
