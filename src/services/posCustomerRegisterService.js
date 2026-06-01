'use strict'

const sql = require('mssql')
const {
  normalizeIndiaMobileDigits,
  isValidIndiaMobileDigits
} = require('../lib/indiaMobile')

function namesEqual(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
}

async function listAliases(pool, customerId) {
  const r = await pool.request().input('cid', sql.Int, customerId).query(`
    SELECT alias_name FROM dbo.pos_customer_aliases
    WHERE customer_id = @cid
    ORDER BY alias_name ASC
  `)
  return (r.recordset || []).map((row) => String(row.alias_name || '').trim()).filter(Boolean)
}

/**
 * @returns {{ exists: boolean, customer_id?: number, primary_name?: string, aliases?: string[] }}
 */
async function checkPhone(pool, phoneRaw, { proposedName } = {}) {
  const phone = normalizeIndiaMobileDigits(phoneRaw)
  if (!isValidIndiaMobileDigits(phone)) {
    const err = new Error('Phone must be a valid 10-digit Indian mobile.')
    err.statusCode = 400
    throw err
  }
  const r = await pool.request().input('phone', sql.NVarChar(20), phone).query(`
    SELECT TOP 1 customer_id, full_name
    FROM   dbo.pos_customers
    WHERE  phone = @phone AND is_active = 1
  `)
  const row = r.recordset[0]
  if (!row) {
    return { exists: false, phone, needs_alias_confirm: false }
  }
  const aliases = await listAliases(pool, row.customer_id)
  const primary = String(row.full_name || '').trim()
  const needsAliasConfirm =
    proposedName &&
    !namesEqual(proposedName, primary) &&
    !aliases.some((a) => namesEqual(a, proposedName))
  return {
    exists: true,
    phone,
    customer_id: row.customer_id,
    primary_name: primary,
    aliases,
    needs_alias_confirm: !!needsAliasConfirm,
    proposed_alias: needsAliasConfirm ? String(proposedName).trim() : null
  }
}

/**
 * Register or link customer by mobile.
 * @returns {Promise<{ customer_id: number, created: boolean, alias_added: boolean, primary_name: string }>}
 */
async function registerCustomer(
  pool,
  {
    fullName,
    phone: phoneRaw,
    email,
    homeStoreId,
    confirmAlias = false,
    createdByUserId = null
  }
) {
  const phone = normalizeIndiaMobileDigits(phoneRaw)
  if (!isValidIndiaMobileDigits(phone)) {
    const err = new Error('Phone must be a valid 10-digit Indian mobile.')
    err.statusCode = 400
    throw err
  }
  const name = String(fullName || '').trim()
  if (!name) {
    const err = new Error('Full name is required.')
    err.statusCode = 400
    throw err
  }

  const existingR = await pool.request().input('phone', sql.NVarChar(20), phone).query(`
    SELECT TOP 1 customer_id, full_name, email
    FROM   dbo.pos_customers
    WHERE  phone = @phone AND is_active = 1
  `)
  const existing = existingR.recordset[0]

  if (!existing) {
    const ins = await pool
      .request()
      .input('full_name', sql.NVarChar(200), name)
      .input('phone', sql.NVarChar(20), phone)
      .input('email', sql.NVarChar(200), email || null)
      .input('home_store_id', sql.Int, homeStoreId || null)
      .query(`
        INSERT INTO dbo.pos_customers (full_name, phone, email, home_store_id)
        OUTPUT INSERTED.customer_id
        VALUES (@full_name, @phone, @email, @home_store_id)
      `)
    const customerId = ins.recordset[0].customer_id
    return {
      customer_id: customerId,
      created: true,
      alias_added: false,
      primary_name: name
    }
  }

  const customerId = existing.customer_id
  const primaryName = String(existing.full_name || '').trim()
  const aliases = await listAliases(pool, customerId)

  if (namesEqual(name, primaryName) || aliases.some((a) => namesEqual(a, name))) {
    return {
      customer_id: customerId,
      created: false,
      alias_added: false,
      primary_name: primaryName
    }
  }

  if (!confirmAlias) {
    const err = new Error(
      `Mobile already registered as ${primaryName}. Add "${name}" as an alias and continue?`
    )
    err.statusCode = 409
    err.code = 'PHONE_ALIAS_REQUIRED'
    err.payload = {
      customer_id: customerId,
      primary_name: primaryName,
      proposed_alias: name,
      aliases
    }
    throw err
  }

  await pool
    .request()
    .input('cid', sql.Int, customerId)
    .input('alias_name', sql.NVarChar(200), name)
    .input('uid', sql.Int, createdByUserId || null)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.pos_customer_aliases
        WHERE customer_id = @cid AND alias_name = @alias_name
      )
      INSERT INTO dbo.pos_customer_aliases (customer_id, alias_name, created_by_user_id)
      VALUES (@cid, @alias_name, @uid)
    `)

  return {
    customer_id: customerId,
    created: false,
    alias_added: true,
    primary_name: primaryName
  }
}

module.exports = {
  normalizeIndiaMobileDigits,
  checkPhone,
  registerCustomer,
  listAliases
}
