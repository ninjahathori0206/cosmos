/**
 * Inspect transfer request line quantities.
 * Usage: node scripts/inspect-transfer-request.js [request_id]
 */
require('dotenv').config();
const sql = require('mssql');

const requestId = Number(process.argv[2] || 1);

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }
  const pool = await sql.connect(config);
  const lines = await pool.request()
    .input('request_id', sql.Int, requestId)
    .query(`
      SELECT l.line_id, l.sku_id, sk.sku_code, l.requested_qty, l.approved_qty, l.dispatched_qty, l.received_qty
      FROM dbo.transfer_request_lines l
      JOIN dbo.skus sk ON sk.sku_id = l.sku_id
      WHERE l.request_id = @request_id
    `);
  const header = await pool.request()
    .input('request_id', sql.Int, requestId)
    .query('SELECT request_id, status, notes FROM dbo.transfer_requests WHERE request_id = @request_id');
  const docs = await pool.request()
    .input('request_id', sql.Int, requestId)
    .query(`
      SELECT d.doc_id, d.status, dl.sku_id, sk.sku_code, dl.qty_sent
      FROM dbo.stock_transfer_docs d
      JOIN dbo.stock_transfer_doc_lines dl ON dl.doc_id = d.doc_id
      JOIN dbo.skus sk ON sk.sku_id = dl.sku_id
      WHERE d.source_request_id = @request_id
    `);
  console.log('Header:', JSON.stringify(header.recordset[0], null, 2));
  console.log('Lines:', JSON.stringify(lines.recordset, null, 2));
  console.log('Transfer docs:', JSON.stringify(docs.recordset, null, 2));
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
