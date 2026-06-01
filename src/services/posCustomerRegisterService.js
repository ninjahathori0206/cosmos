'use strict'

const sql = require('mssql')
const {
  normalizeIndiaMobileDigits,
  isValidIndiaMobileDigits
} = require('../lib/indiaMobile')
const { familyNameConfirmErrorMessage } = require('../config/posCustomerFamilyNameCopyCatalog')

const FAMILY_NAMES_TABLE = 'dbo.pos_customer_family_names'

function namesEqual(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()
}

async function listFamilyNames(pool, customerId) {
  const sources = [
    { table: FAMILY_NAMES_TABLE, column: 'family_name' },
    { table: 'dbo.pos_customer_aliases', column: 'alias_name' }
  ]
  for (let i = 0; i < sources.length; i += 1) {
    const src = sources[i]
    try {
      const r = await pool.request().input('cid', sql.Int, customerId).query(`
        SELECT ${src.column} FROM ${src.table}
        WHERE customer_id = @cid
        ORDER BY ${src.column} ASC
      `)
      return (r.recordset || [])
        .map((row) => String(row[src.column] || '').trim())
        .filter(Boolean)
    } catch (err) {
      const msg = String(err.message || '')
      const missing =
        err.code === 'EREQUEST' &&
        (/Invalid object name/i.test(msg) || /Invalid column name/i.test(msg))
      if (!missing || i === sources.length - 1) throw err
    }
  }
  return []
}

/** @deprecated use listFamilyNames */
const listAliases = listFamilyNames

/**
 * @returns {{
 *   exists: boolean,
 *   customer_id?: number,
 *   primary_name?: string,
 *   family_names?: string[],
 *   needs_family_name_confirm?: boolean,
 *   proposed_family_name?: string|null
 * }}
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
    return { exists: false, phone, needs_family_name_confirm: false }
  }
  const familyNames = await listFamilyNames(pool, row.customer_id)
  const primary = String(row.full_name || '').trim()
  const needsFamilyNameConfirm =
    proposedName &&
    !namesEqual(proposedName, primary) &&
    !familyNames.some((a) => namesEqual(a, proposedName))
  return {
    exists: true,
    phone,
    customer_id: row.customer_id,
    primary_name: primary,
    family_names: familyNames,
    needs_family_name_confirm: !!needsFamilyNameConfirm,
    proposed_family_name: needsFamilyNameConfirm ? String(proposedName).trim() : null
  }
}

/**
 * Register or link customer by mobile.
 * @returns {Promise<{ customer_id: number, created: boolean, family_name_added: boolean, primary_name: string }>}
 */
async function registerCustomer(
  pool,
  {
    fullName,
    phone: phoneRaw,
    email,
    homeStoreId,
    confirmFamilyName = false,
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
      family_name_added: false,
      primary_name: name
    }
  }

  const customerId = existing.customer_id
  const primaryName = String(existing.full_name || '').trim()
  const familyNames = await listFamilyNames(pool, customerId)

  if (namesEqual(name, primaryName) || familyNames.some((a) => namesEqual(a, name))) {
    return {
      customer_id: customerId,
      created: false,
      family_name_added: false,
      primary_name: primaryName
    }
  }

  if (!confirmFamilyName) {
    const err = new Error(familyNameConfirmErrorMessage(primaryName, name))
    err.statusCode = 409
    err.code = 'PHONE_FAMILY_NAME_REQUIRED'
    err.payload = {
      customer_id: customerId,
      primary_name: primaryName,
      proposed_family_name: name,
      family_names: familyNames
    }
    throw err
  }

  await pool
    .request()
    .input('cid', sql.Int, customerId)
    .input('family_name', sql.NVarChar(200), name)
    .input('uid', sql.Int, createdByUserId || null)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM ${FAMILY_NAMES_TABLE}
        WHERE customer_id = @cid AND family_name = @family_name
      )
      INSERT INTO ${FAMILY_NAMES_TABLE} (customer_id, family_name, created_by_user_id)
      VALUES (@cid, @family_name, @uid)
    `)

  return {
    customer_id: customerId,
    created: false,
    family_name_added: true,
    primary_name: primaryName
  }
}

module.exports = {
  normalizeIndiaMobileDigits,
  checkPhone,
  registerCustomer,
  listFamilyNames,
  listAliases
}
