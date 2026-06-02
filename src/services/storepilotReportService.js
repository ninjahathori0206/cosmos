'use strict';

const sql = require('mssql');
const { getPool, executeStoredProcedure } = require('../config/db');
const orderService = require('./orderService');
const { formatDateYmd } = require('../lib/cosmosIst');

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

function mapDayStoreRow(row) {
  if (!row) return null;
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
      cash: roundMoney(row.cash_collection)
    },
    membership_collection: {
      total: roundMoney(row.membership_collection_total),
      bank: roundMoney(row.membership_bank_collection),
      cash: roundMoney(row.membership_cash_collection)
    },
    memberships_sold: Number(row.memberships_sold) || 0
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
  const result = await executeStoredProcedure('sp_StorePilot_DayStoreReport', {
    store_id: spInt(storeId),
    report_date: spDate(reportDateYmd || null),
    engine_mode: spStr(engineMode)
  });
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
    });
  }
  return mapDayStoreRow(row);
}

module.exports = {
  getDayStoreReport
};
