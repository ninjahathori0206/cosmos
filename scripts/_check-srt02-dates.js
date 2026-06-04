#!/usr/bin/env node
'use strict'
require('dotenv').config()
const sql = require('mssql')

function dbConfig() {
  return {
    server: process.env.DB_HOST || process.env.DB_SERVER || 'localhost',
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_ENCRYPT !== 'true'
    }
  }
}

async function main() {
  const pool = await sql.connect(dbConfig())
  const stores = await pool.request().query(`
    SELECT store_id, store_name, store_code
    FROM dbo.stores
    WHERE store_name LIKE N'%Jyoti%' OR store_code LIKE N'%SRT02%'
  `)
  console.log('stores', stores.recordset)

  const inv = await pool.request().query(`
    SELECT pi.invoice_no, pi.order_id, CONVERT(varchar(10), pi.created_at, 23) AS inv_ymd,
           CONVERT(varchar(10), o.created_at, 23) AS ord_ymd, o.store_id, o.order_no, o.total_amount, o.status
    FROM dbo.pos_invoices pi
    JOIN dbo.pos_orders o ON o.order_id = pi.order_id
    WHERE pi.invoice_no IN (N'EW-INV-2627-SRT02-00014', N'EW-INV-2627-SRT02-00016')
  `)
  console.log('invoices', inv.recordset)

  for (const row of stores.recordset || []) {
    const sid = row.store_id
    const r = await pool.request().input('sid', sql.Int, sid).query(`
      SELECT 'orders_jun' t, COUNT(*) c FROM dbo.pos_orders WHERE store_id=@sid AND CONVERT(date,created_at)='2026-06-01'
      UNION ALL SELECT 'orders_may', COUNT(*) FROM dbo.pos_orders WHERE store_id=@sid AND CONVERT(date,created_at)='2026-05-01'
      UNION ALL SELECT 'invoices_jun', COUNT(*) FROM dbo.pos_invoices pi JOIN dbo.pos_orders o ON o.order_id=pi.order_id WHERE o.store_id=@sid AND CONVERT(date,pi.created_at)='2026-06-01'
      UNION ALL SELECT 'invoices_may', COUNT(*) FROM dbo.pos_invoices pi JOIN dbo.pos_orders o ON o.order_id=pi.order_id WHERE o.store_id=@sid AND CONVERT(date,pi.created_at)='2026-05-01'
    `)
    console.log('counts store', sid, row.store_name, r.recordset)
  }

  const { executeStoredProcedure } = require('../src/config/db')
  for (const sid of (stores.recordset || []).map((s) => s.store_id)) {
    for (const d of ['2026-05-01', '2026-06-01']) {
      const r = await executeStoredProcedure('sp_StorePilot_DayStoreReport', {
        store_id: { type: sql.Int, value: sid },
        report_date: { type: sql.Date, value: d },
        engine_mode: { type: sql.NVarChar, value: 'legacy' }
      })
      const row = r.recordset[0]
      console.log('SP store', sid, d, {
        invoiced: row.invoiced_revenue,
        bills: row.bill_count,
        booking: row.booking_revenue,
        booking_count: row.booking_count
      })
    }
  }

  await pool.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
