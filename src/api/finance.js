const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { executeStoredProcedure, getPool } = require('../config/db');

const router = express.Router();

// ── Validation schemas ────────────────────────────────────────────────────────

const allocationSchema = Joi.object({
  header_id:     Joi.number().integer().required(),
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
  allocations:   Joi.array().items(allocationSchema).default([])
});

const voidSchema = Joi.object({
  void_reason: Joi.string().max(300).allow('', null)
});

const creditDaysSchema = Joi.object({
  credit_days: Joi.number().integer().min(0).max(365).allow(null)
});

// ── GET /api/finance/dashboard ───────────────────────────────────────────────
router.get('/dashboard', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Finance_DashboardStats', {});
    return res.json({ success: true, data: result.recordset && result.recordset[0] });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/finance/supplier-summary ────────────────────────────────────────
// Optional ?supplier_id=N to get a single supplier summary row.
router.get('/supplier-summary', async (req, res, next) => {
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
router.get('/supplier/:id/statement', async (req, res, next) => {
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
router.put('/supplier/:id/credit-days', async (req, res, next) => {
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

// ── GET /api/finance/payments?supplier_id=N ───────────────────────────────────
router.get('/payments', async (req, res, next) => {
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
               (SELECT pa.header_id, pa.allocated_amt
                  FROM dbo.payment_allocations pa
                 WHERE pa.payment_id = sp.payment_id
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
router.post('/payments', async (req, res, next) => {
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
    const allocJson = value.allocations && value.allocations.length > 0
      ? JSON.stringify(value.allocations)
      : null;

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
router.get('/purchase-report', async (req, res, next) => {
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
router.get('/item-finance', async (req, res, next) => {
  try {
    const { brand_id, product_type, status, q } = req.query;
    const result = await executeStoredProcedure('sp_Finance_ItemFinance', {
      brand_id:     { type: sql.Int,         value: brand_id     ? Number(brand_id) : null },
      product_type: { type: sql.VarChar(50),  value: product_type || null },
      status:       { type: sql.VarChar(30),  value: status       || null },
      q:            { type: sql.VarChar(200), value: q            || null }
    });
    const [summaryRows, itemRows] = result.recordsets || [[], []];
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/24aa53f2-1d4f-48eb-8837-69df532a7134',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1d0c1b'},body:JSON.stringify({sessionId:'1d0c1b',runId:'item-finance-pre-fix',hypothesisId:'H1',location:'src/api/finance.js:item-finance',message:'Server item finance payload prepared',data:{query:{brand_id:brand_id||null,product_type:product_type||null,status:status||null,q:q||null},summaryKeys:summaryRows&&summaryRows[0]?Object.keys(summaryRows[0]):[],summarySample:summaryRows&&summaryRows[0]?{total_skus:summaryRows[0].total_skus,total_cost_value:summaryRows[0].total_cost_value,total_sale_value:summaryRows[0].total_sale_value,portfolio_margin_pct:summaryRows[0].portfolio_margin_pct}:null,itemCount:Array.isArray(itemRows)?itemRows.length:0,firstItem:itemRows&&itemRows[0]?{sku_code:itemRows[0].sku_code,margin_pct:itemRows[0].margin_pct,cost_value:itemRows[0].cost_value,sale_value:itemRows[0].sale_value}:null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
router.get('/item-finance/filters', async (req, res, next) => {
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
router.get('/purchase-report/categories', async (req, res, next) => {
  try {
    const result = await executeStoredProcedure('sp_Finance_PurchaseReport_Categories', {});
    return res.json({ success: true, data: (result.recordset || []).map((r) => r.category) });
  } catch (err) {
    return next(err);
  }
});

// ── PUT /api/finance/payments/:id/void ────────────────────────────────────────
router.put('/payments/:id/void', async (req, res, next) => {
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
