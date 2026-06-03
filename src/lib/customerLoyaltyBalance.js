/**
 * Unified coin balance for Eyewoot Go + CX — loyalty_engine_v2 or legacy pos_points_ledger.
 */
const sql = require('mssql')
const { isLoyaltyEngineV2Enabled } = require('./loyaltyEngineFlag')

async function getCustomerCoinBalance (pool, customerId) {
  if (await isLoyaltyEngineV2Enabled(pool)) {
    const cxService = require('../services/cxService')
    const balance = await cxService.getLiveCoinBalance(pool, customerId)
    const settings = await cxService.getLoyaltySettings(pool)
    const rate = settings && settings.redemption_coins_per_rupee
      ? Number(settings.redemption_coins_per_rupee)
      : 10
    const safeRate = rate > 0 ? rate : 10
    return {
      balance,
      coin_redemption_rate: safeRate,
      rupee_value: Math.floor(balance / safeRate),
      engine: 'loyalty_ledger'
    }
  }

  const [balR, rateR] = await Promise.all([
    pool.request().input('cid', sql.Int, customerId).query(`
      SELECT TOP 1 balance_after AS balance
      FROM dbo.pos_points_ledger
      WHERE customer_id = @cid
      ORDER BY ledger_id DESC
    `),
    pool.request().query(`
      SELECT setting_value FROM dbo.app_settings WHERE setting_key = N'coin_redemption_rate'
    `)
  ])
  const balance = (balR.recordset[0] && balR.recordset[0].balance) || 0
  const rate = rateR.recordset[0] ? Number(rateR.recordset[0].setting_value) : 10
  const safeRate = rate > 0 ? rate : 10
  return {
    balance: Math.max(0, Number(balance) || 0),
    coin_redemption_rate: safeRate,
    rupee_value: Math.floor(Math.max(0, Number(balance) || 0) / safeRate),
    engine: 'pos_points_ledger'
  }
}

async function getCustomerCoinLedger (pool, customerId, limit = 20) {
  if (await isLoyaltyEngineV2Enabled(pool)) {
    const cxService = require('../services/cxService')
    const rows = await cxService.getCustomerLoyaltyLedger(pool, customerId, limit)
    return rows.map((r) => ({
      ledger_id: r.ledger_id,
      points_delta: r.coins_delta,
      balance_after: r.balance_after,
      reason: r.reason,
      created_at: r.created_at,
      order_id: r.order_id,
      order_no: r.order_no,
      status: r.status,
      entry_type: r.entry_type
    }))
  }

  const lim = Math.min(50, Math.max(1, limit))
  const ledgerR = await pool.request()
    .input('cid', sql.Int, customerId)
    .input('lim', sql.Int, lim)
    .query(`
    SELECT TOP (@lim) pl.ledger_id, pl.points_delta, pl.balance_after,
           pl.reason, pl.created_at, pl.order_id, o.order_no
    FROM dbo.pos_points_ledger pl
    LEFT JOIN dbo.pos_orders o ON o.order_id = pl.order_id
    WHERE pl.customer_id = @cid
    ORDER BY pl.ledger_id DESC
  `)
  return ledgerR.recordset || []
}

module.exports = { getCustomerCoinBalance, getCustomerCoinLedger }
