'use strict'

const { getLabWorkflowTransition, normLabStatus } = require('../config/labWorkflowTransitionsCatalog')

/**
 * Normalize JWT permission list to lowercase strings.
 * @param {string[]|undefined} permissions
 * @returns {string[]}
 */
function normPermissionList(permissions) {
  if (!Array.isArray(permissions)) return []
  return permissions.map((x) => String(x).toLowerCase())
}

/**
 * @param {string[]|undefined} permissions
 * @param {string} permissionKey
 * @returns {boolean}
 */
function hasLabPermission(permissions, permissionKey) {
  const key = String(permissionKey || '').toLowerCase()
  if (!key) return false
  return normPermissionList(permissions).includes(key)
}

/** JWT lists any granular lab permission — when false, legacy module-only access applies. */
function callerHasGranularLabPermissions(permissions) {
  return normPermissionList(permissions).some((p) =>
    p.startsWith('foundry.lab.')
    || p.startsWith('storepilot.lab.')
    || p === 'pos.lab.workflow'
  )
}

/**
 * Caller may apply this transition if they hold any required permission from the catalogue.
 * @param {{ permissions?: string[], isSuperAdmin?: boolean }} caller
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {{ requires_note: boolean }}
 */
function assertLabTransitionAllowed(caller, fromStatus, toStatus) {
  const from = normLabStatus(fromStatus)
  const to = normLabStatus(toStatus)
  const row = getLabWorkflowTransition(from, to)
  if (!row) {
    const err = new Error(`Lab transition not defined: ${from} → ${to}`)
    err.statusCode = 400
    throw err
  }
  if (caller && caller.isSuperAdmin) {
    return { requires_note: !!row.requires_note }
  }
  const perms = normPermissionList(caller && caller.permissions)
  if (!callerHasGranularLabPermissions(perms)) {
    return { requires_note: !!row.requires_note }
  }
  const ok = row.required_permissions.some((p) => hasLabPermission(perms, p))
  if (!ok) {
    const err = new Error(
      `Permission denied for lab transition ${from} → ${to}. `
      + `Assign one of: ${row.required_permissions.join(', ')}`
    )
    err.statusCode = 403
    throw err
  }
  return { requires_note: !!row.requires_note }
}

/**
 * Build from Express req for route handlers.
 * @param {import('express').Request} req
 * @param {() => boolean} isSuperAdminFn
 * @returns {{ permissions: string[], isSuperAdmin: boolean }}
 */
function labCallerFromReq(req, isSuperAdminFn) {
  const perms = req.user && Array.isArray(req.user.permissions) ? req.user.permissions : []
  return {
    permissions: perms,
    isSuperAdmin: typeof isSuperAdminFn === 'function' ? isSuperAdminFn(req) : false
  }
}

module.exports = {
  assertLabTransitionAllowed,
  labCallerFromReq,
  hasLabPermission,
  normPermissionList
}
