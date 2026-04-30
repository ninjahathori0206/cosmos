const sql = require('mssql')
const { readSetting } = require('./procurementService')

const ORDERS_ENGINE_MODE_KEY = 'orders_engine_mode'
const MONEY_EPS = 0.02
const ORDER_SEQ_KEY = 'pos_order_seq'

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}

/**
 * @param {import('mssql').ConnectionPool} pool
 * @returns {Promise<'legacy'|'shared'>}
 */
async function getOrdersEngineMode(pool) {
  const raw = await readSetting(pool, ORDERS_ENGINE_MODE_KEY)
  if (raw && String(raw).toLowerCase() === 'shared') return 'shared'
  return 'legacy'
}

function tableNames(mode) {
  if (mode === 'shared') {
    return {
      orders: 'dbo.oe_orders',
      sub_orders: 'dbo.oe_sub_orders',
      order_items: 'dbo.oe_order_items',
      payments: 'dbo.oe_payments',
      order_status_log: 'dbo.oe_order_status_log'
    }
  }
  return {
    orders: 'dbo.pos_orders',
    sub_orders: 'dbo.pos_sub_orders',
    order_items: 'dbo.pos_order_items',
    payments: 'dbo.pos_payments',
    order_status_log: 'dbo.pos_order_status_log'
  }
}

/**
 * @param {object} cfg from mapStartupConfig
 * @param {object} value validated create order body
 */
function validateOrderLinesAgainstConfig(cfg, value) {
  const typeRule = (key) => (cfg.productTypeConfig || []).find((r) => r.key === key)
  for (const line of value.lines) {
    const rule = typeRule(line.product_type)
    if (line.fulfillment === 'LAB') {
      if (!line.lens_bundle || !line.lens_bundle.package_id) {
        return { ok: false, message: 'Lab lines require a configured lens bundle.' }
      }
      if (rule && rule.rx_required && !value.rx_snapshot) {
        return { ok: false, message: 'Rx snapshot required for this order.' }
      }
    }
    if (rule && !rule.allow_qty_gt_1 && line.qty > 1) {
      return { ok: false, message: `Qty > 1 not allowed for ${line.product_type}.` }
    }
  }
  return { ok: true }
}

function buildPaymentSummary(orderRow, labSubtotal, instantSubtotal, payments) {
  const total = roundMoney(orderRow.total_amount)
  const subtotal = roundMoney(orderRow.subtotal_amount)
  const gstAmt = roundMoney(orderRow.gst_amount)
  const pct = Number(orderRow.lab_advance_pct_snapshot) || 40
  const orderKind = String(orderRow.order_kind || '')
  const labPart = roundMoney(labSubtotal)
  const insPart = roundMoney(instantSubtotal)

  let advanceTarget = 0
  if (orderKind === 'LAB' || orderKind === 'MIXED') {
    advanceTarget = roundMoney(labPart * (pct / 100))
  }

  let paidAdvance = 0
  let paidBalance = 0
  let paidFull = 0
  for (const p of payments || []) {
    const a = roundMoney(p.amount)
    if (p.stage === 'ADVANCE') paidAdvance += a
    else if (p.stage === 'BALANCE') paidBalance += a
    else if (p.stage === 'FULL') paidFull += a
  }
  paidAdvance = roundMoney(paidAdvance)
  paidBalance = roundMoney(paidBalance)
  paidFull = roundMoney(paidFull)
  const paidTotal = roundMoney(paidAdvance + paidBalance + paidFull)

  let instantDue = 0
  if (orderKind === 'MIXED' && subtotal > 0) {
    const gstShare = roundMoney(gstAmt * (insPart / subtotal))
    instantDue = roundMoney(insPart + gstShare)
  }

  const advanceRemaining = roundMoney(Math.max(0, advanceTarget - paidAdvance))
  const amountRemaining = roundMoney(Math.max(0, total - paidTotal))

  return {
    order_kind: orderKind,
    total_amount: total,
    subtotal_amount: subtotal,
    gst_amount: gstAmt,
    lab_subtotal_pre_tax: labPart,
    instant_subtotal_pre_tax: insPart,
    instant_portion_due_incl_gst: instantDue,
    lab_advance_pct: pct,
    advance_target: advanceTarget,
    paid_advance: paidAdvance,
    paid_balance: paidBalance,
    paid_full: paidFull,
    paid_total: paidTotal,
    advance_remaining: advanceRemaining,
    amount_remaining: amountRemaining
  }
}

/**
 * @returns {{ ok: boolean, message?: string }}
 */
function validatePaymentAgainstSummary(orderRow, summary, body) {
  const amount = roundMoney(body.amount)
  if (amount <= 0) return { ok: false, message: 'Amount must be positive.' }
  const stage = String(body.stage || '')
  const kind = String(orderRow.order_kind || '')
  const paidAfter = roundMoney(summary.paid_total + amount)

  if (paidAfter > summary.total_amount + MONEY_EPS) {
    return { ok: false, message: 'Payment would exceed order total.' }
  }

  if (kind === 'INSTANT') {
    if (stage !== 'FULL') return { ok: false, message: 'Instant orders only accept FULL payments.' }
    return { ok: true }
  }

  if (kind === 'LAB') {
    if (stage === 'ADVANCE') {
      const cap = roundMoney(summary.advance_target - summary.paid_advance)
      if (amount > cap + MONEY_EPS) return { ok: false, message: 'Advance payment exceeds remaining advance due.' }
      if (summary.paid_advance >= summary.advance_target - MONEY_EPS && summary.advance_target > 0) {
        return { ok: false, message: 'Lab advance already satisfied; use BALANCE or FULL for remainder.' }
      }
      return { ok: true }
    }
    if (stage === 'BALANCE' || stage === 'FULL') {
      if (summary.paid_advance + MONEY_EPS < summary.advance_target && summary.advance_target > 0) {
        return { ok: false, message: 'Collect lab advance before balance or final payment.' }
      }
      return { ok: true }
    }
    return { ok: false, message: 'Invalid payment stage for lab order.' }
  }

  if (kind === 'MIXED') {
    if (stage === 'ADVANCE') {
      const cap = roundMoney(summary.advance_target - summary.paid_advance)
      if (amount > cap + MONEY_EPS) return { ok: false, message: 'Advance payment exceeds remaining lab advance due.' }
      if (summary.paid_advance >= summary.advance_target - MONEY_EPS && summary.advance_target > 0) {
        return { ok: false, message: 'Lab advance already satisfied for mixed order; use BALANCE or FULL for remainder.' }
      }
      return { ok: true }
    }
    if (stage === 'BALANCE' || stage === 'FULL') {
      const needInstant = summary.instant_portion_due_incl_gst > 0
      const instantOk = summary.paid_total >= summary.instant_portion_due_incl_gst - MONEY_EPS
      if (needInstant && !instantOk) {
        return { ok: false, message: 'Collect instant-line portion (incl. GST share) and lab advance before final settlement.' }
      }
      if (summary.paid_advance + MONEY_EPS < summary.advance_target && summary.advance_target > 0) {
        return { ok: false, message: 'Collect lab advance before balance or final payment.' }
      }
      return { ok: true }
    }
    return { ok: false, message: 'Invalid payment stage for mixed order.' }
  }

  return { ok: false, message: 'Unknown order kind for payment validation.' }
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchOrderBundle(pool, orderId, storeId, mode) {
  const t = tableNames(mode)
  const o = await pool.request()
    .input('oid', sql.Int, orderId)
    .input('sid', sql.Int, storeId)
    .query(`SELECT * FROM ${t.orders} WHERE order_id = @oid AND store_id = @sid`)
  if (!o.recordset.length) return null
  const order = o.recordset[0]

  const subs = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT sub_order_id, order_id, fulfillment, lab_workflow_status, sort_order
      FROM ${t.sub_orders}
      WHERE order_id = @oid
      ORDER BY sort_order, sub_order_id
    `)

  const items = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT i.order_item_id, i.sub_order_id, i.sku_id, i.qty, i.unit_price, i.line_total,
             i.product_type, i.fulfillment, i.line_key, i.lens_bundle
      FROM ${t.order_items} i
      INNER JOIN ${t.sub_orders} s ON s.sub_order_id = i.sub_order_id
      WHERE s.order_id = @oid
      ORDER BY s.sort_order, i.order_item_id
    `)

  const pays = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT payment_id, order_id, stage, method, amount, tendered, change_given, external_ref, created_at
      FROM ${t.payments}
      WHERE order_id = @oid
      ORDER BY payment_id
    `)

  let labSubtotal = 0
  let instantSubtotal = 0
  for (const it of items.recordset || []) {
    const lt = roundMoney(it.line_total)
    if (String(it.fulfillment) === 'LAB') labSubtotal += lt
    else instantSubtotal += lt
  }
  labSubtotal = roundMoney(labSubtotal)
  instantSubtotal = roundMoney(instantSubtotal)

  const subList = (subs.recordset || []).map((s) => ({
    sub_order_id: s.sub_order_id,
    order_id: s.order_id,
    fulfillment: s.fulfillment,
    lab_workflow_status: s.lab_workflow_status,
    sort_order: s.sort_order,
    items: []
  }))
  const subById = new Map(subList.map((s) => [s.sub_order_id, s]))
  for (const it of items.recordset || []) {
    const bucket = subById.get(it.sub_order_id)
    if (bucket) {
      bucket.items.push({
        order_item_id: it.order_item_id,
        sku_id: it.sku_id,
        qty: it.qty,
        unit_price: Number(it.unit_price),
        line_total: Number(it.line_total),
        product_type: it.product_type,
        fulfillment: it.fulfillment,
        line_key: it.line_key,
        lens_bundle: it.lens_bundle
      })
    }
  }

  const payments = (pays.recordset || []).map((p) => ({
    payment_id: p.payment_id,
    stage: p.stage,
    method: p.method,
    amount: Number(p.amount),
    tendered: p.tendered != null ? Number(p.tendered) : null,
    change_given: p.change_given != null ? Number(p.change_given) : null,
    external_ref: p.external_ref,
    created_at: p.created_at
  }))

  const payment_summary = buildPaymentSummary(order, labSubtotal, instantSubtotal, payments)

  return { order, subList, payments, payment_summary }
}

function mapOrderRowForApi(order) {
  return {
    order_id: order.order_id,
    store_id: order.store_id,
    customer_id: order.customer_id,
    order_no: order.order_no,
    order_source: order.order_source,
    order_kind: order.order_kind,
    status: order.status,
    gst_rate_snapshot: Number(order.gst_rate_snapshot),
    lab_advance_pct_snapshot: order.lab_advance_pct_snapshot != null ? Number(order.lab_advance_pct_snapshot) : null,
    procurement_mode_snapshot: order.procurement_mode_snapshot,
    subtotal_amount: Number(order.subtotal_amount),
    gst_amount: Number(order.gst_amount),
    total_amount: Number(order.total_amount),
    created_at: order.created_at
  }
}

/**
 * Create order in a transaction (writes pos_* or oe_* based on mode).
 * Caller must validate Joi body and cfg before calling.
 */
async function createOrderInTransaction(transaction, {
  mode,
  value,
  storeId,
  employeeId,
  gstRate,
  advPct,
  procurementMode,
  cfg
}) {
  const vr = validateOrderLinesAgainstConfig(cfg, value)
  if (!vr.ok) {
    const err = new Error(vr.message)
    err.statusCode = 400
    throw err
  }

  const t = tableNames(mode)

  let subtotal = 0
  for (const line of value.lines) {
    let lineUnit = Number(line.unit_price) || 0
    if (line.fulfillment === 'LAB' && line.lens_bundle) {
      const b = line.lens_bundle
      const lensPrice = Number(b.package_price) || 0
      const addonSum = (b.addon_prices || []).reduce((s, p) => s + (Number(p) || 0), 0)
      lineUnit = lineUnit + lensPrice + addonSum
    }
    subtotal += lineUnit * line.qty
  }
  const gstAmount = roundMoney(subtotal * gstRate)
  const totalAmount = roundMoney(subtotal + gstAmount)

  const rSeq = new sql.Request(transaction)
  rSeq.input('k', sql.VarChar(100), ORDER_SEQ_KEY)
  const seqLock = await rSeq.query(
    'SELECT setting_value FROM dbo.app_settings WITH (UPDLOCK, ROWLOCK) WHERE setting_key = @k'
  )
  let seq = parseInt((seqLock.recordset[0] || {}).setting_value, 10)
  if (!Number.isFinite(seq)) seq = 1000
  const nextSeq = seq + 1
  await rSeq.input('v', sql.VarChar(500), String(nextSeq)).query(
    'UPDATE dbo.app_settings SET setting_value = @v, updated_at = DATEADD(MINUTE,330,SYSUTCDATETIME()) WHERE setting_key = @k'
  )
  const orderNo = `EW-ORD-${nextSeq}`

  const instantLines = value.lines.filter((l) => l.fulfillment === 'INSTANT')
  const labLines = value.lines.filter((l) => l.fulfillment === 'LAB')
  let orderKind = 'INSTANT'
  if (instantLines.length && labLines.length) orderKind = 'MIXED'
  else if (labLines.length) orderKind = 'LAB'

  const rIns = new sql.Request(transaction)
  rIns.input('store_id', sql.Int, storeId)
  rIns.input('customer_id', sql.Int, value.customer_id || null)
  rIns.input('created_by_user_id', sql.Int, employeeId || null)
  rIns.input('order_no', sql.NVarChar(50), orderNo)
  rIns.input('order_source', sql.NVarChar(20), value.order_source || 'POS')
  rIns.input('order_kind', sql.NVarChar(20), orderKind)
  rIns.input('rx_snapshot', sql.NVarChar(sql.MAX), value.rx_snapshot ? JSON.stringify(value.rx_snapshot) : null)
  rIns.input('gst_rate_snapshot', sql.Decimal(9, 4), gstRate)
  rIns.input('lab_advance_pct_snapshot', sql.Decimal(9, 2), advPct)
  rIns.input('procurement_mode_snapshot', sql.NVarChar(50), procurementMode)
  rIns.input('subtotal_amount', sql.Decimal(12, 2), subtotal)
  rIns.input('gst_amount', sql.Decimal(12, 2), gstAmount)
  rIns.input('total_amount', sql.Decimal(12, 2), totalAmount)

  const insOrder = await rIns.query(`
    INSERT INTO ${t.orders} (
      store_id, customer_id, created_by_user_id, order_no, order_source, order_kind,
      rx_snapshot, gst_rate_snapshot, lab_advance_pct_snapshot, procurement_mode_snapshot,
      status, subtotal_amount, gst_amount, total_amount
    ) VALUES (
      @store_id, @customer_id, @created_by_user_id, @order_no, @order_source, @order_kind,
      @rx_snapshot, @gst_rate_snapshot, @lab_advance_pct_snapshot, @procurement_mode_snapshot,
      N'OPEN', @subtotal_amount, @gst_amount, @total_amount
    );
    SELECT CAST(SCOPE_IDENTITY() AS INT) AS order_id;
  `)
  const orderId = insOrder.recordset[0].order_id

  const subIdByFulfillment = {}
  let sort = 0
  if (instantLines.length) {
    const rSub = new sql.Request(transaction)
    rSub.input('order_id', sql.Int, orderId)
    rSub.input('fulfillment', sql.NVarChar(10), 'INSTANT')
    rSub.input('sort_order', sql.Int, sort++)
    const subIns = await rSub.query(`
      INSERT INTO ${t.sub_orders} (order_id, fulfillment, lab_workflow_status, sort_order)
      VALUES (@order_id, @fulfillment, NULL, @sort_order);
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS sub_order_id;
    `)
    subIdByFulfillment.INSTANT = subIns.recordset[0].sub_order_id
  }
  if (labLines.length) {
    const rSub = new sql.Request(transaction)
    rSub.input('order_id', sql.Int, orderId)
    rSub.input('fulfillment', sql.NVarChar(10), 'LAB')
    rSub.input('sort_order', sql.Int, sort++)
    const subIns = await rSub.query(`
      INSERT INTO ${t.sub_orders} (order_id, fulfillment, lab_workflow_status, sort_order)
      VALUES (@order_id, @fulfillment, N'ORDER_PLACED', @sort_order);
      SELECT CAST(SCOPE_IDENTITY() AS INT) AS sub_order_id;
    `)
    subIdByFulfillment.LAB = subIns.recordset[0].sub_order_id
  }

  for (const line of value.lines) {
    const subOrderId = subIdByFulfillment[line.fulfillment]
    let lineUnit = Number(line.unit_price) || 0
    let lensJson = null
    if (line.fulfillment === 'LAB' && line.lens_bundle) {
      const b = line.lens_bundle
      const lensPrice = Number(b.package_price) || 0
      const addonSum = (b.addon_prices || []).reduce((s, p) => s + (Number(p) || 0), 0)
      lineUnit = lineUnit + lensPrice + addonSum
      lensJson = JSON.stringify(b)
    }
    const lineTotal = roundMoney(lineUnit * line.qty)

    const rStock = new sql.Request(transaction)
    rStock.input('sku_id', sql.Int, line.sku_id)
    rStock.input('store_id', sql.Int, storeId)
    rStock.input('qty', sql.Int, line.qty)
    const stockRes = await rStock.query(`
      SELECT balance_id, qty FROM dbo.stock_balances
      WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id
    `)
    const sb = stockRes.recordset[0]
    if (!sb || sb.qty < line.qty) {
      const err = new Error(`Insufficient stock for SKU ${line.sku_id} at this store.`)
      err.statusCode = 400
      throw err
    }
    await rStock.query(`
      UPDATE dbo.stock_balances
      SET qty = qty - @qty,
          last_updated = DATEADD(MINUTE,330,SYSUTCDATETIME())
      WHERE sku_id = @sku_id AND location_type = N'STORE' AND location_id = @store_id AND qty >= @qty
    `)

    const rItem = new sql.Request(transaction)
    rItem.input('sub_order_id', sql.Int, subOrderId)
    rItem.input('sku_id', sql.Int, line.sku_id)
    rItem.input('qty', sql.Int, line.qty)
    rItem.input('unit_price', sql.Decimal(12, 2), lineUnit)
    rItem.input('line_total', sql.Decimal(12, 2), lineTotal)
    rItem.input('product_type', sql.NVarChar(50), line.product_type)
    rItem.input('fulfillment', sql.NVarChar(10), line.fulfillment)
    rItem.input('line_key', sql.NVarChar(300), line.line_key)
    rItem.input('lens_bundle', sql.NVarChar(sql.MAX), lensJson)
    await rItem.query(`
      INSERT INTO ${t.order_items} (
        sub_order_id, sku_id, qty, unit_price, line_total, product_type, fulfillment, line_key, lens_bundle
      ) VALUES (
        @sub_order_id, @sku_id, @qty, @unit_price, @line_total, @product_type, @fulfillment, @line_key, @lens_bundle
      )
    `)
  }

  const rLog = new sql.Request(transaction)
  rLog.input('order_id', sql.Int, orderId)
  rLog.input('actor_user_id', sql.Int, employeeId || null)
  await rLog.query(`
    INSERT INTO ${t.order_status_log} (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
    VALUES (@order_id, NULL, NULL, N'CREATED', @actor_user_id, NULL)
  `)

  const subOrdersOut = []
  if (subIdByFulfillment.INSTANT) {
    subOrdersOut.push({
      sub_order_id: subIdByFulfillment.INSTANT,
      fulfillment: 'INSTANT',
      lab_workflow_status: null
    })
  }
  if (subIdByFulfillment.LAB) {
    subOrdersOut.push({
      sub_order_id: subIdByFulfillment.LAB,
      fulfillment: 'LAB',
      lab_workflow_status: 'ORDER_PLACED'
    })
  }

  return {
    order_id: orderId,
    order_no: orderNo,
    order_kind: orderKind,
    subtotal_amount: subtotal,
    gst_amount: gstAmount,
    total_amount: totalAmount,
    sub_orders: subOrdersOut
  }
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function recordPayment(pool, mode, storeId, employeeId, body) {
  const bundle = await fetchOrderBundle(pool, body.order_id, storeId, mode)
  if (!bundle) {
    const err = new Error('Order not found for this store.')
    err.statusCode = 404
    throw err
  }
  const orderRow = bundle.order
  const summary = bundle.payment_summary
  const check = validatePaymentAgainstSummary(orderRow, summary, body)
  if (!check.ok) {
    const err = new Error(check.message)
    err.statusCode = 400
    throw err
  }

  let tendered = body.tendered
  let changeGiven = body.change_given
  if (body.method === 'CASH' && tendered != null) {
    changeGiven = roundMoney(Number(tendered) - Number(body.amount))
    if (changeGiven < 0) {
      const err = new Error('Tendered amount is less than payment amount.')
      err.statusCode = 400
      throw err
    }
  }

  const t = tableNames(mode)
  await pool.request()
    .input('order_id', sql.Int, body.order_id)
    .input('stage', sql.NVarChar(20), body.stage)
    .input('method', sql.NVarChar(20), body.method)
    .input('amount', sql.Decimal(12, 2), body.amount)
    .input('tendered', sql.Decimal(12, 2), tendered != null ? tendered : null)
    .input('change_given', sql.Decimal(12, 2), changeGiven != null ? changeGiven : null)
    .input('external_ref', sql.NVarChar(200), body.external_ref || null)
    .input('created_by', sql.Int, employeeId || null)
    .query(`
      INSERT INTO ${t.payments} (order_id, stage, method, amount, tendered, change_given, external_ref, created_by)
      VALUES (@order_id, @stage, @method, @amount, @tendered, @change_given, @external_ref, @created_by)
    `)

  const refreshed = await fetchOrderBundle(pool, body.order_id, storeId, mode)
  return { message: 'Payment recorded.', payment_summary: refreshed.payment_summary }
}

/**
 * @param {Function} executeStoredProcedure
 */
async function updateLabSubOrderStatus(pool, mode, executeStoredProcedure, {
  orderId,
  storeId,
  employeeId,
  actorRole,
  subOrderId,
  toStatus,
  note
}) {
  const t = tableNames(mode)
  const ord = await pool.request()
    .input('oid', sql.Int, orderId)
    .query(`SELECT order_id, store_id FROM ${t.orders} WHERE order_id = @oid`)
  const orderRow = ord.recordset[0]
  if (!orderRow || orderRow.store_id !== storeId) {
    const err = new Error('Order not found for this store.')
    err.statusCode = 404
    throw err
  }

  const sub = await pool.request()
    .input('sid', sql.Int, subOrderId)
    .input('oid', sql.Int, orderId)
    .query(`
      SELECT sub_order_id, order_id, fulfillment, lab_workflow_status
      FROM ${t.sub_orders}
      WHERE sub_order_id = @sid AND order_id = @oid
    `)
  const subRow = sub.recordset[0]
  if (!subRow || subRow.fulfillment !== 'LAB') {
    const err = new Error('Lab sub-order required.')
    err.statusCode = 400
    throw err
  }

  const fromStatus = String(subRow.lab_workflow_status || '')
  const val = await executeStoredProcedure('sp_POS_ValidateLabTransition', {
    from_status: { type: sql.VarChar(30), value: fromStatus },
    to_status:   { type: sql.VarChar(30), value: toStatus },
    actor_role:  { type: sql.VarChar(50), value: actorRole }
  })
  const vr = (val.recordset || [])[0] || {}
  const cnt = Number(vr.transition_count) || 0
  const needsNote = Number(vr.requires_note) === 1
  if (!cnt) {
    const err = new Error('Transition not allowed for this role or status.')
    err.statusCode = 400
    throw err
  }
  if (needsNote && !(note && String(note).trim())) {
    const err = new Error('Note is required for this transition.')
    err.statusCode = 400
    throw err
  }

  await pool.request()
    .input('sid', sql.Int, subOrderId)
    .input('st', sql.NVarChar(30), toStatus)
    .query(`UPDATE ${t.sub_orders} SET lab_workflow_status = @st WHERE sub_order_id = @sid`)

  await pool.request()
    .input('order_id', sql.Int, orderId)
    .input('sub_order_id', sql.Int, subOrderId)
    .input('from_status', sql.NVarChar(30), fromStatus || null)
    .input('to_status', sql.NVarChar(30), toStatus)
    .input('actor_user_id', sql.Int, employeeId || null)
    .input('note', sql.NVarChar(500), note || null)
    .query(`
      INSERT INTO ${t.order_status_log} (order_id, sub_order_id, from_status, to_status, actor_user_id, note)
      VALUES (@order_id, @sub_order_id, @from_status, @to_status, @actor_user_id, @note)
    `)

  return { message: 'Status updated.', from_status: fromStatus, to_status: toStatus }
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchAllOrders(pool, mode, { search, statusFilter, limit = 100 }) {
  const t = tableNames(mode)
  
  let query = `
    SELECT o.order_id, o.store_id, o.order_no, o.status, o.order_kind, o.total_amount, o.subtotal_amount, o.gst_amount, o.created_at,
           c.full_name as customer_name, c.phone as customer_phone,
           s.store_name
    FROM ${t.orders} o
    LEFT JOIN dbo.pos_customers c ON o.customer_id = c.customer_id
    LEFT JOIN dbo.stores s ON o.store_id = s.store_id
    WHERE 1=1
  `
  
  if (statusFilter) {
    query += ` AND o.status = @status `
  }
  
  if (search) {
    query += ` AND (o.order_no LIKE @search OR c.full_name LIKE @search OR c.phone LIKE @search OR s.store_name LIKE @search) `
  }
  
  query += ` ORDER BY o.created_at DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY `
  
  const req = pool.request()
    .input('limit', sql.Int, limit)
    
  if (statusFilter) {
    req.input('status', sql.NVarChar(30), statusFilter)
  }
  if (search) {
    req.input('search', sql.NVarChar(200), '%' + search + '%')
  }
  
  const result = await req.query(query)
  
  return (result.recordset || []).map(row => ({
    order_id: row.order_id,
    store_id: row.store_id,
    store_name: row.store_name || 'Unknown Store',
    order_no: row.order_no,
    status: row.status,
    order_kind: row.order_kind,
    total_amount: Number(row.total_amount),
    subtotal_amount: Number(row.subtotal_amount),
    gst_amount: Number(row.gst_amount),
    created_at: row.created_at,
    customer_name: row.customer_name || 'Walk-in Customer',
    customer_phone: row.customer_phone || ''
  }))
}

/**
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchStoreOrders(pool, storeId, mode, { search, statusFilter, limit = 50 }) {
  const t = tableNames(mode)
  
  let query = `
    SELECT o.order_id, o.order_no, o.status, o.order_kind, o.total_amount, o.subtotal_amount, o.gst_amount, o.created_at,
           c.full_name as customer_name, c.phone as customer_phone
    FROM ${t.orders} o
    LEFT JOIN dbo.pos_customers c ON o.customer_id = c.customer_id
    WHERE o.store_id = @sid
  `
  
  if (statusFilter) {
    query += ` AND o.status = @status `
  }
  
  if (search) {
    query += ` AND (o.order_no LIKE @search OR c.full_name LIKE @search OR c.phone LIKE @search) `
  }
  
  query += ` ORDER BY o.created_at DESC OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY `
  
  const req = pool.request()
    .input('sid', sql.Int, storeId)
    .input('limit', sql.Int, limit)
    
  if (statusFilter) {
    req.input('status', sql.NVarChar(30), statusFilter)
  }
  if (search) {
    req.input('search', sql.NVarChar(200), '%' + search + '%')
  }
  
  const result = await req.query(query)
  
  return (result.recordset || []).map(row => ({
    order_id: row.order_id,
    order_no: row.order_no,
    status: row.status,
    order_kind: row.order_kind,
    total_amount: Number(row.total_amount),
    subtotal_amount: Number(row.subtotal_amount),
    gst_amount: Number(row.gst_amount),
    created_at: row.created_at,
    customer_name: row.customer_name || 'Walk-in Customer',
    customer_phone: row.customer_phone || ''
  }))
}

/**
 * CX dashboard aggregates (all stores). Uses active customer count from pos_customers.
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchCxSummary(pool, mode) {
  const t = tableNames(mode)
  const q = `
    SELECT
      (SELECT COUNT(*) FROM dbo.pos_customers WHERE is_active = 1) AS total_customers,
      (SELECT COUNT(*) FROM ${t.orders}) AS total_orders,
      (SELECT ISNULL(SUM(total_amount), 0) FROM ${t.orders}) AS total_revenue,
      (SELECT COUNT(DISTINCT customer_id) FROM ${t.orders} WHERE customer_id IS NOT NULL) AS customers_with_orders
  `
  const result = await pool.request().query(q)
  const row = (result.recordset && result.recordset[0]) || {}
  const totalOrders = Number(row.total_orders) || 0
  const totalRevenue = Number(row.total_revenue) || 0
  const avgOrderValue = totalOrders > 0 ? roundMoney(totalRevenue / totalOrders) : 0
  return {
    total_customers: Number(row.total_customers) || 0,
    total_orders: totalOrders,
    total_revenue: roundMoney(totalRevenue),
    customers_with_orders: Number(row.customers_with_orders) || 0,
    avg_order_value: avgOrderValue
  }
}

/**
 * Revenue rollup by store (for CX dashboard).
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchCxRevenueByStore(pool, mode, { limit = 30 } = {}) {
  const t = tableNames(mode)
  const lim = Math.min(500, Math.max(1, Number(limit) || 30))
  const q = `
    SELECT s.store_id,
           ISNULL(s.store_name, N'') AS store_name,
           COUNT(o.order_id) AS order_count,
           ISNULL(SUM(o.total_amount), 0) AS revenue
    FROM ${t.orders} o
    INNER JOIN dbo.stores s ON o.store_id = s.store_id
    GROUP BY s.store_id, s.store_name
    ORDER BY revenue DESC
    OFFSET 0 ROWS FETCH NEXT @lim ROWS ONLY
  `
  const result = await pool.request().input('lim', sql.Int, lim).query(q)
  return (result.recordset || []).map((r) => ({
    store_id: r.store_id,
    store_name: r.store_name || 'Store',
    order_count: Number(r.order_count) || 0,
    revenue: roundMoney(Number(r.revenue) || 0)
  }))
}

/**
 * All registered POS customers with lifetime order stats (LEFT JOIN orders).
 * @param {import('mssql').ConnectionPool} pool
 */
async function fetchCxCustomerRollup(pool, mode, { search, limit = 100 } = {}) {
  const t = tableNames(mode)
  const lim = Math.min(500, Math.max(1, Number(limit) || 100))
  let query = `
    SELECT c.customer_id,
           c.full_name,
           c.phone,
           ISNULL(c.email, N'') AS email,
           c.home_store_id,
           ISNULL(st.store_name, N'') AS home_store_name,
           COUNT(o.order_id) AS order_count,
           ISNULL(SUM(o.total_amount), 0) AS lifetime_revenue,
           MAX(o.created_at) AS last_order_at
    FROM dbo.pos_customers c
    LEFT JOIN ${t.orders} o ON o.customer_id = c.customer_id
    LEFT JOIN dbo.stores st ON c.home_store_id = st.store_id
    WHERE c.is_active = 1
  `
  const req = pool.request().input('lim', sql.Int, lim)
  if (search) {
    query += ` AND (c.full_name LIKE @search OR c.phone LIKE @search OR ISNULL(c.email, N'') LIKE @search) `
    req.input('search', sql.NVarChar(200), '%' + search + '%')
  }
  query += `
    GROUP BY c.customer_id, c.full_name, c.phone, c.email, c.home_store_id, st.store_name
    ORDER BY lifetime_revenue DESC, c.full_name ASC
    OFFSET 0 ROWS FETCH NEXT @lim ROWS ONLY
  `
  const result = await req.query(query)
  return (result.recordset || []).map((row) => ({
    customer_id: row.customer_id,
    full_name: row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    home_store_id: row.home_store_id,
    home_store_name: row.home_store_name || '',
    order_count: Number(row.order_count) || 0,
    lifetime_revenue: roundMoney(Number(row.lifetime_revenue) || 0),
    last_order_at: row.last_order_at || null
  }))
}

module.exports = {
  getOrdersEngineMode,
  ORDERS_ENGINE_MODE_KEY,
  validateOrderLinesAgainstConfig,
  buildPaymentSummary,
  validatePaymentAgainstSummary,
  fetchOrderBundle,
  mapOrderRowForApi,
  createOrderInTransaction,
  recordPayment,
  updateLabSubOrderStatus,
  fetchStoreOrders,
  fetchAllOrders,
  fetchCxSummary,
  fetchCxRevenueByStore,
  fetchCxCustomerRollup
}
