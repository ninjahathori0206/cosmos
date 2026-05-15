const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure, getPool } = require('../config/db');
const { requireModule, requirePermission } = require('../middleware/authorize');

const router = express.Router();

// financeView accepts any of the three sub-feature view permissions (OR logic)
const financeView = [
  requireModule('finance'),
  requirePermission(
    'finance.dashboard.view', 'finance.payments.view', 'finance.reports.view',
    'finance.challan_valuation.view', 'finance.purchase_invoices.view'
  )
];
const financeValuationView = [requireModule('finance'), requirePermission('finance.challan_valuation.view')];
const financeValuationCreate = [requireModule('finance'), requirePermission('finance.challan_valuation.create')];
const financeInvoiceView = [requireModule('finance'), requirePermission('finance.purchase_invoices.view')];
const financeInvoiceCreate = [requireModule('finance'), requirePermission('finance.purchase_invoices.create')];
const financePaymentsCreate = [requireModule('finance'), requirePermission('finance.payments.create')];
const financePaymentsEdit   = [requireModule('finance'), requirePermission('finance.payments.edit')];

// ── Validation schemas ────────────────────────────────────────────────────────

const allocationSchema = Joi.object({
  invoice_id:    Joi.number().integer().required(),
  allocated_amt: Joi.number().positive().required()
});

const paymentSchema = Joi.object({
  supplier_id:   Joi.number().integer().required(),
  payment_date:  Joi.string().isoDate().required(),
  amount:        Joi.number().positive().required(),
  payment_mode:  Joi.string().valid('NEFT','RTGS','CHEQUE','CASH','UPI').default('NEFT'),
  reference_no:  Joi.string().max(100).allow('', null),
  bank_account:  Joi.string().max(100).allow('', null),
  notes:         Joi.string().max(500).allow('', null),
  allocations:   Joi.array().items(allocationSchema).min(1).required()
}).custom((value, helpers) => {
  const allocTotal = (value.allocations || []).reduce((s, a) => s + Number(a.allocated_amt), 0);
  if (Math.abs(allocTotal - Number(value.amount)) > 0.02) {
    return helpers.error('any.custom', {
      message: 'Payment amount must equal the sum of invoice allocations'
    });
  }
  return value;
});

const voidSchema = Joi.object({
  void_reason: Joi.string().max(300).allow('', null)
});

const creditDaysSchema = Joi.object({
  credit_days: Joi.number().integer().min(0).max(365).allow(null)
});

const valuationLineSchema = Joi.object({
  item_id: Joi.number().integer().required(),
  purchase_rate: Joi.number().precision(2).min(0).required()
});

const challanValuationSchema = Joi.object({
  finance_transport_amt: Joi.number().precision(2).min(0).default(0),
  lines: Joi.array().items(valuationLineSchema).min(1).required()
});

const supplierInvoiceSchema = Joi.object({
  supplier_id: Joi.number().integer().required(),
  invoice_number: Joi.string().max(100).required(),
  invoice_date: Joi.string().isoDate().required(),
  taxable_amt: Joi.number().precision(2).min(0).required(),
  cgst_amt: Joi.number().precision(2).min(0).default(0),
  sgst_amt: Joi.number().precision(2).min(0).default(0),
  igst_amt: Joi.number().precision(2).min(0).default(0),
  total_amt: Joi.number().precision(2).positive().required(),
  file_url: Joi.string().max(500).allow('', null),
  discrepancy_note: Joi.string().max(500).allow('', null)
}).custom((value, helpers) => {
  const sum = Number(value.taxable_amt) + Number(value.cgst_amt) + Number(value.sgst_amt) + Number(value.igst_amt);
  const total = Number(value.total_amt);
  if (Math.abs(sum - total) > 0.02) {
    return helpers.error('any.custom', {
      message: 'total_amt must equal taxable_amt + cgst_amt + sgst_amt + igst_amt'
    });
  }
  return value;
});

// ── GET /api/finance/dashboard ───────────────────────────────────────────────
router.get('/dashboard', ...financeView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Finance_DashboardStats', {});
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/supplier-summary ────────────────────────────────────────
// Optional ?supplier_id=N to get a single supplier summary row.
router.get('/supplier-summary', ...financeView, async (req, res, next) => {
  try {
    const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const result = await executeStoredProcedure('sp_Finance_SupplierSummary', {
      supplier_id: { type: sql.Int, value: supplierId }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/supplier/:id/statement ───────────────────────────────────
router.get('/supplier/:id/statement', ...financeView, async (req, res, next) => {
  try {
    const supplierId = Number(req.params.id);
    const result = await executeStoredProcedure('sp_Finance_SupplierStatement', {
      supplier_id: { type: sql.Int, value: supplierId }
    });
    // SP returns 3 result sets: supplier info, bills, payments
    const [supplierRows, billRows, paymentRows] = result.recordsets || [[], [], []];
    const supplier = supplierRows && supplierRows[0];
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }

    // Parse allocations_json on each payment row
    const payments = (paymentRows || []).map((p) => {
      let allocations = [];
      try { allocations = p.allocations_json ? JSON.parse(p.allocations_json) : []; } catch (_) {}
      return { ...p, allocations };
    });

    return res.json({
      success: true,
      data: {
        supplier,
        bills: billRows || [],
        payments
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ── PUT /api/finance/supplier/:id/credit-days ─────────────────────────────────
router.put('/supplier/:id/credit-days', ...financePaymentsEdit, async (req, res, next) => {
  try {
    const supplierId = Number(req.params.id);
    const { error, value } = creditDaysSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const result = await executeStoredProcedure('sp_Supplier_SetCreditDays', {
      supplier_id:  { type: sql.Int, value: supplierId },
      credit_days:  { type: sql.Int, value: value.credit_days !== undefined ? value.credit_days : null }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/outstanding-invoices?supplier_id=N ───────────────────────
router.get('/outstanding-invoices', ...financeView, async (req, res, next) => {
  try {
    const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'supplier_id query param required' });
    }
    const result = await executeStoredProcedure('sp_Finance_OutstandingInvoices', {
      supplier_id: { type: sql.Int, value: supplierId }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/payments?supplier_id=N ───────────────────────────────────
router.get('/payments', ...financeView, async (req, res, next) => {
  try {
    const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    if (!supplierId) {
      return res.status(400).json({ success: false, message: 'supplier_id query param required' });
    }
    const pool = await getPool();
    const rows = await pool.request()
      .input('sid', sql.Int, supplierId)
      .query(`
        SELECT sp.payment_id, sp.supplier_id, sp.payment_date, sp.amount,
               sp.payment_mode, sp.reference_no, sp.bank_account, sp.notes,
               sp.is_void, sp.void_reason, sp.created_at,
               (SELECT pia.invoice_id, pia.allocated_amt, spi.invoice_number
                  FROM dbo.payment_invoice_allocations pia
                  JOIN dbo.supplier_purchase_invoices spi ON spi.invoice_id = pia.invoice_id
                 WHERE pia.payment_id = sp.payment_id
                   FOR JSON PATH) AS allocations_json
          FROM dbo.supplier_payments sp
         WHERE sp.supplier_id = @sid
         ORDER BY sp.payment_date DESC, sp.payment_id DESC
      `);
    const data = (rows.recordset || []).map((p) => {
      let allocations = [];
      try { allocations = p.allocations_json ? JSON.parse(p.allocations_json) : []; } catch (_) {}
      return { ...p, allocations };
    });
    return res.json({ success: true, data });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/finance/payments ────────────────────────────────────────────────
router.post('/payments', ...financePaymentsCreate, async (req, res, next) => {
  try {
    const { error, value } = paymentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }

    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;
    const allocJson = JSON.stringify(value.allocations);

    const result = await executeStoredProcedure('sp_Finance_Payment_Create', {
      supplier_id:       { type: sql.Int,          value: value.supplier_id },
      payment_date:      { type: sql.Date,          value: value.payment_date },
      amount:            { type: sql.Decimal(12,2), value: value.amount },
      payment_mode:      { type: sql.VarChar(30),   value: value.payment_mode },
      reference_no:      { type: sql.VarChar(100),  value: value.reference_no || null },
      bank_account:      { type: sql.VarChar(100),  value: value.bank_account || null },
      notes:             { type: sql.VarChar(500),  value: value.notes || null },
      created_by:        { type: sql.Int,           value: userId },
      allocations_json:  { type: sql.NVarChar(sql.MAX), value: allocJson }
    });

    return res.status(201).json({
      success: true,
      data: result.recordset && result.recordset[0]
    });
  } catch (err) {
    if (err.code === 'EREQUEST') {
      return res.status(422).json({ success: false, message: err.message });
    }
    return next(err);
  }
});

// ── GET /api/finance/purchase-report ─────────────────────────────────────────
// Query params: from_date, to_date, supplier_id, pipeline_status, category
// Returns { summary, supplierBreakdown, bills }
router.get('/purchase-report', ...financeView, async (req, res, next) => {
  try {
    const { from_date, to_date, supplier_id, pipeline_status, category } = req.query;
    const result = await executeStoredProcedure('sp_Finance_PurchaseReport', {
      from_date:       { type: sql.Date,       value: from_date       || null },
      to_date:         { type: sql.Date,       value: to_date         || null },
      supplier_id:     { type: sql.Int,        value: supplier_id     ? Number(supplier_id) : null },
      pipeline_status: { type: sql.VarChar(50), value: pipeline_status || null },
      category:        { type: sql.VarChar(50), value: category        || null }
    });
    const [summaryRows, supplierRows, billRows] = result.recordsets || [[], [], []];
    return res.json({
      success: true,
      data: {
        summary:           summaryRows && summaryRows[0],
        supplierBreakdown: supplierRows || [],
        bills:             billRows     || []
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/item-finance ────────────────────────────────────────────
// Query params: brand_id, product_type, status, q
// Returns { summary, items }
router.get('/item-finance', ...financeView, async (req, res, next) => {
  try {
    const { brand_id, product_type, status, q } = req.query;
    const result = await executeStoredProcedure('sp_Finance_ItemFinance', {
      brand_id:     { type: sql.Int,         value: brand_id     ? Number(brand_id) : null },
      product_type: { type: sql.VarChar(50),  value: product_type || null },
      status:       { type: sql.VarChar(30),  value: status       || null },
      q:            { type: sql.VarChar(200), value: q            || null }
    });
    const [summaryRows, itemRows] = result.recordsets || [[], []];
    return res.json({
      success: true,
      data: {
        summary: summaryRows && summaryRows[0],
        items:   itemRows   || []
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/item-finance/filters ─────────────────────────────────────
router.get('/item-finance/filters', ...financeView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Finance_ItemFinance_Filters', {});
    const [brandRows, typeRows] = result.recordsets || [[], []];
    return res.json({
      success: true,
      data: {
        brands:       brandRows || [],
        productTypes: (typeRows || []).map((r) => r.product_type)
      }
    });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/purchase-report/categories ───────────────────────────────
router.get('/purchase-report/categories', ...financeView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Finance_PurchaseReport_Categories', {});
    return res.json({ success: true, data: (result.recordset || []).map((r) => r.category) });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/challans?supplier_id=&unvalued_only=1 ───────────────────
router.get('/challans', ...financeValuationView, async (req, res, next) => {
  try {
    const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const unvaluedOnly = req.query.unvalued_only !== '0';
    const result = await executeStoredProcedure('sp_Challan_ListForValuation', {
      supplier_id: { type: sql.Int, value: supplierId },
      unvalued_only: { type: sql.Bit, value: unvaluedOnly ? 1 : 0 }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) { return next(err); }
});

// ── GET /api/finance/challans/:id/valuation ───────────────────────────────────
router.get('/challans/:id/valuation', ...financeValuationView, async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Challan_GetValuationDetail', {
      header_id: { type: sql.Int, value: Number(req.params.id) }
    });
    const header = result.recordsets[0] && result.recordsets[0][0];
    if (!header) return res.status(404).json({ success: false, message: 'Challan not found' });
    return res.json({ success: true, data: { header, items: result.recordsets[1] || [] } });
  } catch (err) { return next(err); }
});

// ── PUT /api/finance/challans/:id/valuation ───────────────────────────────────
router.put('/challans/:id/valuation', ...financeValuationCreate, async (req, res, next) => {
  try {
    const { error, value } = challanValuationSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;
    const result = await executeStoredProcedure('sp_Challan_SetPayable', {
      header_id: { type: sql.Int, value: Number(req.params.id) },
      finance_transport_amt: { type: sql.Decimal(12, 2), value: value.finance_transport_amt || 0 },
      lines_json: { type: sql.NVarChar(sql.MAX), value: JSON.stringify(value.lines) },
      set_by: { type: sql.Int, value: userId }
    });
    const header = result.recordsets[0] && result.recordsets[0][0];
    return res.json({ success: true, data: { header, items: result.recordsets[1] || [] } });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── GET /api/finance/purchase-invoices?supplier_id=N ──────────────────────────
router.get('/purchase-invoices', ...financeInvoiceView, async (req, res, next) => {
  try {
    const supplierId = req.query.supplier_id ? Number(req.query.supplier_id) : null;
    const result = await executeStoredProcedure('sp_SupplierInvoice_List', {
      supplier_id: { type: sql.Int, value: supplierId }
    });
    return res.json({ success: true, data: result.recordset || [] });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/finance/purchase-invoices ───────────────────────────────────────
router.post('/purchase-invoices', ...financeInvoiceCreate, async (req, res, next) => {
  try {
    const { error, value } = supplierInvoiceSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map((d) => d.message)
      });
    }
    const userId = req.user && req.user.user_id ? Number(req.user.user_id) : null;
    const result = await executeStoredProcedure('sp_SupplierInvoice_Create', {
      supplier_id: { type: sql.Int, value: value.supplier_id },
      invoice_number: { type: sql.VarChar(100), value: value.invoice_number },
      invoice_date: { type: sql.Date, value: value.invoice_date },
      taxable_amt: { type: sql.Decimal(12, 2), value: value.taxable_amt },
      cgst_amt: { type: sql.Decimal(12, 2), value: value.cgst_amt },
      sgst_amt: { type: sql.Decimal(12, 2), value: value.sgst_amt },
      igst_amt: { type: sql.Decimal(12, 2), value: value.igst_amt },
      total_amt: { type: sql.Decimal(12, 2), value: value.total_amt },
      file_url: { type: sql.VarChar(500), value: value.file_url || null },
      discrepancy_note: { type: sql.VarChar(500), value: value.discrepancy_note || null },
      created_by: { type: sql.Int, value: userId }
    });
    return res.status(201).json({
      success: true,
      data: {
        invoice: result.recordsets[0] && result.recordsets[0][0],
        allocations: result.recordsets[1] || []
      }
    });
  } catch (err) {
    if (err.code === 'EREQUEST') return res.status(422).json({ success: false, message: err.message });
    return next(err);
  }
});

// ── PUT /api/finance/payments/:id/void ────────────────────────────────────────
router.put('/payments/:id/void', ...financePaymentsEdit, async (req, res, next) => {
  try {
    const paymentId = Number(req.params.id);
    const { error, value } = voidSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }
    const result = await executeStoredProcedure('sp_Finance_Payment_Void', {
      payment_id:  { type: sql.Int,         value: paymentId },
      void_reason: { type: sql.VarChar(300), value: value.void_reason || null }
    });
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
