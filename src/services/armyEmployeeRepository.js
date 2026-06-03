'use strict';

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { getPool } = require('../config/db');
const { wireDatetimeFromSql, formatDateYmd } = require('../lib/cosmosIst');
const { getArmyEmployeeStatusByKey, isAllowedArmyEmployeeStatusKey } = require('../config/armyEmployeeStatusCatalog');
const { isAllowedArmyEmployeeGenderKey } = require('../config/armyEmployeeGenderCatalog');
const { isAllowedArmyBloodGroupKey } = require('../config/armyBloodGroupCatalog');
const { isAllowedArmyBankAccountTypeKey } = require('../config/armyBankAccountTypeCatalog');
const { isAllowedArmyEmployeeDocumentTypeKey, getArmyEmployeeDocumentTypeByKey } = require('../config/armyEmployeeDocumentTypeCatalog');
const {
  getArmyEmployeeOnboardingItemCatalog,
  getArmyEmployeeOnboardingItemByKey,
  isAllowedArmyEmployeeOnboardingItemKey
} = require('../config/armyEmployeeOnboardingItemCatalog');
const { isAllowedArmyDepartmentKey } = require('../config/armyDepartmentsCatalog');

let employeesTablesReadyCache = null;

const EMPLOYEE_DOC_DIR = path.join(__dirname, '..', 'public', 'uploads', 'army-employees');

async function isEmployeesTablesReady() {
  if (employeesTablesReadyCache !== null) return employeesTablesReadyCache;
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      "SELECT OBJECT_ID(N'dbo.army_employees', N'U') AS oid"
    );
    employeesTablesReadyCache = !!r.recordset[0].oid;
  } catch (_) {
    employeesTablesReadyCache = false;
  }
  return employeesTablesReadyCache;
}

function maskAadhaar(value) {
  if (!value) return null;
  const s = String(value).replace(/\D/g, '');
  if (s.length < 4) return '****';
  return 'XXXX-XXXX-' + s.slice(-4);
}

function mapDocumentRow(row) {
  const type = getArmyEmployeeDocumentTypeByKey(row.doc_type_key);
  return {
    id: row.document_id,
    doc_type_key: row.doc_type_key,
    doc_type_label: type ? type.label : row.doc_type_key,
    file_url: row.file_url,
    file_name: row.file_name,
    is_verified: !!row.is_verified,
    uploaded_at: wireDatetimeFromSql(row.uploaded_at)
  };
}

function mapOnboardingRow(row) {
  const item = getArmyEmployeeOnboardingItemByKey(row.item_key);
  return {
    item_key: row.item_key,
    label: item ? item.label : row.item_key,
    sort_order: item ? item.sort_order : 99,
    is_complete: !!row.is_complete,
    completed_at: wireDatetimeFromSql(row.completed_at),
    notes: row.notes || ''
  };
}

function mapEmployeeRow(row, { includeSensitive } = {}) {
  const status = getArmyEmployeeStatusByKey(row.status_key);
  return {
    id: row.employee_id,
    employee_code: row.employee_code,
    candidate_id: row.candidate_id || null,
    application_id: row.application_id || null,
    user_id: row.user_id || null,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email || '',
    dob: formatDateYmd(row.dob),
    gender_key: row.gender_key || null,
    blood_group_key: row.blood_group_key || null,
    address_current: row.address_current || '',
    address_permanent: row.address_permanent || '',
    emergency_contact_name: row.emergency_contact_name || '',
    emergency_contact_relation: row.emergency_contact_relation || '',
    emergency_contact_phone: row.emergency_contact_phone || '',
    aadhaar_number: includeSensitive ? (row.aadhaar_number || '') : maskAadhaar(row.aadhaar_number),
    pan_number: includeSensitive ? (row.pan_number || '') : (row.pan_number ? '*****' + String(row.pan_number).slice(-4) : ''),
    bank_name: row.bank_name || '',
    bank_account_number: includeSensitive ? (row.bank_account_number || '') : (row.bank_account_number ? '****' + String(row.bank_account_number).slice(-4) : ''),
    bank_ifsc: row.bank_ifsc || '',
    bank_account_type_key: row.bank_account_type_key || null,
    profile_photo_url: row.profile_photo_url || null,
    store_id: row.store_id || null,
    store_name: row.store_name || null,
    department_key: row.department_key || null,
    job_title: row.job_title || '',
    status_key: row.status_key,
    status_label: status ? status.label : row.status_key,
    status_badge_class: status ? status.badgeClass : 'b-gray',
    onboarding_progress_pct: row.onboarding_progress_pct != null ? row.onboarding_progress_pct : 0,
    joined_at: wireDatetimeFromSql(row.joined_at),
    created_at: wireDatetimeFromSql(row.created_at),
    updated_at: wireDatetimeFromSql(row.updated_at)
  };
}

async function generateEmployeeCode(pool) {
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4);
  const prefix = 'EW' + year;
  const r = await pool.request()
    .input('prefix', sql.NVarChar(10), prefix + '%')
    .query(`
      SELECT TOP 1 employee_code FROM dbo.army_employees
      WHERE employee_code LIKE @prefix
      ORDER BY employee_id DESC
    `);
  let seq = 1;
  if (r.recordset.length) {
    const last = r.recordset[0].employee_code || '';
    const num = parseInt(String(last).replace(/\D/g, '').slice(-4), 10);
    if (Number.isFinite(num)) seq = num + 1;
  }
  return prefix + String(seq).padStart(4, '0');
}

async function recalcOnboardingProgress(pool, employeeId) {
  const total = getArmyEmployeeOnboardingItemCatalog().length;
  const r = await pool.request()
    .input('employeeId', sql.Int, employeeId)
    .query(`
      SELECT COUNT(*) AS done FROM dbo.army_employee_onboarding_items
      WHERE employee_id = @employeeId AND is_complete = 1
    `);
  const done = r.recordset[0].done || 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  await pool.request()
    .input('employeeId', sql.Int, employeeId)
    .input('pct', sql.Int, pct)
    .query(`
      UPDATE dbo.army_employees SET
        onboarding_progress_pct = @pct,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE employee_id = @employeeId
    `);
  return pct;
}

async function seedOnboardingItems(pool, employeeId) {
  for (const item of getArmyEmployeeOnboardingItemCatalog()) {
    await pool.request()
      .input('employeeId', sql.Int, employeeId)
      .input('itemKey', sql.NVarChar(40), item.key)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.army_employee_onboarding_items
          WHERE employee_id = @employeeId AND item_key = @itemKey
        )
        INSERT INTO dbo.army_employee_onboarding_items (employee_id, item_key, is_complete)
        VALUES (@employeeId, @itemKey, 0)
      `);
  }
}

function validateEmployeePayload(payload, { isCreate } = {}) {
  const fullName = String(payload.full_name || '').trim();
  const phone = String(payload.phone || '').replace(/\D/g, '').slice(-10);
  if (!fullName || fullName.length < 2) {
    const err = new Error('Full name is required.');
    err.statusCode = 400;
    throw err;
  }
  if (phone.length !== 10) {
    const err = new Error('Phone must be 10 digits.');
    err.statusCode = 400;
    throw err;
  }
  if (payload.gender_key && !isAllowedArmyEmployeeGenderKey(payload.gender_key)) {
    const err = new Error('Invalid gender.');
    err.statusCode = 400;
    throw err;
  }
  if (payload.blood_group_key && !isAllowedArmyBloodGroupKey(payload.blood_group_key)) {
    const err = new Error('Invalid blood group.');
    err.statusCode = 400;
    throw err;
  }
  if (payload.bank_account_type_key && !isAllowedArmyBankAccountTypeKey(payload.bank_account_type_key)) {
    const err = new Error('Invalid bank account type.');
    err.statusCode = 400;
    throw err;
  }
  if (payload.department_key && !isAllowedArmyDepartmentKey(payload.department_key)) {
    const err = new Error('Invalid department.');
    err.statusCode = 400;
    throw err;
  }
  if (payload.status_key && !isAllowedArmyEmployeeStatusKey(payload.status_key)) {
    const err = new Error('Invalid employee status.');
    err.statusCode = 400;
    throw err;
  }
  return {
    full_name: fullName,
    phone: phone,
    email: payload.email != null ? String(payload.email).trim().slice(0, 200) : null,
    dob: payload.dob || null,
    gender_key: payload.gender_key ? String(payload.gender_key).trim().toUpperCase() : null,
    blood_group_key: payload.blood_group_key ? String(payload.blood_group_key).trim().toUpperCase() : null,
    address_current: payload.address_current != null ? String(payload.address_current).trim().slice(0, 500) : null,
    address_permanent: payload.address_permanent != null ? String(payload.address_permanent).trim().slice(0, 500) : null,
    emergency_contact_name: payload.emergency_contact_name != null ? String(payload.emergency_contact_name).trim().slice(0, 120) : null,
    emergency_contact_relation: payload.emergency_contact_relation != null ? String(payload.emergency_contact_relation).trim().slice(0, 60) : null,
    emergency_contact_phone: payload.emergency_contact_phone != null
      ? String(payload.emergency_contact_phone).replace(/\D/g, '').slice(-10) : null,
    aadhaar_number: payload.aadhaar_number != null ? String(payload.aadhaar_number).replace(/\D/g, '').slice(0, 12) : null,
    pan_number: payload.pan_number != null ? String(payload.pan_number).trim().toUpperCase().slice(0, 10) : null,
    bank_name: payload.bank_name != null ? String(payload.bank_name).trim().slice(0, 120) : null,
    bank_account_number: payload.bank_account_number != null ? String(payload.bank_account_number).trim().slice(0, 30) : null,
    bank_ifsc: payload.bank_ifsc != null ? String(payload.bank_ifsc).trim().toUpperCase().slice(0, 11) : null,
    bank_account_type_key: payload.bank_account_type_key
      ? String(payload.bank_account_type_key).trim().toUpperCase() : null,
    store_id: payload.store_id != null ? Number(payload.store_id) : null,
    department_key: payload.department_key ? String(payload.department_key).trim().toUpperCase() : null,
    job_title: payload.job_title != null ? String(payload.job_title).trim().slice(0, 120) : null,
    status_key: payload.status_key ? String(payload.status_key).trim().toUpperCase() : (isCreate ? 'ONBOARDING' : undefined),
    candidate_id: payload.candidate_id != null ? Number(payload.candidate_id) : null,
    application_id: payload.application_id != null ? Number(payload.application_id) : null
  };
}

async function listEmployeesAdmin(filters = {}) {
  if (!(await isEmployeesTablesReady())) return [];

  const pool = await getPool();
  const req = pool.request();
  const clauses = ['1=1'];

  if (filters.status_key) {
    req.input('status', sql.NVarChar(30), filters.status_key);
    clauses.push('e.status_key = @status');
  }
  if (filters.store_id) {
    req.input('storeId', sql.Int, Number(filters.store_id));
    clauses.push('e.store_id = @storeId');
  }
  if (filters.q) {
    req.input('q', sql.NVarChar(120), '%' + filters.q + '%');
    clauses.push('(e.full_name LIKE @q OR e.employee_code LIKE @q OR e.phone LIKE @q OR e.email LIKE @q)');
  }

  const r = await req.query(`
    SELECT e.*, s.store_name
    FROM dbo.army_employees e
    LEFT JOIN dbo.stores s ON s.store_id = e.store_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY e.created_at DESC
  `);
  return r.recordset.map((row) => mapEmployeeRow(row, { includeSensitive: false }));
}

async function getEmployeeDocuments(pool, employeeId) {
  const r = await pool.request()
    .input('employeeId', sql.Int, employeeId)
    .query(`
      SELECT * FROM dbo.army_employee_documents
      WHERE employee_id = @employeeId
      ORDER BY uploaded_at DESC
    `);
  return r.recordset.map(mapDocumentRow);
}

async function getEmployeeOnboardingItems(pool, employeeId) {
  const r = await pool.request()
    .input('employeeId', sql.Int, employeeId)
    .query(`
      SELECT * FROM dbo.army_employee_onboarding_items
      WHERE employee_id = @employeeId
    `);
  const map = new Map(r.recordset.map((row) => [row.item_key, mapOnboardingRow(row)]));
  return getArmyEmployeeOnboardingItemCatalog()
    .map((item) => map.get(item.key) || {
      item_key: item.key,
      label: item.label,
      sort_order: item.sort_order,
      is_complete: false,
      completed_at: null,
      notes: ''
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

async function getEmployeeAdminById(employeeId, { includeSensitive } = {}) {
  if (!(await isEmployeesTablesReady())) {
    const err = new Error('Employee tables not deployed. Run migration 82.');
    err.statusCode = 503;
    throw err;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, employeeId)
    .query(`
      SELECT e.*, s.store_name
      FROM dbo.army_employees e
      LEFT JOIN dbo.stores s ON s.store_id = e.store_id
      WHERE e.employee_id = @id
    `);
  if (!r.recordset.length) {
    const err = new Error('Employee not found.');
    err.statusCode = 404;
    throw err;
  }

  const employee = mapEmployeeRow(r.recordset[0], { includeSensitive: !!includeSensitive });
  employee.documents = await getEmployeeDocuments(pool, employeeId);
  employee.onboarding = await getEmployeeOnboardingItems(pool, employeeId);
  return employee;
}

async function createEmployee(payload, userId) {
  if (!(await isEmployeesTablesReady())) {
    const err = new Error('Employee tables not deployed. Run migration 82.');
    err.statusCode = 503;
    throw err;
  }

  const data = validateEmployeePayload(payload, { isCreate: true });
  const pool = await getPool();
  const code = await generateEmployeeCode(pool);

  const r = await pool.request()
    .input('code', sql.NVarChar(20), code)
    .input('full_name', sql.NVarChar(120), data.full_name)
    .input('phone', sql.NVarChar(15), data.phone)
    .input('email', sql.NVarChar(200), data.email)
    .input('dob', sql.Date, data.dob || null)
    .input('gender_key', sql.NVarChar(20), data.gender_key)
    .input('blood_group_key', sql.NVarChar(10), data.blood_group_key)
    .input('address_current', sql.NVarChar(500), data.address_current)
    .input('address_permanent', sql.NVarChar(500), data.address_permanent)
    .input('emergency_contact_name', sql.NVarChar(120), data.emergency_contact_name)
    .input('emergency_contact_relation', sql.NVarChar(60), data.emergency_contact_relation)
    .input('emergency_contact_phone', sql.NVarChar(15), data.emergency_contact_phone)
    .input('aadhaar_number', sql.NVarChar(12), data.aadhaar_number)
    .input('pan_number', sql.NVarChar(10), data.pan_number)
    .input('bank_name', sql.NVarChar(120), data.bank_name)
    .input('bank_account_number', sql.NVarChar(30), data.bank_account_number)
    .input('bank_ifsc', sql.NVarChar(11), data.bank_ifsc)
    .input('bank_account_type_key', sql.NVarChar(20), data.bank_account_type_key)
    .input('store_id', sql.Int, data.store_id)
    .input('department_key', sql.NVarChar(30), data.department_key)
    .input('job_title', sql.NVarChar(120), data.job_title)
    .input('status_key', sql.NVarChar(30), data.status_key)
    .input('candidate_id', sql.Int, data.candidate_id)
    .input('application_id', sql.Int, data.application_id)
    .input('userId', sql.Int, userId || null)
    .query(`
      INSERT INTO dbo.army_employees (
        employee_code, full_name, phone, email, dob, gender_key, blood_group_key,
        address_current, address_permanent,
        emergency_contact_name, emergency_contact_relation, emergency_contact_phone,
        aadhaar_number, pan_number, bank_name, bank_account_number, bank_ifsc, bank_account_type_key,
        store_id, department_key, job_title, status_key,
        candidate_id, application_id, created_by,
        created_at, updated_at
      )
      OUTPUT INSERTED.employee_id
      VALUES (
        @code, @full_name, @phone, @email, @dob, @gender_key, @blood_group_key,
        @address_current, @address_permanent,
        @emergency_contact_name, @emergency_contact_relation, @emergency_contact_phone,
        @aadhaar_number, @pan_number, @bank_name, @bank_account_number, @bank_ifsc, @bank_account_type_key,
        @store_id, @department_key, @job_title, @status_key,
        @candidate_id, @application_id, @userId,
        DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME())
      )
    `);

  const employeeId = r.recordset[0].employee_id;
  await seedOnboardingItems(pool, employeeId);
  await recalcOnboardingProgress(pool, employeeId);
  return getEmployeeAdminById(employeeId, { includeSensitive: true });
}

async function updateEmployee(employeeId, payload) {
  const data = validateEmployeePayload(payload, { isCreate: false });
  await getEmployeeAdminById(employeeId);

  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, employeeId)
    .input('full_name', sql.NVarChar(120), data.full_name)
    .input('phone', sql.NVarChar(15), data.phone)
    .input('email', sql.NVarChar(200), data.email)
    .input('dob', sql.Date, data.dob || null)
    .input('gender_key', sql.NVarChar(20), data.gender_key)
    .input('blood_group_key', sql.NVarChar(10), data.blood_group_key)
    .input('address_current', sql.NVarChar(500), data.address_current)
    .input('address_permanent', sql.NVarChar(500), data.address_permanent)
    .input('emergency_contact_name', sql.NVarChar(120), data.emergency_contact_name)
    .input('emergency_contact_relation', sql.NVarChar(60), data.emergency_contact_relation)
    .input('emergency_contact_phone', sql.NVarChar(15), data.emergency_contact_phone)
    .input('aadhaar_number', sql.NVarChar(12), data.aadhaar_number)
    .input('pan_number', sql.NVarChar(10), data.pan_number)
    .input('bank_name', sql.NVarChar(120), data.bank_name)
    .input('bank_account_number', sql.NVarChar(30), data.bank_account_number)
    .input('bank_ifsc', sql.NVarChar(11), data.bank_ifsc)
    .input('bank_account_type_key', sql.NVarChar(20), data.bank_account_type_key)
    .input('store_id', sql.Int, data.store_id)
    .input('department_key', sql.NVarChar(30), data.department_key)
    .input('job_title', sql.NVarChar(120), data.job_title)
    .query(`
      UPDATE dbo.army_employees SET
        full_name = @full_name,
        phone = @phone,
        email = @email,
        dob = @dob,
        gender_key = @gender_key,
        blood_group_key = @blood_group_key,
        address_current = @address_current,
        address_permanent = @address_permanent,
        emergency_contact_name = @emergency_contact_name,
        emergency_contact_relation = @emergency_contact_relation,
        emergency_contact_phone = @emergency_contact_phone,
        aadhaar_number = @aadhaar_number,
        pan_number = @pan_number,
        bank_name = @bank_name,
        bank_account_number = @bank_account_number,
        bank_ifsc = @bank_ifsc,
        bank_account_type_key = @bank_account_type_key,
        store_id = @store_id,
        department_key = @department_key,
        job_title = @job_title,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE employee_id = @id
    `);

  return getEmployeeAdminById(employeeId, { includeSensitive: true });
}

async function setEmployeeStatus(employeeId, statusKey) {
  if (!isAllowedArmyEmployeeStatusKey(statusKey)) {
    const err = new Error('Invalid employee status.');
    err.statusCode = 400;
    throw err;
  }
  await getEmployeeAdminById(employeeId);
  const pool = await getPool();
  const req = pool.request()
    .input('id', sql.Int, employeeId)
    .input('status', sql.NVarChar(30), statusKey);

  let extra = '';
  if (statusKey === 'ACTIVE') {
    extra = ', joined_at = COALESCE(joined_at, DATEADD(MINUTE, 330, SYSUTCDATETIME()))';
  }

  await req.query(`
    UPDATE dbo.army_employees SET
      status_key = @status,
      updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      ${extra}
    WHERE employee_id = @id
  `);
  return getEmployeeAdminById(employeeId, { includeSensitive: true });
}

async function setOnboardingItem(employeeId, itemKey, isComplete, userId) {
  if (!isAllowedArmyEmployeeOnboardingItemKey(itemKey)) {
    const err = new Error('Invalid onboarding item.');
    err.statusCode = 400;
    throw err;
  }
  await getEmployeeAdminById(employeeId);
  const pool = await getPool();
  await pool.request()
    .input('employeeId', sql.Int, employeeId)
    .input('itemKey', sql.NVarChar(40), itemKey)
    .input('complete', sql.Bit, isComplete ? 1 : 0)
    .input('userId', sql.Int, userId || null)
    .query(`
      UPDATE dbo.army_employee_onboarding_items SET
        is_complete = @complete,
        completed_at = CASE WHEN @complete = 1 THEN DATEADD(MINUTE, 330, SYSUTCDATETIME()) ELSE NULL END,
        completed_by = CASE WHEN @complete = 1 THEN @userId ELSE NULL END
      WHERE employee_id = @employeeId AND item_key = @itemKey
    `);
  await recalcOnboardingProgress(pool, employeeId);
  return getEmployeeAdminById(employeeId, { includeSensitive: true });
}

function ensureEmployeeDocDir(employeeId) {
  const dir = path.join(EMPLOYEE_DOC_DIR, String(employeeId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function addEmployeeDocument(employeeId, docTypeKey, fileInfo, userId) {
  if (!isAllowedArmyEmployeeDocumentTypeKey(docTypeKey)) {
    const err = new Error('Invalid document type.');
    err.statusCode = 400;
    throw err;
  }
  await getEmployeeAdminById(employeeId);
  const pool = await getPool();
  const fileUrl = '/uploads/army-employees/' + employeeId + '/' + fileInfo.filename;

  if (docTypeKey === 'PHOTO') {
    await pool.request()
      .input('id', sql.Int, employeeId)
      .input('url', sql.NVarChar(500), fileUrl)
      .query('UPDATE dbo.army_employees SET profile_photo_url = @url, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE employee_id = @id');
  }

  const r = await pool.request()
    .input('employeeId', sql.Int, employeeId)
    .input('docType', sql.NVarChar(30), docTypeKey)
    .input('fileUrl', sql.NVarChar(500), fileUrl)
    .input('fileName', sql.NVarChar(200), fileInfo.originalname || fileInfo.filename)
    .input('userId', sql.Int, userId || null)
    .query(`
      INSERT INTO dbo.army_employee_documents (
        employee_id, doc_type_key, file_url, file_name, uploaded_by, uploaded_at
      )
      OUTPUT INSERTED.document_id
      VALUES (@employeeId, @docType, @fileUrl, @fileName, @userId, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);

  return getEmployeeAdminById(employeeId, { includeSensitive: true });
}

async function verifyEmployeeDocument(employeeId, documentId, isVerified) {
  await getEmployeeAdminById(employeeId);
  const pool = await getPool();
  const r = await pool.request()
    .input('employeeId', sql.Int, employeeId)
    .input('docId', sql.Int, documentId)
    .input('verified', sql.Bit, isVerified ? 1 : 0)
    .query(`
      UPDATE dbo.army_employee_documents SET is_verified = @verified
      OUTPUT INSERTED.doc_type_key
      WHERE document_id = @docId AND employee_id = @employeeId
    `);
  if (!r.recordset.length) {
    const err = new Error('Document not found.');
    err.statusCode = 404;
    throw err;
  }
  if (isVerified && r.recordset[0].doc_type_key === 'AADHAAR') {
    await setOnboardingItem(employeeId, 'AADHAAR_VERIFIED', true, null);
  }
  if (isVerified && r.recordset[0].doc_type_key === 'PAN') {
    await setOnboardingItem(employeeId, 'PAN_UPLOADED', true, null);
  }
  return getEmployeeAdminById(employeeId, { includeSensitive: true });
}

async function getEmployeeDashboardStats() {
  if (!(await isEmployeesTablesReady())) {
    return { total_employees: 0, onboarding: 0, active: 0 };
  }
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT
      COUNT(*) AS total_employees,
      SUM(CASE WHEN status_key = N'ONBOARDING' THEN 1 ELSE 0 END) AS onboarding,
      SUM(CASE WHEN status_key = N'ACTIVE' THEN 1 ELSE 0 END) AS active
    FROM dbo.army_employees
  `);
  const row = r.recordset[0] || {};
  return {
    total_employees: row.total_employees || 0,
    onboarding: row.onboarding || 0,
    active: row.active || 0
  };
}

module.exports = {
  isEmployeesTablesReady,
  EMPLOYEE_DOC_DIR,
  ensureEmployeeDocDir,
  listEmployeesAdmin,
  getEmployeeAdminById,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
  setOnboardingItem,
  addEmployeeDocument,
  verifyEmployeeDocument,
  getEmployeeDashboardStats
};
