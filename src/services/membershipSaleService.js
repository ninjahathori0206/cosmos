'use strict'

const sql = require('mssql')
const { readSetting } = require('./procurementService')
const { wallClockIso } = require('../lib/cosmosIst')
const {
  getIndianFyLabelForInvoice,
  compactStoreCodeForInvoice,
  membershipInvoiceSeqSettingKey
} = require('../lib/posNumbering')

function toSqlDatetime2Param(value) {
  if (!value) return wallClockIso()
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T').slice(0, 19)
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 19)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10) + 'T12:00:00'
  return wallClockIso()
}

const MONEY_EPS = 0.005

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function dbRequest(db) {
  if (db && typeof db.commit === 'function') return new sql.Request(db)
  return db.request()
}

async function fetchStoreCompact(db, storeId) {
  const sid = Number(storeId)
  if (!Number.isFinite(sid) || sid < 1) return 'STORE'
  const r = await dbRequest(db).input('sid', sql.Int, sid).query(`
    SELECT store_code FROM dbo.stores WHERE store_id = @sid
  `)
  const code = r.recordset[0] && r.recordset[0].store_code
  return compactStoreCodeForInvoice(code || 'STORE')
}

/**
 * M-series invoice: {prefix}{FY}-{storeCompact}-M-{seq5}
 * @param {import('mssql').ConnectionPool|import('mssql').Transaction} db
 */
async function allocateNextMembershipInvoiceNo(db, storeId) {
  const prefixRaw = db && typeof db.commit === 'function'
    ? await readSetting({ request: () => dbRequest(db) }, 'pos_invoice_prefix')
    : await readSetting(db, 'pos_invoice_prefix')
  const prefix = String(prefixRaw || 'EW-INV-')
  const storeCompact = await fetchStoreCompact(db, storeId)
  const fy = getIndianFyLabelForInvoice()
  const k = membershipInvoiceSeqSettingKey(storeCompact, fy)

  await dbRequest(db).input('k', sql.VarChar(100), k).query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k)
    BEGIN
      INSERT INTO dbo.app_settings (setting_key, setting_value, setting_group, description)
      VALUES (@k, N'0', N'pos', N'Per-store membership invoice sequence (M-series).');
    END
  `)

  const lock = await dbRequest(db).input('k', sql.VarChar(100), k).query(
    'SELECT setting_value FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k'
  )
  let seq = parseInt((lock.recordset[0] || {}).setting_value, 10)
  if (!Number.isFinite(seq)) seq = 0
  const nextSeq = seq + 1

  await dbRequest(db)
    .input('k', sql.VarChar(100), k)
    .input('v', sql.VarChar(500), String(nextSeq))
    .query(
      'UPDATE dbo.app_settings SET setting_value = @v, updated_at = DATEADD(MINUTE,330,SYSUTCDATETIME()) WHERE setting_key = @k'
    )

  return `${prefix}${fy}-${storeCompact}-M-${String(nextSeq).padStart(5, '0')}`
}

/**
 * @returns {{ ok: boolean, message?: string }}
 */
function validateMembershipPayment(amountRaw, saleAmount) {
  const amount = roundMoney(amountRaw)
  const total = roundMoney(saleAmount)
  if (amount < 0) return { ok: false, message: 'Amount cannot be negative.' }
  if (amount + MONEY_EPS < total) {
    return { ok: false, message: 'Collect at least ' + total.toFixed(2) + ' for membership.' }
  }
  if (amount > total + MONEY_EPS) {
    return { ok: false, message: 'Payment would exceed membership amount.' }
  }
  return { ok: true }
}

async function createMembershipSaleInTransaction(transaction, opts) {
  const storeId = Number(opts.storeId)
  const customerId = Number(opts.customerId)
  const planKey = String(opts.planKey || '').trim()
  const amount = roundMoney(opts.amount)
  const productOrderId = opts.productOrderId != null ? Number(opts.productOrderId) : null
  const createdBy = opts.createdBy != null ? Number(opts.createdBy) : null
  const createdAt = opts.createdAt || null

  if (!Number.isFinite(storeId) || storeId < 1) {
    const err = new Error('Invalid store for membership sale.')
    err.statusCode = 400
    throw err
  }
  if (!Number.isFinite(customerId) || customerId < 1) {
    const err = new Error('Customer is required for membership sale.')
    err.statusCode = 400
    throw err
  }
  if (!planKey || amount <= MONEY_EPS) {
    const err = new Error('Invalid membership plan or amount.')
    err.statusCode = 400
    throw err
  }

  const invoiceNo = await allocateNextMembershipInvoiceNo(transaction, storeId)
  const r = new sql.Request(transaction)
  r.input('store_id', sql.Int, storeId)
  r.input('customer_id', sql.Int, customerId)
  r.input('plan_key', sql.NVarChar(50), planKey)
  r.input('amount', sql.Decimal(12, 2), amount)
  r.input('invoice_no', sql.NVarChar(50), invoiceNo)
  r.input('product_order_id', sql.Int, productOrderId)
  r.input('created_by', sql.Int, createdBy)
  r.input('created_at_ist', sql.VarChar(19), toSqlDatetime2Param(createdAt))

  const ins = await r.query(`
    INSERT INTO dbo.pos_membership_sales (
      store_id, customer_id, plan_key, amount, invoice_no, product_order_id,
      status, created_by_user_id, created_at
    ) VALUES (
      @store_id, @customer_id, @plan_key, @amount, @invoice_no, @product_order_id,
      N'PAID', @created_by, CAST(@created_at_ist AS DATETIME2(0))
    );
    SELECT CAST(SCOPE_IDENTITY() AS INT) AS membership_sale_id;
  `)

  return {
    membership_sale_id: ins.recordset[0].membership_sale_id,
    invoice_no: invoiceNo,
    amount,
    plan_key: planKey,
    store_id: storeId,
    customer_id: customerId,
    product_order_id: productOrderId
  }
}

async function insertMembershipPaymentInTransaction(transaction, saleId, employeeId, body, tendered, changeGiven, createdAt) {
  const r = new sql.Request(transaction)
  r.input('membership_sale_id', sql.Int, saleId)
  r.input('stage', sql.NVarChar(20), body.stage || 'FULL')
  r.input('method', sql.NVarChar(20), body.method)
  r.input('amount', sql.Decimal(12, 2), roundMoney(body.amount))
  r.input('tendered', sql.Decimal(12, 2), tendered != null ? tendered : null)
  r.input('change_given', sql.Decimal(12, 2), changeGiven != null ? changeGiven : null)
  r.input('external_ref', sql.NVarChar(200), body.external_ref || null)
  r.input('created_by', sql.Int, employeeId || null)
  r.input('created_at_ist', sql.VarChar(19), toSqlDatetime2Param(createdAt))
  await r.query(`
    INSERT INTO dbo.pos_membership_payments (
      membership_sale_id, stage, method, amount, tendered, change_given, external_ref, created_by, created_at
    ) VALUES (
      @membership_sale_id, @stage, @method, @amount, @tendered, @change_given, @external_ref, @created_by,
      CAST(@created_at_ist AS DATETIME2(0))
    )
  `)
}

async function linkMembershipSaleToProductOrderInTransaction(transaction, productOrderId, membershipSaleId) {
  const r = new sql.Request(transaction)
  r.input('pid', sql.Int, productOrderId)
  r.input('sid', sql.Int, membershipSaleId)
  await r.query(`
    UPDATE dbo.pos_orders
    SET linked_membership_sale_id = @sid
    WHERE order_id = @pid
  `)
}

async function fetchMembershipSaleRow(pool, saleId, storeId) {
  const r = await pool.request()
    .input('sid', sql.Int, saleId)
    .input('store_id', sql.Int, storeId != null ? storeId : null)
    .query(`
      SELECT ms.*,
        mp.display_name AS plan_display_name
      FROM dbo.pos_membership_sales ms
      LEFT JOIN dbo.membership_plans mp ON mp.plan_key = ms.plan_key
      WHERE ms.membership_sale_id = @sid
        AND (@store_id IS NULL OR ms.store_id = @store_id)
    `)
  return r.recordset[0] || null
}

async function fetchMembershipSalePayments(pool, saleId) {
  const r = await pool.request().input('sid', sql.Int, saleId).query(`
    SELECT payment_id, membership_sale_id, stage, method, amount, tendered, change_given, external_ref, created_by, created_at
    FROM dbo.pos_membership_payments
    WHERE membership_sale_id = @sid
    ORDER BY payment_id
  `)
  return r.recordset || []
}

async function fetchMembershipSaleBundle(pool, saleId, storeId) {
  const sale = await fetchMembershipSaleRow(pool, saleId, storeId)
  if (!sale) return null
  const payments = await fetchMembershipSalePayments(pool, saleId)
  const paidTotal = roundMoney(payments.reduce((s, p) => s + roundMoney(Number(p.amount) || 0), 0))
  return {
    sale,
    payments,
    paid_total: paidTotal,
    amount_remaining: roundMoney(Math.max(0, roundMoney(Number(sale.amount)) - paidTotal))
  }
}

async function fetchCustomerForMembershipInvoice(pool, customerId) {
  const r = await pool.request().input('cid', sql.Int, customerId).query(`
    SELECT customer_id, display_name, phone, email
    FROM dbo.pos_customers
    WHERE customer_id = @cid
  `)
  return r.recordset[0] || null
}

async function buildMembershipInvoiceDetailForApi(pool, saleId, storeId) {
  const bundle = await fetchMembershipSaleBundle(pool, saleId, storeId)
  if (!bundle) return null
  const sale = bundle.sale
  const customer = await fetchCustomerForMembershipInvoice(pool, sale.customer_id)
  const storeRs = await pool.request().input('sid', sql.Int, sale.store_id).query(`
    SELECT store_id, store_name, store_code FROM dbo.stores WHERE store_id = @sid
  `)
  const store = storeRs.recordset[0] || null

  return {
    membership_sale_id: sale.membership_sale_id,
    invoice_no: sale.invoice_no,
    order_kind: 'MEMBERSHIP',
    plan_key: sale.plan_key,
    plan_display_name: sale.plan_display_name || sale.plan_key,
    subtotal_amount: roundMoney(Number(sale.amount)),
    discount_amount: 0,
    gst_amount: 0,
    total_amount: roundMoney(Number(sale.amount)),
    taxable_amount: roundMoney(Number(sale.amount)),
    customer: customer
      ? {
          customer_id: customer.customer_id,
          display_name: customer.display_name,
          phone: customer.phone,
          email: customer.email
        }
      : null,
    store: store
      ? {
          store_id: store.store_id,
          store_name: store.store_name,
          store_code: store.store_code
        }
      : null,
    payments: bundle.payments.map((p) => ({
      method: p.method,
      amount: roundMoney(Number(p.amount)),
      stage: p.stage
    })),
    product_order_id: sale.product_order_id,
    created_at: sale.created_at
  }
}

async function membershipSalesTableExists(pool) {
  const r = await pool.request().query(`
    SELECT CASE WHEN OBJECT_ID('dbo.pos_membership_sales', 'U') IS NULL THEN 0 ELSE 1 END AS ok
  `)
  return Number((r.recordset[0] || {}).ok) === 1
}

async function resolveMembershipInvoiceNoForProductOrder(pool, productOrderId) {
  const oid = Number(productOrderId)
  if (!Number.isFinite(oid) || oid < 1) return null
  const r = await pool.request().input('oid', sql.Int, oid).query(`
    SELECT TOP 1 ms.invoice_no
    FROM dbo.pos_orders o
    INNER JOIN dbo.pos_membership_sales ms ON ms.membership_sale_id = o.linked_membership_sale_id
    WHERE o.order_id = @oid
  `)
  const row = r.recordset[0]
  return row && row.invoice_no ? String(row.invoice_no).trim() : null
}

module.exports = {
  MONEY_EPS,
  roundMoney,
  allocateNextMembershipInvoiceNo,
  validateMembershipPayment,
  createMembershipSaleInTransaction,
  insertMembershipPaymentInTransaction,
  linkMembershipSaleToProductOrderInTransaction,
  fetchMembershipSaleBundle,
  fetchMembershipSaleRow,
  buildMembershipInvoiceDetailForApi,
  membershipSalesTableExists,
  resolveMembershipInvoiceNoForProductOrder
}
