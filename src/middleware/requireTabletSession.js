'use strict';

const jwt = require('jsonwebtoken');

/**
 * Validates X-Tablet-Token (tablet JWT from POST /api/pos/tablet-login).
 * Sets req.tablet = { tablet_id, store_id, device_name? }.
 */
function requireTabletSession(req, res, next) {
  const token = req.header('X-Tablet-Token') || req.header('x-tablet-token');
  if (!token) {
    return res.status(401).json({ success: false, message: 'Tablet session required.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.tablet_session) {
      return res.status(401).json({ success: false, message: 'Invalid tablet token.' });
    }
    req.tablet = {
      tablet_id: Number(decoded.tablet_id),
      store_id: Number(decoded.store_id),
      device_name: decoded.device_name != null ? String(decoded.device_name) : ''
    };
    if (!Number.isFinite(req.tablet.tablet_id) || !Number.isFinite(req.tablet.store_id)) {
      return res.status(401).json({ success: false, message: 'Invalid tablet token payload.' });
    }
    return next();
  } catch (_e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired tablet session.' });
  }
}

module.exports = { requireTabletSession };
