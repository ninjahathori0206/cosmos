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
