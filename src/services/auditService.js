'use strict';

const sql = require('mssql');
const { executeStoredProcedure } = require('../config/db');

/**
 * Append one row to dbo.audit_logs via sp_AuditLog_Write.
 * @param {object} opts
 * @param {number|null} opts.userId
 * @param {string} opts.action
 * @param {string} opts.module
 * @param {string} opts.entityType
 * @param {number|null} opts.entityId
 * @param {string|null} opts.oldValue
 * @param {string|null} opts.newValue
 * @param {string|null} opts.ipAddress
 */
async function writeAuditLog(opts) {
  const {
    userId = null,
    action,
    module,
    entityType,
    entityId = null,
    oldValue = null,
    newValue = null,
    ipAddress = null
  } = opts || {};
  await executeStoredProcedure('sp_AuditLog_Write', {
    user_id: { type: sql.Int, value: userId },
    action: { type: sql.VarChar(100), value: String(action || '').slice(0, 100) },
    module: { type: sql.VarChar(50), value: String(module || '').slice(0, 50) },
    entity_type: { type: sql.VarChar(100), value: String(entityType || '').slice(0, 100) },
    entity_id: { type: sql.Int, value: entityId },
    old_value: { type: sql.VarChar(500), value: oldValue != null ? String(oldValue).slice(0, 500) : null },
    new_value: { type: sql.VarChar(500), value: newValue != null ? String(newValue).slice(0, 500) : null },
    ip_address: { type: sql.VarChar(50), value: ipAddress != null ? String(ipAddress).slice(0, 50) : null }
  });
}

module.exports = { writeAuditLog };
