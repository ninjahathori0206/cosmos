'use strict'
/**
 * Cancel a DISPATCHED transfer document: restore WH stock, revert units, delete doc.
 * Usage: node scripts/_cancel-transfer-doc.js <doc_id>
 */
require('dotenv').config()
const sql = require('mssql')

const docId = Number(process.argv[2])
if (!Number.isFinite(docId) || docId < 1) {
  console.error('Usage: node scripts/_cancel-transfer-doc.js <doc_id>')
  process.exit(1)
}

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
  const tx = new sql.Transaction(pool)
  await tx.begin()
  try {
    const req = new sql.Request(tx)
    req.input('doc_id', sql.Int, docId)
    const head = await req.query(`
      SELECT doc_id, status, to_store_id, source_request_id
      FROM dbo.stock_transfer_docs
      WHERE doc_id = @doc_id
    `)
    const doc = head.recordset && head.recordset[0]
    if (!doc) throw new Error('Document not found')
    if (doc.status !== 'DISPATCHED') {
      throw new Error('Only DISPATCHED documents can be cancelled (status: ' + doc.status + ')')
    }

    const whRes = await new sql.Request(tx).query(`
      SELECT dbo.fn_Foundry_PrimaryWarehouseLocationId() AS wh_id
    `)
    const whId = whRes.recordset[0].wh_id
    if (!whId) throw new Error('Primary warehouse not configured')

    const linesRes = await new sql.Request(tx)
      .input('doc_id', sql.Int, docId)
      .query(`
        SELECT line_id, sku_id, qty_sent
        FROM dbo.stock_transfer_doc_lines
        WHERE doc_id = @doc_id
      `)
    const lines = linesRes.recordset || []

    for (const line of lines) {
      await new sql.Request(tx)
        .input('sku_id', sql.Int, line.sku_id)
        .input('qty', sql.Int, line.qty_sent)
        .input('wh_id', sql.Int, whId)
        .query(`
          UPDATE dbo.stock_balances
          SET qty = qty + @qty,
              last_updated = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE sku_id = @sku_id
            AND location_type = N'WAREHOUSE'
            AND location_id = @wh_id
        `)
    }

    await new sql.Request(tx)
      .input('doc_id', sql.Int, docId)
      .input('wh_id', sql.Int, whId)
      .input('to_store_id', sql.Int, doc.to_store_id)
      .query(`
        UPDATE u
        SET
          u.status = N'AVAILABLE',
          u.location_type = N'WAREHOUSE',
          u.location_id = @wh_id
        FROM dbo.sku_units u
        INNER JOIN dbo.stock_transfer_doc_units du ON du.unit_id = u.unit_id
        WHERE du.doc_id = @doc_id
          AND u.status = N'IN_TRANSIT'
          AND u.location_type = N'IN_TRANSIT'
          AND u.location_id = @to_store_id
      `)

    await new sql.Request(tx)
      .input('doc_id', sql.Int, docId)
      .query(`DELETE FROM dbo.stock_transfer_docs WHERE doc_id = @doc_id`)

    await tx.commit()
    console.log('[cancel-transfer-doc] OK — cancelled doc', docId, 'lines:', lines.length, 'WH restored')
  } catch (err) {
    await tx.rollback()
    throw err
  } finally {
    await pool.close()
  }
}

main().catch((err) => {
  console.error('[cancel-transfer-doc]', err.message || err)
  process.exit(1)
})
