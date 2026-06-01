/**
 * Apply canonical pos_lab_transitions (migration 55 step 2 + optional FRAME remap).
 * Usage: node scripts/_run_migration_55_lab_transitions.js
 */
require('dotenv').config()
const { getPool } = require('../src/config/db')
const sql = require('mssql')

async function main() {
  const pool = await getPool()

  console.log('Remapping FRAME_* lab sub-orders to LAB_FITTING (if any)...')
  await pool.request().query(`
    IF OBJECT_ID('dbo.pos_sub_orders', 'U') IS NOT NULL
    BEGIN
      IF OBJECT_ID('dbo.pos_order_status_log', 'U') IS NOT NULL
      BEGIN
        INSERT INTO dbo.pos_order_status_log (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
        SELECT so.order_id, so.sub_order_id, so.lab_workflow_status, N'LAB_FITTING', NULL,
               N'Migration 55: FRAME_* remap → LAB_FITTING'
        FROM dbo.pos_sub_orders so
        WHERE so.fulfillment = N'LAB' AND so.lab_workflow_status IN (
          N'FRAME_PENDING_LENS_BACKORDER', N'FRAME_RECEIVED_LENS_BACKORDER', N'FRAME_AND_LENS_RECEIVED'
        );
      END;
      UPDATE dbo.pos_sub_orders
      SET lab_workflow_status = N'LAB_FITTING'
      WHERE fulfillment = N'LAB' AND lab_workflow_status IN (
        N'FRAME_PENDING_LENS_BACKORDER', N'FRAME_RECEIVED_LENS_BACKORDER', N'FRAME_AND_LENS_RECEIVED'
      );
    END;
  `)

  console.log('Replacing pos_lab_transitions with canonical set...')
  await pool.request().query(`DELETE FROM dbo.pos_lab_transitions`)

  await pool.request().query(`
    INSERT INTO dbo.pos_lab_transitions (from_status, to_status, actor_role, requires_note) VALUES
      (N'ORDER_PLACED',        N'ADVANCE_PAID',         N'store_in_charge', 0),
      (N'ADVANCE_PAID',        N'SENT_TO_LAB',          N'store_in_charge', 0),
      (N'DISPATCHED_TO_STORE', N'RECEIVED_AT_STORE',    N'store_in_charge', 0),
      (N'RECEIVED_AT_STORE',   N'STORE_QC_PASS',        N'store_in_charge', 0),
      (N'RECEIVED_AT_STORE',   N'STORE_QC_PARTIAL',     N'store_in_charge', 1),
      (N'RECEIVED_AT_STORE',   N'QC_FAIL_STORE',        N'store_in_charge', 1),
      (N'QC_FAIL_STORE',       N'SENT_TO_LAB',          N'store_in_charge', 0),
      (N'STORE_QC_PASS',       N'READY_FOR_DELIVERY',   N'store_staff',     0),
      (N'STORE_QC_PARTIAL',    N'READY_FOR_DELIVERY',   N'store_staff',     0),
      (N'SENT_TO_LAB',         N'LAB_FITTING',          N'hq_manager',      0),
      (N'LAB_FITTING',         N'QC_PASS',              N'hq_manager',      0),
      (N'LAB_FITTING',         N'QC_FAIL_LAB',          N'hq_manager',      1),
      (N'QC_FAIL_LAB',         N'LAB_FITTING',          N'hq_manager',      0),
      (N'QC_PASS',             N'DISPATCHED_TO_STORE',  N'hq_manager',      0)
  `)

  const cnt = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.pos_lab_transitions`)
  const n = cnt.recordset && cnt.recordset[0] ? Number(cnt.recordset[0].n) : 0
  console.log('pos_lab_transitions row count:', n)

  const v = await pool.request().query(`
    SELECT from_status, to_status, actor_role
    FROM dbo.pos_lab_transitions
    WHERE from_status = N'SENT_TO_LAB' AND to_status = N'LAB_FITTING'
    ORDER BY actor_role
  `)
  console.log('SENT_TO_LAB -> LAB_FITTING:')
  console.log(JSON.stringify(v.recordset, null, 2))

  const test = await pool.request()
    .input('from_status', sql.VarChar(30), 'SENT_TO_LAB')
    .input('to_status', sql.VarChar(30), 'LAB_FITTING')
    .input('actor_role', sql.VarChar(50), 'hq_manager')
    .execute('dbo.sp_POS_ValidateLabTransition')
  const row = test.recordset && test.recordset[0]
  const ok = row && Number(row.transition_count) > 0
  if (!ok) {
    console.error('SP validation still fails for hq_manager')
    process.exit(1)
  }
  console.log('OK: sp_POS_ValidateLabTransition allows SENT_TO_LAB -> LAB_FITTING for hq_manager')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
