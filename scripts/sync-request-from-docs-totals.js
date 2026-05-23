/**
 * Sync request line dispatched/received from doc totals when SKU keys differ
 * (e.g. extra_lines dispatch). Usage: --request-id=17
 */
require('dotenv').config();
const sql = require('mssql');

const requestId = Number((/^--request-id=(\d+)$/.exec(process.argv[2]) || [])[1]);
if (!Number.isFinite(requestId) || requestId < 1) {
  console.error('Usage: node scripts/sync-request-from-docs-totals.js --request-id=N');
  process.exit(1);
}

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

async function main() {
  const pool = await sql.connect(config);
  const doc = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT ISNULL(SUM(dl.qty_sent), 0) AS sent, ISNULL(SUM(dl.qty_received), 0) AS recv
    FROM dbo.stock_transfer_docs d
    INNER JOIN dbo.stock_transfer_doc_lines dl ON dl.doc_id = d.doc_id
    WHERE d.source_request_id = @request_id
  `);
  const sent = Number(doc.recordset[0].sent) || 0;
  const recv = Number(doc.recordset[0].recv) || 0;
  if (sent < 1) {
    console.error('No shipped qty on docs for request', requestId);
    process.exit(1);
  }

  const lines = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT line_id, approved_qty, requested_qty FROM dbo.transfer_request_lines WHERE request_id = @request_id
  `);

  for (const row of lines.recordset) {
    const cap = (row.approved_qty != null && row.approved_qty > 0) ? row.approved_qty : row.requested_qty;
    await pool.request()
      .input('line_id', sql.Int, row.line_id)
      .input('approved_qty', sql.Int, null)
      .input('dispatched_qty', sql.Int, Math.min(cap, sent))
      .input('received_qty', sql.Int, Math.min(cap, recv))
      .execute('sp_TransferRequest_SetLineQty');
  }

  // Do not call sp_TransferRequest_SyncDispatchedFromDocs after totals sync — it matches by sku_id
  // and can zero dispatched_qty when extra_lines used a different SKU than the request line.

  await pool.request()
    .input('request_id', sql.Int, requestId)
    .input('status', sql.VarChar(20), 'DISPATCHED')
    .query(`
      UPDATE dbo.transfer_requests
      SET status = @status, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE request_id = @request_id AND status IN ('APPROVED', 'PARTIALLY_DISPATCHED')
    `);

  const header = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT request_id, status FROM dbo.transfer_requests WHERE request_id = @request_id
  `);
  const afterLines = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT line_id, dispatched_qty, received_qty FROM dbo.transfer_request_lines WHERE request_id = @request_id
  `);
  console.log('Header:', JSON.stringify(header.recordset[0]));
  console.log('Lines:', JSON.stringify(afterLines.recordset, null, 2));
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
