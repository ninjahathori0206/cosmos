'use strict';

const express = require('express');
const Joi = require('joi');
const {
  requireModule,
  requireAnyModule,
  requirePermission
} = require('../middleware/authorize');
const storeCollectionService = require('../services/storeCollectionService');
const { isAllowedPaymentMachineProvider } = require('../config/paymentMachineProviderCatalog');

const router = express.Router();

const spCollectionsView = [
  requireAnyModule(['storepilot', 'finance']),
  requirePermission('storepilot.collections.view', 'finance.collections.view')
];
const spCollectionsDeposit = [
  requireAnyModule(['storepilot', 'finance']),
  requirePermission('storepilot.collections.deposit', 'finance.collections.deposit')
];
const spCollectionsSettle = [
  requireAnyModule(['storepilot', 'finance']),
  requirePermission('storepilot.collections.settle', 'finance.collections.settle')
];
const financeCollectionsManage = [
  requireModule('finance'),
  requirePermission('finance.collections.bank_accounts.manage', 'finance.collections.machine.manage')
];

function hasFinanceCollectionsView(req) {
  const perms = Array.isArray(req.user && req.user.permissions)
    ? req.user.permissions.map((p) => String(p).toLowerCase())
    : [];
  return perms.includes('finance.collections.view');
}

function resolveStoreId(req, res) {
  const queryStoreId = req.query.store_id ? parseInt(req.query.store_id, 10) : null;
  const bodyStoreId = req.body && req.body.store_id ? parseInt(req.body.store_id, 10) : null;
  const jwtStoreId = req.user && req.user.store_id != null ? Number(req.user.store_id) : null;

  if (hasFinanceCollectionsView(req)) {
    const sid = queryStoreId || bodyStoreId || jwtStoreId;
    if (!sid || Number.isNaN(sid)) {
      res.status(400).json({ success: false, message: 'store_id is required.' });
      return null;
    }
    return sid;
  }

  if (!jwtStoreId) {
    res.status(403).json({ success: false, message: 'Store context is required.' });
    return null;
  }
  return jwtStoreId;
}

const cashDepositSchema = Joi.object({
  store_id: Joi.number().integer().positive().optional(),
  gross_amount: Joi.number().positive().required(),
  bank_account_id: Joi.number().integer().positive().allow(null),
  bank_ref: Joi.string().max(200).allow('', null),
  transfer_date: Joi.string().isoDate().required(),
  notes: Joi.string().max(500).allow('', null)
});

const machineSettlementSchema = Joi.object({
  store_id: Joi.number().integer().positive().optional(),
  period_from: Joi.string().isoDate().required(),
  period_to: Joi.string().isoDate().required(),
  gross_amount: Joi.number().positive().required(),
  charges_amount: Joi.number().min(0).default(0),
  net_amount: Joi.number().min(0).required(),
  bank_account_id: Joi.number().integer().positive().allow(null),
  bank_ref: Joi.string().max(200).allow('', null),
  transfer_date: Joi.string().isoDate().required(),
  notes: Joi.string().max(500).allow('', null)
}).custom((value, helpers) => {
  const gross = Number(value.gross_amount);
  const charges = Number(value.charges_amount || 0);
  const net = Number(value.net_amount);
  if (Math.abs(gross - charges - net) > 0.02) {
    return helpers.error('any.custom', { message: 'Net amount must equal gross minus charges.' });
  }
  if (value.period_from > value.period_to) {
    return helpers.error('any.custom', { message: 'period_from must be on or before period_to.' });
  }
  return value;
});

const bankAccountSchema = Joi.object({
  store_id: Joi.number().integer().positive().required(),
  bank_name: Joi.string().max(200).required(),
  account_no: Joi.string().max(50).required(),
  ifsc: Joi.string().max(20).allow('', null),
  account_holder: Joi.string().max(200).allow('', null),
  opening_balance: Joi.number().default(0),
  bank_account_id: Joi.number().integer().positive().allow(null)
});

const joiValidateOpts = { convert: true, abortEarly: true };

function normalizeBankAccountBody(body) {
  const b = body && typeof body === 'object' ? { ...body } : {};
  const raw = b.opening_balance;
  if (raw == null || raw === '') {
    b.opening_balance = 0;
  } else {
    const n = Number(raw);
    b.opening_balance = Number.isFinite(n) ? n : 0;
  }
  return b;
}

const paymentMachineSchema = Joi.object({
  store_id: Joi.number().integer().positive().required(),
  provider_key: Joi.string().max(50).required(),
  merchant_id: Joi.string().max(100).allow('', null),
  terminal_label: Joi.string().max(200).allow('', null)
}).custom((value, helpers) => {
  if (!isAllowedPaymentMachineProvider(value.provider_key)) {
    return helpers.error('any.custom', { message: 'Invalid payment machine provider.' });
  }
  return value;
});

const voidSchema = Joi.object({
  void_reason: Joi.string().max(300).allow('', null)
});

function actorUserId(req) {
  if (req.user.user_id != null) return Number(req.user.user_id);
  if (req.user.employee_id != null) return Number(req.user.employee_id);
  return null;
}

router.get('/summary', ...spCollectionsView, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;
    const data = await storeCollectionService.getSummary(storeId);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/ledger', ...spCollectionsView, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;
    const data = await storeCollectionService.getLedger(storeId, {
      ledger_key: req.query.ledger_key || null,
      from_date: req.query.from_date || null,
      to_date: req.query.to_date || null,
      offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100
    });
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/stores-summary', requireModule('finance'), requirePermission('finance.collections.view'), async (req, res, next) => {
  try {
    const data = await storeCollectionService.getStoresSummary();
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/suggest-machine-gross', ...spCollectionsSettle, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;
    const { error, value } = Joi.object({
      period_from: Joi.string().isoDate().required(),
      period_to: Joi.string().isoDate().required()
    }).validate(req.query);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const data = await storeCollectionService.suggestMachineGross(storeId, value.period_from, value.period_to);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/bank-account', ...spCollectionsView, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;
    const data = await storeCollectionService.getBankAccount(storeId);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.get('/payment-machine', ...spCollectionsView, async (req, res, next) => {
  try {
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;
    const data = await storeCollectionService.getPaymentMachine(storeId);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.post('/bank-account', ...financeCollectionsManage, async (req, res, next) => {
  try {
    const { error, value } = bankAccountSchema.validate(normalizeBankAccountBody(req.body), joiValidateOpts);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const data = await storeCollectionService.upsertBankAccount(value.store_id, value);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.post('/payment-machine', ...financeCollectionsManage, async (req, res, next) => {
  try {
    const { error, value } = paymentMachineSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const data = await storeCollectionService.upsertPaymentMachine(value.store_id, value);
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.post('/cash-deposit', ...spCollectionsDeposit, async (req, res, next) => {
  try {
    const { error, value } = cashDepositSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;
    const data = await storeCollectionService.createCashDeposit(storeId, value, actorUserId(req));
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.post('/machine-settlement', ...spCollectionsSettle, async (req, res, next) => {
  try {
    const { error, value } = machineSettlementSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const storeId = resolveStoreId(req, res);
    if (storeId == null) return;
    const data = await storeCollectionService.createMachineSettlement(storeId, value, actorUserId(req));
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

router.put('/transfers/:id/void', ...spCollectionsSettle, async (req, res, next) => {
  try {
    const transferId = parseInt(req.params.id, 10);
    if (!transferId) {
      return res.status(400).json({ success: false, message: 'Invalid transfer id.' });
    }
    const { error, value } = voidSchema.validate(req.body || {});
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const data = await storeCollectionService.voidTransfer(transferId, value.void_reason, actorUserId(req));
    res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
