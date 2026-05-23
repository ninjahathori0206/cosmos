/**
 * Reject (cancel) an open goods request via sp_TransferRequest_UpdateStatus.
 * Usage:
 *   node scripts/reject-transfer-request.js --request-id=11 --notes="Cancelled per admin"
 */
require('dotenv').config();
const sql = require('mssql');

function parseArgs(argv) {
  const out = {};
  argv.forEach((a) => {
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) out[m[1]] = m[2];
  });
  return out;
}

const args = parseArgs(process.argv.slice(2));
const requestId = Number(args['request-id'] || args.requestId);
const notes = (args.notes || 'Cancelled per admin').trim();

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

async function resolveReviewerUserId(pool) {
  const fromEnv = Number(process.env.ADMIN_USER_ID);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  const r = await pool.request().query(`
    SELECT TOP 1 user_id
    FROM dbo.users
    WHERE is_active = 1 AND role_key = 'super_admin'
    ORDER BY user_id
  `);
  if (r.recordset[0]) return r.recordset[0].user_id;

  const fallback = await pool.request().query(`
    SELECT TOP 1 user_id FROM dbo.users WHERE is_active = 1 ORDER BY user_id
  `);
  if (!fallback.recordset[0]) {
    throw new Error('No active user found for reviewed_by; set ADMIN_USER_ID in .env');
  }
  return fallback.recordset[0].user_id;
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

  const header = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT request_id, status, store_id FROM dbo.transfer_requests WHERE request_id = @request_id
  `);
  if (!header.recordset.length) {
    console.error('Request not found:', requestId);
    process.exit(1);
  }

  const lines = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT line_id, dispatched_qty FROM dbo.transfer_request_lines WHERE request_id = @request_id
  `);
  const anyDispatched = lines.recordset.some((l) => Math.max(0, Number(l.dispatched_qty) || 0) > 0);
  if (anyDispatched) {
    console.error('Cannot reject: request has dispatched_qty > 0 on at least one line.');
    process.exit(1);
  }

  const cur = header.recordset[0];
  if (cur.status === 'REJECTED') {
    console.log('Request #' + requestId + ' is already REJECTED.');
    await pool.close();
    return;
  }
  if (!['SUBMITTED', 'APPROVED'].includes(cur.status)) {
    console.error('Cannot reject request in status:', cur.status);
    process.exit(1);
  }

  const userId = await resolveReviewerUserId(pool);
  await pool.request()
    .input('request_id', sql.Int, requestId)
    .input('status', sql.VarChar(20), 'REJECTED')
    .input('user_id', sql.Int, userId)
    .input('notes', sql.NVarChar(500), notes)
    .execute('sp_TransferRequest_UpdateStatus');

  const after = await pool.request().input('request_id', sql.Int, requestId).query(`
    SELECT request_id, status, reviewed_by, review_notes
    FROM dbo.transfer_requests WHERE request_id = @request_id
  `);

  console.log('Rejected request #' + requestId, JSON.stringify(after.recordset[0], null, 2));
  await pool.close();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
