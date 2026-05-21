/**
 * Relink a transfer document to the correct source_request_id, then sync request lines.
 * Usage: node scripts/relink-transfer-doc-request.js --doc-id=7 --request-id=5
 */
require('dotenv').config();
const sql = require('mssql');
const { getPool } = require('../src/config/db');

const args = process.argv.slice(2);
const docId = Number((args.find((a) => /^--doc-id=/.test(a)) || '').split('=')[1]);
const requestId = Number((args.find((a) => /^--request-id=/.test(a)) || '').split('=')[1]);

async function syncRequest(pool, rid) {
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

async function recomputeStatus(pool, rid) {
  const header = await pool.request().input('request_id', sql.Int, rid).query(`
    SELECT request_id, status FROM dbo.transfer_requests WHERE request_id = @request_id
  `);
  const lines = await pool.request().input('request_id', sql.Int, rid).query(`
    SELECT requested_qty, approved_qty, dispatched_qty FROM dbo.transfer_request_lines WHERE request_id = @request_id
  `);
  const rows = lines.recordset;
  let newStatus = header.recordset[0].status;
  const allDone = rows.every((l) => {
    const cap = (l.approved_qty != null && l.approved_qty > 0) ? l.approved_qty : l.requested_qty;
    return (l.dispatched_qty || 0) >= cap;
  });
  const anyDisp = rows.some((l) => (l.dispatched_qty || 0) > 0);
  if (anyDisp && !allDone) newStatus = 'PARTIALLY_DISPATCHED';
  else if (anyDisp && allDone) newStatus = 'DISPATCHED';
  else if (!anyDisp && ['PARTIALLY_DISPATCHED', 'DISPATCHED'].includes(newStatus)) newStatus = 'APPROVED';

  if (newStatus !== header.recordset[0].status) {
    await pool.request()
      .input('request_id', sql.Int, rid)
      .input('status', sql.VarChar(20), newStatus)
      .query(`
        UPDATE dbo.transfer_requests
        SET status = @status, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE request_id = @request_id
      `);
  }
  return { from: header.recordset[0].status, to: newStatus };
}

async function main() {
  if (!Number.isFinite(docId) || !Number.isFinite(requestId)) {
    console.error('Usage: node scripts/relink-transfer-doc-request.js --doc-id=7 --request-id=5');
    process.exit(1);
  }

  const pool = await getPool();
  const before = await pool.request().input('id', sql.Int, docId).query(`
    SELECT doc_id, source_request_id, notes FROM dbo.stock_transfer_docs WHERE doc_id = @id
  `);
  if (!before.recordset.length) {
    console.error('Doc not found:', docId);
    process.exit(1);
  }
  const oldReqId = before.recordset[0].source_request_id;
  console.log('Before relink:', before.recordset[0]);

  await pool.request()
    .input('id', sql.Int, docId)
    .input('rid', sql.Int, requestId)
    .query(`
      UPDATE dbo.stock_transfer_docs
      SET source_request_id = @rid,
          notes = N'Dispatched from transfer request #' + CAST(@rid AS NVARCHAR(20))
      WHERE doc_id = @id
    `);

  await syncRequest(pool, requestId);
  const st5 = await recomputeStatus(pool, requestId);
  console.log('Request', requestId, 'status:', st5);

  if (oldReqId && oldReqId !== requestId) {
    await syncRequest(pool, oldReqId);
    const stOld = await recomputeStatus(pool, oldReqId);
    console.log('Request', oldReqId, 'status (after doc moved):', stOld);
  }

  const after = await pool.request().input('rid', sql.Int, requestId).query(`
    SELECT l.line_id, sk.sku_code, l.requested_qty, l.approved_qty, l.dispatched_qty, tr.status
    FROM dbo.transfer_request_lines l
    INNER JOIN dbo.transfer_requests tr ON tr.request_id = l.request_id
    INNER JOIN dbo.skus sk ON sk.sku_id = l.sku_id
    WHERE l.request_id = @rid
  `);
  console.log('Request 5 after:', after.recordset);
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
