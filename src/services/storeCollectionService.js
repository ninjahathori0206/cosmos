'use strict';

const sql = require('mssql');
const { getPool, executeStoredProcedure } = require('../config/db');
const orderService = require('./orderService');
const { getPaymentMachineProviderLabel } = require('../config/paymentMachineProviderCatalog');
const { formatDateYmd } = require('../lib/cosmosIst');

async function getEngineMode(pool) {
  return orderService.getOrdersEngineMode(pool || await getPool());
}

function spStr(value) {
  return { type: sql.NVarChar, value: value != null ? value : null };
}

function spInt(value) {
  return { type: sql.Int, value: value != null ? value : null };
}

function spDate(value) {
  return { type: sql.Date, value: value != null ? value : null };
}

function spDec(value) {
  return { type: sql.Decimal(12, 2), value: value != null ? value : null };
}

function fmtIsoDateIst(value) {
  if (value == null) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  try {
    return formatDateYmd(value) || null;
  } catch (_) {
    return null;
  }
}

function mapSummaryRow(row) {
  if (!row) return null;
  return {
    store_id: row.store_id,
    store_cash_balance: Number(row.store_cash_balance) || 0,
    machine_upi_pending: Number(row.machine_upi_pending) || 0,
    machine_card_pending: Number(row.machine_card_pending) || 0,
    machine_total_pending: Number(row.machine_total_pending) || 0,
    store_bank_balance: Number(row.store_bank_balance) || 0,
    unsettled_machine_from: fmtIsoDateIst(row.unsettled_machine_from),
    unsettled_machine_to: fmtIsoDateIst(row.unsettled_machine_to),
    collected_today_cash: Number(row.collected_today_cash) || 0,
    collected_today_upi: Number(row.collected_today_upi) || 0,
    collected_today_card: Number(row.collected_today_card) || 0,
    collected_all_cash: Number(row.collected_all_cash) || 0,
    collected_all_upi: Number(row.collected_all_upi) || 0,
    collected_all_card: Number(row.collected_all_card) || 0,
    membership_store_cash_balance: Number(row.membership_store_cash_balance) || 0,
    membership_machine_upi_pending: Number(row.membership_machine_upi_pending) || 0,
    membership_machine_card_pending: Number(row.membership_machine_card_pending) || 0,
    membership_machine_total_pending: Number(row.membership_machine_total_pending) || 0,
    membership_store_bank_balance: Number(row.membership_store_bank_balance) || 0,
    membership_collected_today_cash: Number(row.membership_collected_today_cash) || 0,
    membership_collected_today_upi: Number(row.membership_collected_today_upi) || 0,
    membership_collected_today_card: Number(row.membership_collected_today_card) || 0
  };
}

async function getSummary(storeId) {
  const pool = await getPool();
  const engineMode = await getEngineMode(pool);
  const result = await executeStoredProcedure('sp_Treasury_GetSummary', {
    store_id: spInt(storeId),
    engine_mode: spStr(engineMode)
  });
  const row = (result.recordset || [])[0];
  const summary = mapSummaryRow(row) || mapSummaryRow({ store_id: storeId });

  const bankRes = await executeStoredProcedure('sp_Treasury_GetBankAccount', {
    store_id: spInt(storeId)
  });
  const machineRes = await executeStoredProcedure('sp_Treasury_GetPaymentMachine', {
    store_id: spInt(storeId)
  });
  const bank = (bankRes.recordset || [])[0] || null;
  const machine = (machineRes.recordset || [])[0] || null;

  return {
    ...summary,
    bank_account: bank,
    payment_machine: machine
      ? {
          ...machine,
          provider_label: getPaymentMachineProviderLabel(machine.provider_key)
        }
      : null
  };
}

async function getLedger(storeId, options = {}) {
  const pool = await getPool();
  const engineMode = await getEngineMode(pool);
  const result = await executeStoredProcedure('sp_Treasury_GetLedger', {
    store_id: spInt(storeId),
    engine_mode: spStr(engineMode),
    ledger_key: spStr(options.ledger_key || null),
    from_date: spDate(options.from_date || null),
    to_date: spDate(options.to_date || null),
    offset: spInt(options.offset != null ? Number(options.offset) : 0),
    limit: spInt(options.limit != null ? Number(options.limit) : 100)
  });
  return (result.recordset || []).map((r) => ({
    row_type: r.row_type,
    source_id: r.source_id,
    order_id: r.order_id,
    order_no: r.order_no,
    entry_date: r.entry_date,
    entry_at: r.entry_at,
    ledger_key: r.ledger_key,
    sub_method: r.sub_method,
    direction: r.direction,
    amount: Number(r.amount) || 0,
    charges_amount: r.charges_amount != null ? Number(r.charges_amount) : null,
    net_amount: r.net_amount != null ? Number(r.net_amount) : null,
    external_ref: r.external_ref,
    bank_ref: r.bank_ref,
    payment_stage: r.payment_stage
  }));
}

async function getStoresSummary() {
  const pool = await getPool();
  const engineMode = await getEngineMode(pool);
  const result = await executeStoredProcedure('sp_Treasury_GetStoresSummary', {
    engine_mode: spStr(engineMode)
  });
  return (result.recordset || []).map((r) => ({
    store_id: r.store_id,
    store_name: r.store_name,
    store_code: r.store_code,
    store_cash_balance: Number(r.store_cash_balance) || 0,
    machine_upi_pending: Number(r.machine_upi_pending) || 0,
    machine_card_pending: Number(r.machine_card_pending) || 0,
    machine_total_pending: Number(r.machine_total_pending) || 0,
    store_bank_balance: Number(r.store_bank_balance) || 0,
    machine_provider_key: r.machine_provider_key || null,
    machine_provider_label: r.machine_provider_key
      ? getPaymentMachineProviderLabel(r.machine_provider_key)
      : null,
    has_bank_account: !!r.has_bank_account
  }));
}

async function suggestMachineGross(storeId, periodFrom, periodTo) {
  const pool = await getPool();
  const engineMode = await getEngineMode(pool);
  const result = await executeStoredProcedure('sp_Treasury_SuggestMachineGross', {
    store_id: spInt(storeId),
    period_from: spDate(periodFrom),
    period_to: spDate(periodTo),
    engine_mode: spStr(engineMode)
  });
  const row = (result.recordset || [])[0] || {};
  return {
    upi_gross: Number(row.upi_gross) || 0,
    card_gross: Number(row.card_gross) || 0,
    total_gross: Number(row.total_gross) || 0
  };
}

async function createCashDeposit(storeId, body, createdBy) {
  const pool = await getPool();
  const engineMode = await getEngineMode(pool);
  const req = pool.request();
  req.input('store_id', sql.Int, storeId);
  req.input('transfer_type', sql.NVarChar(30), 'cash_deposit');
  req.input('period_from', sql.Date, null);
  req.input('period_to', sql.Date, null);
  req.input('gross_amount', sql.Decimal(12, 2), body.gross_amount);
  req.input('charges_amount', sql.Decimal(12, 2), 0);
  req.input('net_amount', sql.Decimal(12, 2), body.gross_amount);
  req.input('bank_account_id', sql.Int, body.bank_account_id || null);
  req.input('bank_ref', sql.NVarChar(200), body.bank_ref || null);
  req.input('transfer_date', sql.Date, body.transfer_date);
  req.input('notes', sql.NVarChar(500), body.notes || null);
  req.input('created_by', sql.Int, createdBy || null);
  req.input('engine_mode', sql.NVarChar(10), engineMode);
  req.output('transfer_id', sql.Int);
  await req.execute('sp_Treasury_CreateTransfer');
  return { transfer_id: req.parameters.transfer_id.value };
}

async function createMachineSettlement(storeId, body, createdBy) {
  const pool = await getPool();
  const engineMode = await getEngineMode(pool);
  const req = pool.request();
  req.input('store_id', sql.Int, storeId);
  req.input('transfer_type', sql.NVarChar(30), 'machine_settlement');
  req.input('period_from', sql.Date, body.period_from);
  req.input('period_to', sql.Date, body.period_to);
  req.input('gross_amount', sql.Decimal(12, 2), body.gross_amount);
  req.input('charges_amount', sql.Decimal(12, 2), body.charges_amount || 0);
  req.input('net_amount', sql.Decimal(12, 2), body.net_amount);
  req.input('bank_account_id', sql.Int, body.bank_account_id || null);
  req.input('bank_ref', sql.NVarChar(200), body.bank_ref || null);
  req.input('transfer_date', sql.Date, body.transfer_date);
  req.input('notes', sql.NVarChar(500), body.notes || null);
  req.input('created_by', sql.Int, createdBy || null);
  req.input('engine_mode', sql.NVarChar(10), engineMode);
  req.output('transfer_id', sql.Int);
  await req.execute('sp_Treasury_CreateTransfer');
  return { transfer_id: req.parameters.transfer_id.value };
}

async function voidTransfer(transferId, voidReason, voidedBy) {
  await executeStoredProcedure('sp_Treasury_VoidTransfer', {
    transfer_id: spInt(transferId),
    void_reason: spStr(voidReason || null),
    voided_by: spInt(voidedBy || null)
  });
  return { transfer_id: transferId, status: 'void' };
}

async function upsertBankAccount(storeId, body) {
  const pool = await getPool();
  const req = pool.request();
  req.input('store_id', sql.Int, storeId);
  req.input('bank_name', sql.NVarChar(200), body.bank_name);
  req.input('account_no', sql.NVarChar(50), body.account_no);
  req.input('ifsc', sql.NVarChar(20), body.ifsc || null);
  req.input('account_holder', sql.NVarChar(200), body.account_holder || null);
  req.input('opening_balance', sql.Decimal(12, 2), body.opening_balance != null ? Number(body.opening_balance) : 0);
  req.input('existing_bank_account_id', sql.Int, body.bank_account_id || null);
  req.output('bank_account_id', sql.Int);
  await req.execute('sp_Treasury_UpsertBankAccount');
  const bankAccountId = req.parameters.bank_account_id.value;
  const res = await executeStoredProcedure('sp_Treasury_GetBankAccount', {
    store_id: spInt(storeId)
  });
  return (res.recordset || [])[0] || { bank_account_id: bankAccountId };
}

async function upsertPaymentMachine(storeId, body) {
  await executeStoredProcedure('sp_Treasury_UpsertPaymentMachine', {
    store_id: spInt(storeId),
    provider_key: spStr(body.provider_key),
    merchant_id: spStr(body.merchant_id || null),
    terminal_label: spStr(body.terminal_label || null)
  });
  const res = await executeStoredProcedure('sp_Treasury_GetPaymentMachine', {
    store_id: spInt(storeId)
  });
  const row = (res.recordset || [])[0] || null;
  if (row) row.provider_label = getPaymentMachineProviderLabel(row.provider_key);
  return row;
}

async function getBankAccount(storeId) {
  const res = await executeStoredProcedure('sp_Treasury_GetBankAccount', {
    store_id: spInt(storeId)
  });
  return (res.recordset || [])[0] || null;
}

async function getPaymentMachine(storeId) {
  const res = await executeStoredProcedure('sp_Treasury_GetPaymentMachine', {
    store_id: spInt(storeId)
  });
  const row = (res.recordset || [])[0] || null;
  if (row) row.provider_label = getPaymentMachineProviderLabel(row.provider_key);
  return row;
}

module.exports = {
  getSummary,
  getLedger,
  getStoresSummary,
  suggestMachineGross,
  createCashDeposit,
  createMachineSettlement,
  voidTransfer,
  upsertBankAccount,
  upsertPaymentMachine,
  getBankAccount,
  getPaymentMachine
};
