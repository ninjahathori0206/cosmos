/**
 * Inspect transfer request vs document linkage.
 * Usage: node scripts/inspect-transfer-request-doc.js --request-id=4
 *        node scripts/inspect-transfer-request-doc.js --doc-id=7
 */
require('dotenv').config();
const sql = require('mssql');
const { getPool } = require('../src/config/db');

const args = process.argv.slice(2);
const requestId = Number((args.find((a) => /^--request-id=/.test(a)) || '').split('=')[1]);
const docId = Number((args.find((a) => /^--doc-id=/.test(a)) || '').split('=')[1]);

async function main() {
  const pool = await getPool();

  if (Number.isFinite(docId)) {
    const doc = await pool.request().input('id', sql.Int, docId).query(`
      SELECT d.doc_id, d.source_request_id, d.status, d.notes, s.store_name
      FROM dbo.stock_transfer_docs d
      LEFT JOIN dbo.stores s ON s.store_id = d.to_store_id
      WHERE d.doc_id = @id
    `);
    const lines = await pool.request().input('id', sql.Int, docId).query(`
      SELECT dl.sku_id, sk.sku_code, dl.qty_sent
      FROM dbo.stock_transfer_doc_lines dl
      INNER JOIN dbo.skus sk ON sk.sku_id = dl.sku_id
      WHERE dl.doc_id = @id
    `);
    console.log('Document', doc.recordset[0]);
    console.log('Lines', lines.recordset);
    const total = lines.recordset.reduce((s, l) => s + Number(l.qty_sent || 0), 0);
    console.log('Total qty_sent:', total);
  }

  if (Number.isFinite(requestId)) {
    const hdr = await pool.request().input('rid', sql.Int, requestId).query(`
      SELECT tr.request_id, tr.status, s.store_name, tr.notes
      FROM dbo.transfer_requests tr
      INNER JOIN dbo.stores s ON s.store_id = tr.store_id
      WHERE tr.request_id = @rid
    `);
    const lines = await pool.request().input('rid', sql.Int, requestId).query(`
      SELECT line_id, sku_id, requested_qty, approved_qty, dispatched_qty
      FROM dbo.transfer_request_lines WHERE request_id = @rid
    `);
    console.log('Request', hdr.recordset[0]);
    console.log('Request lines', lines.recordset);
    const docs = await pool.request().input('rid', sql.Int, requestId).query(`
      SELECT d.doc_id, d.status, SUM(dl.qty_sent) AS total_sent
      FROM dbo.stock_transfer_docs d
      INNER JOIN dbo.stock_transfer_doc_lines dl ON dl.doc_id = d.doc_id
      WHERE d.source_request_id = @rid
      GROUP BY d.doc_id, d.status
    `);
    console.log('Linked docs', docs.recordset);
  }

  const ganesh = await pool.request().query(`
    SELECT TOP 15 tr.request_id, tr.status, s.store_name
    FROM dbo.transfer_requests tr
    INNER JOIN dbo.stores s ON s.store_id = tr.store_id
    WHERE s.store_name LIKE N'%Ganesh%'
    ORDER BY tr.request_id DESC
  `);
  console.log('Recent Ganesh requests:', ganesh.recordset);

  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
