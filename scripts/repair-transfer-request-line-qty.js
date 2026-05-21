/**
 * Repair transfer request line quantities (e.g. store meant 56 pcs but line shows 1).
 * Usage:
 *   node scripts/repair-transfer-request-line-qty.js --request-id=1 --requested=56
 *   node scripts/repair-transfer-request-line-qty.js --request-id=1 --sync-dispatched-only
 */
require('dotenv').config();
const sql = require('mssql');

function parseArgs(argv) {
  const out = {};
  argv.forEach((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
    else if (a === '--sync-dispatched-only') out.syncDispatchedOnly = true;
  });
  return out;
}

const args = parseArgs(process.argv.slice(2));
const requestId = Number(args['request-id'] || args.requestId);
const requestedQty = args.requested != null ? Number(args.requested) : null;
const approvedQty = args.approved != null ? Number(args.approved) : requestedQty;
const syncDispatchedOnly = !!args.syncDispatchedOnly;

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

async function syncDispatched(pool, rid) {
  try {
    await pool.request()
      .input('request_id', sql.Int, rid)
      .execute('sp_TransferRequest_SyncDispatchedFromDocs');
    return;
  } catch (e) {
    if (e.number !== 2812) throw e;
  }
  await pool.request().input('request_id', sql.Int, rid).query(`
    UPDATE l
    SET dispatched_qty = ISNULL(agg.total_sent, 0)
    FROM dbo.transfer_request_lines l
    LEFT JOIN (
      SELECT d.source_request_id AS request_id, dl.sku_id, SUM(dl.qty_sent) AS total_sent
      FROM dbo.stock_transfer_docs d
      INNER JOIN dbo.stock_transfer_doc_lines dl ON dl.doc_id = d.doc_id
      WHERE d.source_request_id = @request_id
      GROUP BY d.source_request_id, dl.sku_id
    ) agg ON agg.request_id = l.request_id AND agg.sku_id = l.sku_id
    WHERE l.request_id = @request_id
  `);
}

async function main() {
  if (!Number.isFinite(requestId) || requestId < 1) {
    console.error('Provide --request-id=N');
    process.exit(1);
  }
  if (!config.database || !config.user) {
    console.error('Missing DB_NAME or DB_USER in .env');
    process.exit(1);
  }

  const pool = await sql.connect(config);
  const before = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT line_id, sku_id, requested_qty, approved_qty, dispatched_qty
    FROM dbo.transfer_request_lines WHERE request_id = @request_id
  `);
  if (!before.recordset.length) {
    console.error('No lines for request', requestId);
    process.exit(1);
  }

  if (!syncDispatchedOnly) {
    if (!Number.isFinite(requestedQty) || requestedQty < 1) {
      console.error('Provide --requested=N (positive integer) unless --sync-dispatched-only');
      process.exit(1);
    }
    const appr = Number.isFinite(approvedQty) && approvedQty >= 0 ? approvedQty : requestedQty;
    for (const row of before.recordset) {
      await pool.request()
        .input('line_id', sql.Int, row.line_id)
        .input('requested_qty', sql.Int, requestedQty)
        .input('approved_qty', sql.Int, appr)
        .query(`
          UPDATE dbo.transfer_request_lines
          SET requested_qty = @requested_qty,
              approved_qty = @approved_qty
          WHERE line_id = @line_id
        `);
    }
  }

  await syncDispatched(pool, requestId);

  const header = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT request_id, status FROM dbo.transfer_requests WHERE request_id = @request_id
  `);
  const afterLines = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT line_id, requested_qty, approved_qty, dispatched_qty
    FROM dbo.transfer_request_lines WHERE request_id = @request_id
  `);

  const lines = afterLines.recordset;
  let newStatus = header.recordset[0].status;
  const allDone = lines.every((l) => {
    const cap = (l.approved_qty != null && l.approved_qty > 0) ? l.approved_qty : l.requested_qty;
    return (l.dispatched_qty || 0) >= cap;
  });
  const anyDisp = lines.some((l) => (l.dispatched_qty || 0) > 0);
  if (anyDisp && !allDone) newStatus = 'PARTIALLY_DISPATCHED';
  else if (anyDisp && allDone) newStatus = 'DISPATCHED';

  if (newStatus !== header.recordset[0].status) {
    await pool.request()
      .input('request_id', sql.Int, requestId)
      .input('status', sql.VarChar(20), newStatus)
      .query(`
        UPDATE dbo.transfer_requests
        SET status = @status,
            updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE request_id = @request_id
      `);
  }

  console.log('Before:', JSON.stringify(before.recordset, null, 2));
  console.log('After:', JSON.stringify(afterLines.recordset, null, 2));
  console.log('Header status:', header.recordset[0].status, '→', newStatus);
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
