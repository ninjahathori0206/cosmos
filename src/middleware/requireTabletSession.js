'use strict'

const jwt = require('jsonwebtoken')
const sql = require('mssql')
const { executeStoredProcedure } = require('../config/db')
const {
  getJwtMinimumIssueEpochUnix,
  isTokenIssuedAtValid
} = require('../services/jwtPolicyService')

/**
 * Validates X-Tablet-Token (tablet JWT from POST /api/pos/tablet-login).
 * Sets req.tablet = { tablet_id, store_id, device_name? }.
 * Server checks tablets row (active + session_version) so deactivation / PIN reset ends the device session.
 */
async function requireTabletSession(req, res, next) {
  const token = req.header('X-Tablet-Token') || req.header('x-tablet-token')
  if (!token) {
    return res.status(401).json({ success: false, message: 'Tablet session required.' })
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    if (!decoded || !decoded.tablet_session) {
      return res.status(401).json({ success: false, message: 'Invalid tablet token.' })
    }
    const minIss = await getJwtMinimumIssueEpochUnix()
    if (!isTokenIssuedAtValid(decoded, minIss)) {
      return res.status(401).json({
        success: false,
        message: 'Tablet session ended. Unlock this tablet again with its PIN.'
      })
    }
    const tabletId = Number(decoded.tablet_id)
    const storeId = Number(decoded.store_id)
    const sessionVerRaw = decoded.tablet_session_version
    const sessionVersion =
      sessionVerRaw != null && String(sessionVerRaw).trim() !== ''
        ? Math.floor(Number(sessionVerRaw))
        : 0

    if (!Number.isFinite(tabletId) || !Number.isFinite(storeId)) {
      return res.status(401).json({ success: false, message: 'Invalid tablet token payload.' })
    }
    if (!Number.isFinite(sessionVersion) || sessionVersion < 0) {
      return res.status(401).json({ success: false, message: 'Invalid tablet token payload.' })
    }

    const valResult = await executeStoredProcedure('sp_POS_ValidateTabletSession', {
      tablet_id: { type: sql.Int, value: tabletId },
      store_id: { type: sql.Int, value: storeId },
      session_version: { type: sql.Int, value: sessionVersion }
    })
    const vrow = (valResult.recordset || [])[0]
    const ok = vrow && (vrow.is_valid === true || vrow.is_valid === 1 || Number(vrow.is_valid) === 1)
    if (!ok) {
      return res.status(401).json({
        success: false,
        message:
          'This tablet is no longer authorised. An admin may have removed it or reset its PIN in Tablet Management — unlock again with Tablet ID and PIN.'
      })
    }

    req.tablet = {
      tablet_id: tabletId,
      store_id: storeId,
      device_name: decoded.device_name != null ? String(decoded.device_name) : ''
    }
    return next()
  } catch (_e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired tablet session.' })
  }
}

module.exports = { requireTabletSession }
