'use strict'

const sql = require('mssql')
const { parseIndiaMobileForSave } = require('../lib/indiaMobile')
const {
  isValidMembershipDependentRelationship,
  relationshipLabel,
  getMembershipDependentRelationshipsForApi
} = require('../config/membershipDependentRelationshipsCatalog')
const posCustomerRegister = require('./posCustomerRegisterService')

const CAPABILITY_COLS_P = `
  p.has_plus_access,
  p.extra_cashback_pct,
  p.flat_discount_pct,
  p.has_one_time_discount,
  p.can_create_sub_cards
`

const CAPABILITY_COLS_MP = `
  mp.has_plus_access,
  mp.extra_cashback_pct,
  mp.flat_discount_pct,
  mp.has_one_time_discount,
  mp.can_create_sub_cards
`

function httpError(message, statusCode) {
  const err = new Error(message)
  err.statusCode = statusCode
  return err
}

/**
 * Active membership row owned by customer (primary holder).
 */
async function getOwnActiveMembership(pool, customerId) {
  const r = await pool.request().input('cid', sql.Int, customerId).query(`
    SELECT TOP 1
      m.membership_id,
      m.plan_key,
      m.purchased_at,
      m.expires_at,
      m.price_paid,
      p.display_name AS plan_name,
      p.max_dependents,
      ${CAPABILITY_COLS_P}
    FROM   dbo.customer_memberships m
    JOIN   dbo.membership_plans p ON p.plan_key = m.plan_key
    WHERE  m.customer_id = @cid AND m.is_active = 1
      AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
    ORDER BY m.expires_at DESC
  `)
  return r.recordset[0] || null
}

/**
 * Resolve effective membership for offers / display (own wins over dependent link).
 * @returns {Promise<{
 *   source: 'own'|'dependent'|'none',
 *   membership_id?: number,
 *   plan_key?: string,
 *   capabilities?: object,
 *   relationship?: string,
 *   relationship_label?: string,
 *   primary?: { customer_id: number, full_name: string, phone: string|null }
 * }>}
 */
async function resolveMembershipForCustomer(pool, customerId) {
  const own = await getOwnActiveMembership(pool, customerId)
  if (own) {
    return {
      source: 'own',
      membership_id: own.membership_id,
      plan_key: own.plan_key,
      capabilities: {
        plan_key: own.plan_key,
        has_plus_access: own.has_plus_access,
        extra_cashback_pct: own.extra_cashback_pct,
        flat_discount_pct: own.flat_discount_pct,
        has_one_time_discount: own.has_one_time_discount,
        can_create_sub_cards: own.can_create_sub_cards
      }
    }
  }

  const depR = await pool.request().input('cid', sql.Int, customerId).query(`
    SELECT TOP 1
      d.dependent_id,
      d.relationship,
      d.membership_id,
      m.customer_id AS primary_customer_id,
      pc.full_name AS primary_full_name,
      pc.phone AS primary_phone,
      mp.plan_key,
      ${CAPABILITY_COLS_MP}
    FROM   dbo.customer_membership_dependents d
    JOIN   dbo.customer_memberships m ON m.membership_id = d.membership_id
    JOIN   dbo.membership_plans mp ON mp.plan_key = m.plan_key
    JOIN   dbo.pos_customers pc ON pc.customer_id = m.customer_id
    WHERE  d.customer_id = @cid
      AND  m.is_active = 1
      AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
    ORDER BY m.expires_at DESC
  `)
  const row = depR.recordset[0]
  if (!row) {
    return { source: 'none' }
  }

  const rel = String(row.relationship || '').trim()
  return {
    source: 'dependent',
    membership_id: row.membership_id,
    plan_key: row.plan_key,
    relationship: rel,
    relationship_label: relationshipLabel(rel),
    capabilities: {
      plan_key: row.plan_key,
      has_plus_access: row.has_plus_access,
      extra_cashback_pct: row.extra_cashback_pct,
      flat_discount_pct: row.flat_discount_pct,
      has_one_time_discount: row.has_one_time_discount,
      can_create_sub_cards: row.can_create_sub_cards
    },
    primary: {
      customer_id: row.primary_customer_id,
      full_name: row.primary_full_name,
      phone: row.primary_phone
    }
  }
}

async function listDependents(pool, membershipId) {
  const r = await pool.request().input('mid', sql.Int, membershipId).query(`
    SELECT d.dependent_id, d.relationship, d.added_at,
           c.customer_id, c.full_name, c.phone
    FROM   dbo.customer_membership_dependents d
    JOIN   dbo.pos_customers c ON c.customer_id = d.customer_id
    WHERE  d.membership_id = @mid
    ORDER BY d.added_at ASC
  `)
  return (r.recordset || []).map((row) => ({
    ...row,
    relationship_label: relationshipLabel(row.relationship)
  }))
}

async function countDependents(pool, membershipId) {
  const r = await pool.request().input('mid', sql.Int, membershipId).query(`
    SELECT COUNT(*) AS cnt FROM dbo.customer_membership_dependents WHERE membership_id = @mid
  `)
  return Number(r.recordset[0]?.cnt || 0)
}

async function isDependentOnOtherActiveMembership(pool, customerId, excludeMembershipId) {
  const r = await pool
    .input('cid', sql.Int, customerId)
    .input('ex_mid', sql.Int, excludeMembershipId || 0)
    .query(`
      SELECT TOP 1 d.dependent_id
      FROM   dbo.customer_membership_dependents d
      JOIN   dbo.customer_memberships m ON m.membership_id = d.membership_id
      WHERE  d.customer_id = @cid
        AND  m.is_active = 1
        AND  m.expires_at > DATEADD(MINUTE, 330, SYSUTCDATETIME())
        AND  (@ex_mid = 0 OR d.membership_id <> @ex_mid)
    `)
  return !!(r.recordset && r.recordset.length)
}

/**
 * @param {object} opts
 * @param {number} opts.primaryCustomerId
 * @param {string} opts.phone
 * @param {string} opts.relationship — catalog key
 * @param {string} [opts.fullName]
 * @param {number|null} [opts.createdByUserId]
 */
async function addDependent(pool, opts) {
  const primaryCustomerId = Number(opts.primaryCustomerId)
  const relationship = String(opts.relationship || '').trim()

  if (!primaryCustomerId) throw httpError('Invalid primary customer.', 400)
  if (!opts.phone) throw httpError('Phone is required.', 400)
  if (!relationship) throw httpError('Relationship is required.', 400)
  if (!isValidMembershipDependentRelationship(relationship)) {
    throw httpError('Invalid relationship. Use a value from the membership dependent relationships catalog.', 400)
  }

  const mem = await getOwnActiveMembership(pool, primaryCustomerId)
  if (!mem) {
    throw httpError('No active Eyewoot membership found for this customer.', 403)
  }

  const cnt = await countDependents(pool, mem.membership_id)
  if (cnt >= mem.max_dependents) {
    throw httpError(`Maximum ${mem.max_dependents} buddies allowed on this plan.`, 400)
  }

  const parsed = parseIndiaMobileForSave(opts.phone)
  if (!parsed.ok) throw httpError(parsed.message, 400)

  const depName =
    String(opts.fullName || '').trim() ||
    `Dependent (${parsed.phone})`

  const reg = await posCustomerRegister.registerCustomer(pool, {
    fullName: depName,
    phone: parsed.phone,
    email: null,
    homeStoreId: null,
    confirmAlias: true,
    createdByUserId: opts.createdByUserId ?? null
  })

  const depCustomerId = reg.customer_id
  if (depCustomerId === primaryCustomerId) {
    throw httpError('You cannot add yourself as a buddy.', 400)
  }

  const onOther = await isDependentOnOtherActiveMembership(pool, depCustomerId, mem.membership_id)
  if (onOther) {
    throw httpError('This customer is already a buddy on another active membership.', 409)
  }

  const existR = await pool
    .input('mid', sql.Int, mem.membership_id)
    .input('dep_cid', sql.Int, depCustomerId)
    .query(`
      SELECT 1 FROM dbo.customer_membership_dependents
      WHERE membership_id = @mid AND customer_id = @dep_cid
    `)
  if (existR.recordset.length) {
    throw httpError('This buddy is already on your plan.', 409)
  }

  const insR = await pool
    .input('mid', sql.Int, mem.membership_id)
    .input('dep_cid', sql.Int, depCustomerId)
    .input('rel', sql.NVarChar(50), relationship)
    .query(`
      INSERT INTO dbo.customer_membership_dependents (membership_id, customer_id, relationship)
      OUTPUT INSERTED.dependent_id
      VALUES (@mid, @dep_cid, @rel)
    `)

  const dependentId = insR.recordset[0]?.dependent_id
  const dependents = await listDependents(pool, mem.membership_id)

  return {
    dependent_id: dependentId,
    membership_id: mem.membership_id,
    customer_id: depCustomerId,
    relationship,
    relationship_label: relationshipLabel(relationship),
    dependents,
    slots_remaining: Math.max(0, mem.max_dependents - dependents.length),
    max_dependents: mem.max_dependents
  }
}

async function removeDependent(pool, opts) {
  const primaryCustomerId = Number(opts.primaryCustomerId)
  const dependentId = Number(opts.dependentId)
  if (!primaryCustomerId || !dependentId) {
    throw httpError('Invalid primary customer or dependent.', 400)
  }

  const mem = await getOwnActiveMembership(pool, primaryCustomerId)
  if (!mem) {
    throw httpError('No active membership found for this customer.', 403)
  }

  const delR = await pool
    .input('mid', sql.Int, mem.membership_id)
    .input('did', sql.Int, dependentId)
    .query(`
      DELETE FROM dbo.customer_membership_dependents
      WHERE dependent_id = @did AND membership_id = @mid
    `)

  if (!delR.rowsAffected || delR.rowsAffected[0] === 0) {
    throw httpError('Buddy not found on this membership.', 404)
  }

  const dependents = await listDependents(pool, mem.membership_id)
  return {
    dependents,
    slots_remaining: Math.max(0, mem.max_dependents - dependents.length),
    max_dependents: mem.max_dependents
  }
}

/**
 * Family summary for POS/CX (primary can manage; dependent sees inherited_from).
 */
async function getMembershipFamilyForCustomer(pool, customerId) {
  const resolved = await resolveMembershipForCustomer(pool, customerId)
  const own = await getOwnActiveMembership(pool, customerId)

  if (resolved.source === 'dependent' && resolved.primary) {
    const primaryMem = await getOwnActiveMembership(pool, resolved.primary.customer_id)
    const dependents = primaryMem
      ? await listDependents(pool, primaryMem.membership_id)
      : []
    return {
      role: 'dependent',
      can_add_dependents: false,
      can_sell_membership: false,
      inherited_from: {
        customer_id: resolved.primary.customer_id,
        full_name: resolved.primary.full_name,
        phone: resolved.primary.phone,
        plan_key: resolved.plan_key,
        relationship: resolved.relationship,
        relationship_label: resolved.relationship_label
      },
      resolved,
      active_membership: null,
      dependents: [],
      slots_remaining: 0,
      max_dependents: primaryMem?.max_dependents ?? 0
    }
  }

  if (own) {
    const dependents = await listDependents(pool, own.membership_id)
    const cnt = dependents.length
    return {
      role: 'primary',
      can_add_dependents: true,
      can_sell_membership: true,
      inherited_from: null,
      resolved,
      active_membership: own,
      dependents,
      slots_remaining: Math.max(0, own.max_dependents - cnt),
      max_dependents: own.max_dependents
    }
  }

  return {
    role: 'none',
    can_add_dependents: false,
    can_sell_membership: true,
    inherited_from: null,
    resolved,
    active_membership: null,
    dependents: [],
    slots_remaining: 0,
    max_dependents: 0
  }
}

module.exports = {
  getMembershipDependentRelationshipsForApi,
  getOwnActiveMembership,
  resolveMembershipForCustomer,
  listDependents,
  addDependent,
  removeDependent,
  getMembershipFamilyForCustomer,
  relationshipLabel
}
