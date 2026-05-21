/**
 * Verify sp_TransferRequest_SyncDispatchedFromDocs repairs simulated desync.
 * Usage: node scripts/verify-request-doc-sync.js --request-id=15
 */
require('dotenv').config();
const sql = require('mssql');
const { getPool } = require('../src/config/db');
const { executeStoredProcedure } = require('../src/config/db');

const requestId = Number((process.argv.find((a) => /^--request-id=/.test(a)) || '').split('=')[1]);

async function main() {
  if (!Number.isFinite(requestId) || requestId < 1) {
    console.error('Usage: node scripts/verify-request-doc-sync.js --request-id=15');
    process.exit(1);
  }

  const pool = await getPool();
  await pool.request().input('rid', sql.Int, requestId).query(`
    UPDATE dbo.transfer_requests SET status = N'APPROVED' WHERE request_id = @rid;
    UPDATE dbo.transfer_request_lines SET dispatched_qty = 0 WHERE request_id = @rid;
  `);

  const sync = await executeStoredProcedure('sp_TransferRequest_SyncDispatchedFromDocs', {
    request_id: { type: sql.Int, value: requestId }
  });
  const detail = await executeStoredProcedure('sp_TransferRequest_GetById', {
    request_id: { type: sql.Int, value: requestId }
  });
  const header = detail.recordsets[0][0];
  const lines = detail.recordsets[1];
  const docs = await executeStoredProcedure('sp_StockTransferDoc_List', {
    to_store_id: { type: sql.Int, value: null },
    status: { type: sql.VarChar(12), value: null },
    source_request_id: { type: sql.Int, value: requestId },
    top_n: { type: sql.Int, value: 10 }
  });

  const totalDisp = lines.reduce((s, l) => s + (Number(l.dispatched_qty) || 0), 0);
  const docCount = (docs.recordset || []).length;

  console.log('Sync status:', sync.recordset[0]);
  console.log('Header:', header.status, 'lines dispatched:', lines.map((l) => l.dispatched_qty));
  console.log('Linked docs:', docCount);

  if (docCount > 0 && header.status !== 'DISPATCHED' && header.status !== 'PARTIALLY_DISPATCHED') {
    console.error('FAIL: docs exist but header not dispatched');
    process.exit(1);
  }
  if (docCount > 0 && totalDisp < 1) {
    console.error('FAIL: docs exist but line dispatched_qty still zero');
    process.exit(1);
  }
  console.log('OK: request-doc sync verification passed');
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
