/**
 * CX Customer 360 — stored procedure data layer (new domains only).
 */
const sql = require('mssql')

async function execSp (pool, procName, inputs = {}) {
  const req = pool.request()
  for (const [key, val] of Object.entries(inputs)) {
    if (val === undefined) continue
    req.input(key, val)
  }
  const result = await req.execute(procName)
  return result
}

async function getLoyaltySettings (pool) {
  const r = await execSp(pool, 'usp_cx_GetLoyaltySettings')
  return (r.recordset && r.recordset[0]) || null
}

async function getCustomer360Header (pool, customerId) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .execute('usp_cx_GetCustomer360Header')
  return (r.recordset && r.recordset[0]) || null
}

async function getCustomerProfile (pool, customerId) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .execute('usp_cx_GetCustomerProfile')
  return (r.recordset && r.recordset[0]) || null
}

async function getCustomerLifestyle (pool, customerId) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .execute('usp_cx_GetCustomerLifestyle')
  return (r.recordset && r.recordset[0]) || null
}

async function getCustomerLoyaltyLedger (pool, customerId, limit = 50) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .input('limit', sql.Int, limit)
    .execute('usp_cx_GetCustomerLoyaltyLedger')
  return r.recordset || []
}

async function getLiveCoinBalance (pool, customerId) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .execute('usp_cx_GetLiveCoinBalance')
  const row = r.recordset && r.recordset[0]
  return row ? Number(row.live_balance) || 0 : 0
}

async function getCustomerOfferAssignments (pool, customerId, activeOnly = true) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .input('active_only', sql.Bit, activeOnly ? 1 : 0)
    .execute('usp_cx_GetCustomerOfferAssignments')
  return r.recordset || []
}

async function getCustomerAuditLog (pool, customerId, limit = 100) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .input('limit', sql.Int, limit)
    .execute('usp_cx_GetCustomerAuditLog')
  return r.recordset || []
}

async function getCustomerVisits (pool, customerId, limit = 50) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .input('limit', sql.Int, limit)
    .execute('usp_cx_GetCustomerVisits')
  return r.recordset || []
}

async function getCustomerEyeTests (pool, customerId, limit = 30) {
  const r = await pool.request()
    .input('customer_id', sql.Int, customerId)
    .input('limit', sql.Int, limit)
    .execute('usp_cx_GetCustomerEyeTests')
  return r.recordset || []
}

async function listCustomerFamilyNameRows (pool, customerId) {
  const r = await pool.request().input('cid', sql.Int, customerId).query(`
    SELECT family_name_id, family_name
    FROM dbo.pos_customer_family_names
    WHERE customer_id = @cid
    ORDER BY family_name ASC
  `)
  return r.recordset || []
}

async function getVisitorRowForRx (pool, visitorId) {
  const r = await pool.request().input('vid', sql.Int, visitorId).query(`
    SELECT visitor_id, name, phone, customer_id, store_id
    FROM dbo.store_visitors
    WHERE visitor_id = @vid
  `)
  return (r.recordset && r.recordset[0]) || null
}

/**
 * Staff Rx insert — customer_id optional when visitor_id set (walk-in at GatePass).
 */
async function insertStaffEyeTest (pool, payload) {
  const customerId =
    payload.customerId != null && Number(payload.customerId) > 0
      ? Number(payload.customerId)
      : null
  const visitorId =
    payload.visitorId != null && Number(payload.visitorId) > 0
      ? Number(payload.visitorId)
      : null
  if (!customerId && !visitorId) {
    throw new Error('customer_id or visitor_id required for Rx.')
  }
  const familyNameId =
    payload.familyNameId != null && Number(payload.familyNameId) > 0
      ? Number(payload.familyNameId)
      : null
  if (familyNameId && !customerId) {
    throw new Error('family_name_id requires a linked customer.')
  }

  const r = await pool.request()
    .input('cid', sql.Int, customerId)
    .input('visitor_id', sql.Int, visitorId)
    .input('family_name_id', sql.Int, familyNameId)
    .input('patient_name', sql.NVarChar(100), payload.patientName ?? null)
    .input('uid', sql.Int, payload.actorUserId ?? null)
    .input('sid', sql.Int, payload.storeId ?? null)
    .input('tested_at', sql.DateTime, payload.testedAt)
    .input('re_sph', sql.Decimal(5, 2), payload.reSph ?? null)
    .input('re_cyl', sql.Decimal(5, 2), payload.reCyl ?? null)
    .input('re_axis', sql.Int, payload.reAxis ?? null)
    .input('re_add', sql.Decimal(5, 2), payload.reAdd ?? null)
    .input('re_va', sql.NVarChar(10), payload.reVa ?? null)
    .input('le_sph', sql.Decimal(5, 2), payload.leSph ?? null)
    .input('le_cyl', sql.Decimal(5, 2), payload.leCyl ?? null)
    .input('le_axis', sql.Int, payload.leAxis ?? null)
    .input('le_add', sql.Decimal(5, 2), payload.leAdd ?? null)
    .input('le_va', sql.NVarChar(10), payload.leVa ?? null)
    .input('pd', sql.Decimal(5, 2), payload.pd ?? null)
    .input('lens_type', sql.NVarChar(50), payload.lensType ?? null)
    .input('notes', sql.NVarChar(500), payload.notes ?? null)
    .query(`
      INSERT INTO dbo.eye_tests
        (customer_id, visitor_id, family_name_id, patient_name,
         tested_at, store_id, tested_by_user_id, source,
         re_sph, re_cyl, re_axis, re_add, re_va,
         le_sph, le_cyl, le_axis, le_add, le_va,
         pd, lens_type, notes)
      OUTPUT INSERTED.test_id
      VALUES
        (@cid, @visitor_id, @family_name_id, @patient_name,
         @tested_at, @sid, @uid, N'STAFF',
         @re_sph, @re_cyl, @re_axis, @re_add, @re_va,
         @le_sph, @le_cyl, @le_axis, @le_add, @le_va,
         @pd, @lens_type, @notes)
    `)
  return (r.recordset && r.recordset[0]) || null
}

async function updateCustomerProfile (pool, payload) {
  const r = await pool.request()
    .input('customer_id', sql.Int, payload.customerId)
    .input('full_name', sql.NVarChar(200), payload.fullName ?? null)
    .input('email', sql.NVarChar(200), payload.email ?? null)
    .input('dob', sql.Date, payload.dob ?? null)
    .input('actor_user_id', sql.Int, payload.actorUserId ?? null)
    .execute('usp_cx_UpdateCustomerProfile')
  return (r.recordset && r.recordset[0]) || null
}

async function upsertRxModalLifestyle (pool, customerId, lifestyle, actorUserId) {
  const lif = lifestyle || {}
  const workingList = Array.isArray(lif.working_conditions) ? lif.working_conditions : []
  const notesObj = {
    working_conditions: workingList,
    diabetes: !!lif.diabetes,
    hypertension: !!lif.hypertension,
    eye_surgery: !!lif.eye_surgery,
    family_eye_history: lif.family_eye_history != null ? String(lif.family_eye_history).trim() || null : null,
    has_spectacles: !!lif.has_spectacles
  }
  return upsertCustomerLifestyle(pool, {
    customerId,
    screenHrs: lif.screen_hrs ?? null,
    framePref: workingList.length ? workingList.join(', ') : null,
    budgetMin: null,
    budgetMax: null,
    notes: JSON.stringify(notesObj),
    actorUserId
  })
}

async function upsertCustomerLifestyle (pool, payload) {
  const r = await pool.request()
    .input('customer_id', sql.Int, payload.customerId)
    .input('screen_hrs', sql.NVarChar(50), payload.screenHrs ?? null)
    .input('frame_pref', sql.NVarChar(100), payload.framePref ?? null)
    .input('budget_min', sql.Int, payload.budgetMin ?? null)
    .input('budget_max', sql.Int, payload.budgetMax ?? null)
    .input('notes', sql.NVarChar(500), payload.notes ?? null)
    .input('actor_user_id', sql.Int, payload.actorUserId ?? null)
    .execute('usp_cx_UpsertCustomerLifestyle')
  const row = (r.recordset && r.recordset[0]) || null
  if (row) {
    const prefs = JSON.stringify({
      screen_hrs: row.screen_hrs ?? null,
      frame_pref: row.frame_pref ?? null,
      budget_min: row.budget_min ?? null,
      budget_max: row.budget_max ?? null
    })
    await pool.request()
      .input('cid', sql.Int, payload.customerId)
      .input('prefs', sql.NVarChar(sql.MAX), prefs)
      .query(`
        UPDATE dbo.pos_customers SET lifestyle_prefs = @prefs WHERE customer_id = @cid
      `)
  }
  return row
}

async function assignCustomerOffer (pool, payload) {
  const r = await pool.request()
    .input('customer_id', sql.Int, payload.customerId)
    .input('offer_id', sql.Int, payload.offerId)
    .input('notes', sql.NVarChar(500), payload.notes ?? null)
    .input('actor_user_id', sql.Int, payload.actorUserId ?? null)
    .execute('usp_cx_AssignCustomerOffer')
  return (r.recordset && r.recordset[0]) || null
}

async function revokeCustomerOffer (pool, assignmentId, actorUserId) {
  const r = await pool.request()
    .input('assignment_id', sql.Int, assignmentId)
    .input('actor_user_id', sql.Int, actorUserId ?? null)
    .execute('usp_cx_RevokeCustomerOffer')
  return (r.recordset && r.recordset[0]) || null
}

async function manualLoyaltyAdjustment (pool, payload) {
  const r = await pool.request()
    .input('customer_id', sql.Int, payload.customerId)
    .input('coins_delta', sql.Int, payload.coinsDelta)
    .input('reason', sql.NVarChar(200), payload.reason)
    .input('actor_user_id', sql.Int, payload.actorUserId ?? null)
    .execute('usp_cx_ManualLoyaltyAdjustment')
  return (r.recordset && r.recordset[0]) || null
}

async function updateLoyaltySettings (pool, payload) {
  const r = await pool.request()
    .input('earn_percent', sql.Decimal(5, 2), payload.earnPercent ?? null)
    .input('credit_delay_days', sql.Int, payload.creditDelayDays ?? null)
    .input('redemption_coins_per_rupee', sql.Int, payload.redemptionCoinsPerRupee ?? null)
    .input('max_redeem_percent_of_bill', sql.Decimal(5, 2), payload.maxRedeemPercentOfBill ?? null)
    .input('actor_user_id', sql.Int, payload.actorUserId ?? null)
    .execute('usp_cx_UpdateLoyaltySettings')
  return (r.recordset && r.recordset[0]) || null
}

async function scheduleLoyaltyCredit (pool, payload) {
  const r = await pool.request()
    .input('purchaser_customer_id', sql.Int, payload.purchaserCustomerId)
    .input('order_id', sql.Int, payload.orderId)
    .input('invoice_id', sql.Int, payload.invoiceId ?? null)
    .input('invoice_total', sql.Decimal(12, 2), payload.invoiceTotal)
    .input('actor_user_id', sql.Int, payload.actorUserId ?? null)
    .execute('usp_cx_ScheduleLoyaltyCredit')
  return (r.recordset && r.recordset[0]) || null
}

async function processPendingLoyalty (pool) {
  const r = await pool.request().execute('usp_cx_ProcessPendingLoyalty')
  return (r.recordset && r.recordset[0]) || { rows_promoted: 0 }
}

async function redeemLoyaltyCoins (pool, payload) {
  const r = await pool.request()
    .input('customer_id', sql.Int, payload.customerId)
    .input('order_id', sql.Int, payload.orderId)
    .input('coins_to_redeem', sql.Int, payload.coinsToRedeem)
    .input('reason', sql.NVarChar(200), payload.reason ?? null)
    .input('actor_user_id', sql.Int, payload.actorUserId ?? null)
    .execute('usp_cx_RedeemLoyaltyCoins')
  return (r.recordset && r.recordset[0]) || null
}

module.exports = {
  getLoyaltySettings,
  getCustomer360Header,
  getCustomerProfile,
  getCustomerLifestyle,
  getCustomerLoyaltyLedger,
  getLiveCoinBalance,
  getCustomerOfferAssignments,
  getCustomerAuditLog,
  getCustomerVisits,
  getCustomerEyeTests,
  listCustomerFamilyNameRows,
  getVisitorRowForRx,
  insertStaffEyeTest,
  upsertRxModalLifestyle,
  updateCustomerProfile,
  upsertCustomerLifestyle,
  assignCustomerOffer,
  revokeCustomerOffer,
  manualLoyaltyAdjustment,
  updateLoyaltySettings,
  scheduleLoyaltyCredit,
  processPendingLoyalty,
  redeemLoyaltyCoins
}
