'use strict';

const sql = require('mssql');
const { getPool, executeStoredProcedure } = require('../config/db');
const orderService = require('./orderService');
const { formatDateYmd, todayYmd } = require('../lib/cosmosIst');

function spInt(value) {
  return { type: sql.Int, value: value != null ? value : null };
}

function spStr(value) {
  return { type: sql.NVarChar, value: value != null ? value : null };
}

function spDate(value) {
  return { type: sql.Date, value: value != null ? value : null };
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function resolveEngineTables(engineMode) {
  if (String(engineMode || '').toLowerCase() === 'legacy') {
    return { ordersTable: 'dbo.pos_orders', paymentsTable: 'dbo.pos_payments' };
  }
  return { ordersTable: 'dbo.oe_orders', paymentsTable: 'dbo.oe_payments' };
}

function mapCollectionChannel(row) {
  if (!row) {
    return { total: 0, bank: 0, cash: 0 };
  }
  return {
    total: roundMoney(row.total),
    bank: roundMoney(row.bank),
    cash: roundMoney(row.cash)
  };
}

function mapDayStoreRow(row, collectionSplit) {
  if (!row) return null;
  const split = collectionSplit || {};
  return {
    store_id: Number(row.store_id) || 0,
    store_name: row.store_name || '',
    report_date: row.report_date
      ? (typeof row.report_date === 'string'
        ? row.report_date.slice(0, 10)
        : formatDateYmd(row.report_date))
      : null,
    invoiced: {
      revenue: roundMoney(row.invoiced_revenue),
      bill_count: Number(row.bill_count) || 0,
      avg_invoice_amount: roundMoney(row.avg_invoice_amount)
    },
    booking: {
      revenue: roundMoney(row.booking_revenue),
      order_count: Number(row.booking_count) || 0,
      avg_booking_amount: roundMoney(row.avg_booking_amount)
    },
    collection: {
      total: roundMoney(row.collection_total),
      bank: roundMoney(row.bank_collection),
      cash: roundMoney(row.cash_collection),
      new_order: mapCollectionChannel(split.new_order),
      handover: mapCollectionChannel(split.handover)
    },
    membership_collection: {
      total: roundMoney(row.membership_collection_total),
      bank: roundMoney(row.membership_bank_collection),
      cash: roundMoney(row.membership_cash_collection)
    },
    memberships_sold: Number(row.memberships_sold) || 0
  };
}

async function queryCollectionSplit(pool, storeId, reportDateYmd, engineMode) {
  const { ordersTable, paymentsTable } = resolveEngineTables(engineMode);
  const result = await pool.request()
    .input('store_id', sql.Int, storeId)
    .input('report_date', sql.Date, reportDateYmd)
    .query(`
      SELECT
        ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.stage))) IN (N'ADVANCE', N'FULL') THEN p.amount ELSE 0 END), 0) AS new_order_total,
        ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.stage))) IN (N'ADVANCE', N'FULL') AND UPPER(LTRIM(RTRIM(p.method))) = N'CASH' THEN p.amount ELSE 0 END), 0) AS new_order_cash,
        ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.stage))) IN (N'ADVANCE', N'FULL') AND UPPER(LTRIM(RTRIM(p.method))) IN (N'UPI', N'CARD') THEN p.amount ELSE 0 END), 0) AS new_order_bank,
        ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.stage))) = N'BALANCE' THEN p.amount ELSE 0 END), 0) AS handover_total,
        ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.stage))) = N'BALANCE' AND UPPER(LTRIM(RTRIM(p.method))) = N'CASH' THEN p.amount ELSE 0 END), 0) AS handover_cash,
        ISNULL(SUM(CASE WHEN UPPER(LTRIM(RTRIM(p.stage))) = N'BALANCE' AND UPPER(LTRIM(RTRIM(p.method))) IN (N'UPI', N'CARD') THEN p.amount ELSE 0 END), 0) AS handover_bank
      FROM ${paymentsTable} p
      INNER JOIN ${ordersTable} o ON o.order_id = p.order_id
      WHERE o.store_id = @store_id
        AND CONVERT(DATE, p.created_at) = @report_date
        AND ISNULL(o.status, N'') <> N'CANCELLED'
        AND UPPER(LTRIM(RTRIM(ISNULL(o.order_kind, N'')))) <> N'MEMBERSHIP'
    `);
  const row = (result.recordset || [])[0] || {};
  return {
    new_order: {
      total: row.new_order_total,
      cash: row.new_order_cash,
      bank: row.new_order_bank
    },
    handover: {
      total: row.handover_total,
      cash: row.handover_cash,
      bank: row.handover_bank
    }
  };
}

function mapCollectionLineRow(row) {
  return {
    payment_id: Number(row.payment_id) || 0,
    order_id: Number(row.order_id) || 0,
    order_no: row.order_no || '',
    customer_name: row.customer_name || '',
    customer_phone: row.customer_phone || '',
    amount: roundMoney(row.amount),
    method: row.method || '',
    payment_stage: row.payment_stage || '',
    external_ref: row.external_ref || '',
    collected_at: row.created_at || null
  };
}

/**
 * Daily store snapshot for StorePilot reports (IST calendar date).
 * @param {number} storeId
 * @param {string|null} reportDateYmd YYYY-MM-DD or null for today IST
 */
async function getDayStoreReport(storeId, reportDateYmd) {
  const pool = await getPool();
  const engineMode = await orderService.getOrdersEngineMode(pool);
  const reportDate = reportDateYmd || todayYmd();
  const [result, collectionSplit] = await Promise.all([
    executeStoredProcedure('sp_StorePilot_DayStoreReport', {
      store_id: spInt(storeId),
      report_date: spDate(reportDateYmd || null),
      engine_mode: spStr(engineMode)
    }),
    queryCollectionSplit(pool, storeId, reportDate, engineMode)
  ]);
  const row = (result.recordset || [])[0];
  if (!row) {
    return mapDayStoreRow({
      store_id: storeId,
      report_date: reportDateYmd,
      store_name: '',
      invoiced_revenue: 0,
      bill_count: 0,
      avg_invoice_amount: 0,
      booking_revenue: 0,
      booking_count: 0,
      avg_booking_amount: 0,
      collection_total: 0,
      bank_collection: 0,
      cash_collection: 0,
      membership_collection_total: 0,
      membership_bank_collection: 0,
      membership_cash_collection: 0,
      memberships_sold: 0
    }, collectionSplit);
  }
  return mapDayStoreRow(row, collectionSplit);
}

/**
 * Payment lines for a collection channel on the report date.
 * @param {number} storeId
 * @param {string} reportDateYmd
 * @param {'new_order'|'handover'} channel
 */
async function getDayStoreCollectionLines(storeId, reportDateYmd, channel) {
  const pool = await getPool();
  const engineMode = await orderService.getOrdersEngineMode(pool);
  const { ordersTable, paymentsTable } = resolveEngineTables(engineMode);
  const channelNorm = String(channel || '').toLowerCase() === 'handover' ? 'handover' : 'new_order';
  const result = await pool.request()
    .input('store_id', sql.Int, storeId)
    .input('report_date', sql.Date, reportDateYmd)
    .input('channel', sql.NVarChar(20), channelNorm)
    .query(`
      SELECT
        p.payment_id,
        o.order_id,
        o.order_no,
        ISNULL(c.full_name, N'') AS customer_name,
        ISNULL(c.phone, N'') AS customer_phone,
        p.amount,
        UPPER(LTRIM(RTRIM(p.method))) AS method,
        UPPER(LTRIM(RTRIM(p.stage))) AS payment_stage,
        p.external_ref,
        p.created_at
      FROM ${paymentsTable} p
      INNER JOIN ${ordersTable} o ON o.order_id = p.order_id
      LEFT JOIN dbo.pos_customers c ON c.customer_id = o.customer_id
      WHERE o.store_id = @store_id
        AND CONVERT(DATE, p.created_at) = @report_date
        AND ISNULL(o.status, N'') <> N'CANCELLED'
        AND UPPER(LTRIM(RTRIM(ISNULL(o.order_kind, N'')))) <> N'MEMBERSHIP'
        AND (
          (@channel = N'handover' AND UPPER(LTRIM(RTRIM(p.stage))) = N'BALANCE')
          OR (@channel <> N'handover' AND UPPER(LTRIM(RTRIM(p.stage))) IN (N'ADVANCE', N'FULL'))
        )
      ORDER BY p.created_at DESC, p.payment_id DESC
    `);
  return (result.recordset || []).map(mapCollectionLineRow);
}

module.exports = {
  getDayStoreReport,
  getDayStoreCollectionLines
};
