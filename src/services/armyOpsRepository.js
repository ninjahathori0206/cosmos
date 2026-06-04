'use strict';

const sql = require('mssql');
const { getPool } = require('../config/db');
const { wireDatetimeFromSql, formatDateYmd, todayYmd } = require('../lib/cosmosIst');
const { getArmyStoreOrientationCatalog } = require('../config/armyStoreOrientationCatalog');
const { getArmyExitClearanceCatalog } = require('../config/armyExitStatusCatalog');
const { isAllowedArmyLeaveStatusKey } = require('../config/armyLeaveTypeCatalog');
const { isAllowedArmyAttendanceStatusKey } = require('../config/armyAttendanceStatusCatalog');
const { isAllowedArmyPayrollRunStatusKey } = require('../config/armyPayrollRunStatusCatalog');
const { isAllowedArmyExitStatusKey } = require('../config/armyExitStatusCatalog');
const { isAllowedArmyOfferStatusKey } = require('../config/armyOfferStatusCatalog');
const { createEmployee } = require('./armyEmployeeRepository');

const tableCache = {};

async function isOpsTableReady(name) {
  if (tableCache[name] !== undefined) return tableCache[name];
  try {
    const pool = await getPool();
    const r = await pool.request().query(`SELECT OBJECT_ID(N'dbo.${name}', N'U') AS oid`);
    tableCache[name] = !!r.recordset[0].oid;
  } catch (_) {
    tableCache[name] = false;
  }
  return tableCache[name];
}

async function isOpsReady() {
  return isOpsTableReady('army_attendance');
}

function err404(msg) {
  const e = new Error(msg || 'Not found.');
  e.statusCode = 404;
  return e;
}

function err400(msg) {
  const e = new Error(msg);
  e.statusCode = 400;
  return e;
}

// --- Placements & orientation (S6) ---

async function listPlacements(filters = {}) {
  if (!(await isOpsTableReady('army_employee_placements'))) return [];
  const pool = await getPool();
  const req = pool.request();
  let where = '1=1';
  if (filters.status_key) {
    req.input('st', sql.NVarChar(20), filters.status_key);
    where += ' AND p.status_key = @st';
  }
  const r = await req.query(`
    SELECT p.*, e.full_name, e.employee_code, s.store_name
    FROM dbo.army_employee_placements p
    INNER JOIN dbo.army_employees e ON e.employee_id = p.employee_id
    INNER JOIN dbo.stores s ON s.store_id = p.store_id
    WHERE ${where}
    ORDER BY p.created_at DESC
  `);
  return r.recordset.map((row) => ({
    id: row.placement_id,
    employee_id: row.employee_id,
    employee_name: row.full_name,
    employee_code: row.employee_code,
    store_id: row.store_id,
    store_name: row.store_name,
    status_key: row.status_key,
    confirmed_at: wireDatetimeFromSql(row.confirmed_at),
    notes: row.notes || ''
  }));
}

async function confirmPlacement(placementId, userId, notes) {
  if (!(await isOpsTableReady('army_employee_placements'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, placementId)
    .input('userId', sql.Int, userId || null)
    .input('notes', sql.NVarChar(500), notes || null)
    .query(`
      UPDATE dbo.army_employee_placements SET
        status_key = N'CONFIRMED',
        confirmed_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()),
        confirmed_by = @userId,
        notes = COALESCE(@notes, notes)
      OUTPUT INSERTED.employee_id, INSERTED.store_id
      WHERE placement_id = @id
    `);
  if (!r.recordset.length) throw err404('Placement not found.');
  await pool.request()
    .input('empId', sql.Int, r.recordset[0].employee_id)
    .input('storeId', sql.Int, r.recordset[0].store_id)
    .query('UPDATE dbo.army_employees SET store_id = @storeId, status_key = N\'ACTIVE\', updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE employee_id = @empId');
  return listPlacements();
}

async function createPlacement(payload, userId) {
  if (!(await isOpsTableReady('army_employee_placements'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const emp = await pool.request().input('id', sql.Int, payload.employee_id)
    .query('SELECT 1 FROM dbo.army_employees WHERE employee_id = @id');
  if (!emp.recordset.length) throw err404('Employee not found.');
  const store = await pool.request().input('id', sql.Int, payload.store_id)
    .query('SELECT 1 FROM dbo.stores WHERE store_id = @id');
  if (!store.recordset.length) throw err404('Store not found.');
  await pool.request()
    .input('empId', sql.Int, payload.employee_id)
    .input('storeId', sql.Int, payload.store_id)
    .input('notes', sql.NVarChar(500), payload.notes || null)
    .query(`
      INSERT INTO dbo.army_employee_placements (employee_id, store_id, status_key, notes, created_at)
      VALUES (@empId, @storeId, N'PENDING', @notes, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  return listPlacements();
}

async function getOrientation(employeeId) {
  if (!(await isOpsTableReady('army_employee_orientation'))) return null;
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, employeeId).query('SELECT * FROM dbo.army_employee_orientation WHERE employee_id = @id');
  let checklist = {};
  if (r.recordset.length) {
    try { checklist = JSON.parse(r.recordset[0].store_checklist_json || '{}'); } catch (_) { checklist = {}; }
    return {
      employee_id: employeeId,
      general_ack_at: wireDatetimeFromSql(r.recordset[0].general_ack_at),
      store_complete_at: wireDatetimeFromSql(r.recordset[0].store_complete_at),
      store_checklist: getArmyStoreOrientationCatalog().map((item) => ({
        key: item.key,
        label: item.label,
        done: !!checklist[item.key]
      }))
    };
  }
  return {
    employee_id: employeeId,
    general_ack_at: null,
    store_complete_at: null,
    store_checklist: getArmyStoreOrientationCatalog().map((item) => ({ key: item.key, label: item.label, done: false }))
  };
}

async function updateOrientation(employeeId, payload, userId) {
  if (!(await isOpsTableReady('army_employee_orientation'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const exists = await pool.request().input('id', sql.Int, employeeId).query('SELECT 1 FROM dbo.army_employees WHERE employee_id = @id');
  if (!exists.recordset.length) throw err404('Employee not found.');

  let checklist = {};
  if (payload.store_checklist && typeof payload.store_checklist === 'object') {
    checklist = payload.store_checklist;
  }
  const allDone = getArmyStoreOrientationCatalog().every((item) => checklist[item.key]);
  const json = JSON.stringify(checklist);

  await pool.request()
    .input('id', sql.Int, employeeId)
    .input('json', sql.NVarChar(sql.MAX), json)
    .input('userId', sql.Int, userId || null)
    .input('generalAck', sql.Bit, payload.general_acknowledged ? 1 : 0)
    .input('storeDone', sql.Bit, allDone ? 1 : 0)
    .query(`
      MERGE dbo.army_employee_orientation AS t
      USING (SELECT @id AS employee_id) AS s ON t.employee_id = s.employee_id
      WHEN MATCHED THEN UPDATE SET
        general_ack_at = CASE WHEN @generalAck = 1 THEN COALESCE(general_ack_at, DATEADD(MINUTE, 330, SYSUTCDATETIME())) ELSE general_ack_at END,
        general_ack_by = CASE WHEN @generalAck = 1 THEN COALESCE(general_ack_by, @userId) ELSE general_ack_by END,
        store_checklist_json = @json,
        store_complete_at = CASE WHEN @storeDone = 1 THEN COALESCE(store_complete_at, DATEADD(MINUTE, 330, SYSUTCDATETIME())) ELSE store_complete_at END,
        store_signed_by = CASE WHEN @storeDone = 1 THEN COALESCE(store_signed_by, @userId) ELSE store_signed_by END,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHEN NOT MATCHED THEN INSERT (employee_id, general_ack_at, general_ack_by, store_checklist_json, store_complete_at, store_signed_by, updated_at)
        VALUES (@id,
          CASE WHEN @generalAck = 1 THEN DATEADD(MINUTE, 330, SYSUTCDATETIME()) ELSE NULL END,
          CASE WHEN @generalAck = 1 THEN @userId ELSE NULL END,
          @json,
          CASE WHEN @storeDone = 1 THEN DATEADD(MINUTE, 330, SYSUTCDATETIME()) ELSE NULL END,
          CASE WHEN @storeDone = 1 THEN @userId ELSE NULL END,
          DATEADD(MINUTE, 330, SYSUTCDATETIME()));
    `);
  return getOrientation(employeeId);
}

// --- Attendance & rosters (S7) ---

async function listShiftTypes() {
  if (!(await isOpsTableReady('army_shift_types'))) return [];
  const pool = await getPool();
  const r = await pool.request().query('SELECT * FROM dbo.army_shift_types WHERE is_active = 1 ORDER BY name');
  return r.recordset.map((row) => ({
    id: row.shift_type_id,
    name: row.name,
    start_time: String(row.start_time).slice(0, 5),
    end_time: String(row.end_time).slice(0, 5)
  }));
}

async function listAttendance(filters = {}) {
  if (!(await isOpsTableReady('army_attendance'))) return [];
  const pool = await getPool();
  const req = pool.request();
  let where = '1=1';
  if (filters.from_date) {
    req.input('from', sql.Date, filters.from_date);
    where += ' AND a.att_date >= @from';
  }
  if (filters.to_date) {
    req.input('to', sql.Date, filters.to_date);
    where += ' AND a.att_date <= @to';
  }
  const r = await req.query(`
    SELECT a.*, e.full_name, e.employee_code, s.store_name
    FROM dbo.army_attendance a
    INNER JOIN dbo.army_employees e ON e.employee_id = a.employee_id
    LEFT JOIN dbo.stores s ON s.store_id = a.store_id
    WHERE ${where}
    ORDER BY a.att_date DESC, e.full_name
  `);
  return r.recordset.map((row) => ({
    id: row.attendance_id,
    employee_id: row.employee_id,
    employee_name: row.full_name,
    employee_code: row.employee_code,
    att_date: formatDateYmd(row.att_date),
    status_key: row.status_key,
    check_in_at: wireDatetimeFromSql(row.check_in_at),
    check_out_at: wireDatetimeFromSql(row.check_out_at),
    late_minutes: row.late_minutes,
    store_name: row.store_name
  }));
}

async function upsertAttendance(payload) {
  if (!(await isOpsTableReady('army_attendance'))) throw err400('Ops tables not deployed.');
  if (!isAllowedArmyAttendanceStatusKey(payload.status_key)) throw err400('Invalid attendance status.');
  const pool = await getPool();
  await pool.request()
    .input('empId', sql.Int, payload.employee_id)
    .input('attDate', sql.Date, payload.att_date)
    .input('storeId', sql.Int, payload.store_id || null)
    .input('status', sql.NVarChar(20), payload.status_key)
    .input('late', sql.Int, payload.late_minutes || 0)
    .query(`
      MERGE dbo.army_attendance AS t
      USING (SELECT @empId AS employee_id, @attDate AS att_date) AS s
      ON t.employee_id = s.employee_id AND t.att_date = s.att_date
      WHEN MATCHED THEN UPDATE SET status_key = @status, store_id = @storeId, late_minutes = @late
      WHEN NOT MATCHED THEN INSERT (employee_id, att_date, store_id, status_key, late_minutes, created_at)
        VALUES (@empId, @attDate, @storeId, @status, @late, DATEADD(MINUTE, 330, SYSUTCDATETIME()));
    `);
  return listAttendance({ from_date: payload.att_date, to_date: payload.att_date });
}

async function listRosters(filters = {}) {
  if (!(await isOpsTableReady('army_rosters'))) return [];
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT r.*, s.store_name,
      (SELECT COUNT(*) FROM dbo.army_roster_entries e WHERE e.roster_id = r.roster_id) AS entry_count
    FROM dbo.army_rosters r
    INNER JOIN dbo.stores s ON s.store_id = r.store_id
    ORDER BY r.week_start DESC
  `);
  return r.recordset.map((row) => ({
    id: row.roster_id,
    store_id: row.store_id,
    store_name: row.store_name,
    week_start: formatDateYmd(row.week_start),
    status_key: row.status_key,
    entry_count: row.entry_count,
    published_at: wireDatetimeFromSql(row.published_at)
  }));
}

async function publishRoster(rosterId) {
  if (!(await isOpsTableReady('army_rosters'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, rosterId).query(`
    UPDATE dbo.army_rosters SET status_key = N'PUBLISHED', published_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
    WHERE roster_id = @id AND status_key = N'DRAFT'
  `);
  if (!r.rowsAffected[0]) throw err404('Roster not found or already published.');
  return listRosters();
}

async function createRoster(payload, userId) {
  if (!(await isOpsTableReady('army_rosters'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const store = await pool.request().input('id', sql.Int, payload.store_id)
    .query('SELECT 1 FROM dbo.stores WHERE store_id = @id');
  if (!store.recordset.length) throw err404('Store not found.');
  try {
    await pool.request()
      .input('storeId', sql.Int, payload.store_id)
      .input('weekStart', sql.Date, payload.week_start)
      .input('userId', sql.Int, userId || null)
      .query(`
        INSERT INTO dbo.army_rosters (store_id, week_start, status_key, created_by, created_at)
        VALUES (@storeId, @weekStart, N'DRAFT', @userId, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
      `);
  } catch (err) {
    if (String(err.message || '').includes('UQ_army_rosters_store_week')) {
      throw err400('A roster already exists for this store and week.');
    }
    throw err;
  }
  return listRosters();
}

// --- Leave (S8) ---

async function listLeaveRequests(filters = {}) {
  if (!(await isOpsTableReady('army_leave_requests'))) return [];
  const pool = await getPool();
  const req = pool.request();
  let where = '1=1';
  if (filters.status_key) {
    req.input('st', sql.NVarChar(20), filters.status_key);
    where += ' AND l.status_key = @st';
  }
  const r = await req.query(`
    SELECT l.*, e.full_name, e.employee_code
    FROM dbo.army_leave_requests l
    INNER JOIN dbo.army_employees e ON e.employee_id = l.employee_id
    WHERE ${where}
    ORDER BY l.created_at DESC
  `);
  return r.recordset.map((row) => ({
    id: row.leave_request_id,
    employee_id: row.employee_id,
    employee_name: row.full_name,
    leave_type_key: row.leave_type_key,
    from_date: formatDateYmd(row.from_date),
    to_date: formatDateYmd(row.to_date),
    reason: row.reason || '',
    status_key: row.status_key,
    created_at: wireDatetimeFromSql(row.created_at)
  }));
}

async function reviewLeaveRequest(requestId, statusKey, userId, notes) {
  if (!isAllowedArmyLeaveStatusKey(statusKey) || statusKey === 'PENDING') throw err400('Invalid status.');
  if (!(await isOpsTableReady('army_leave_requests'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, requestId)
    .input('st', sql.NVarChar(20), statusKey)
    .input('userId', sql.Int, userId || null)
    .input('notes', sql.NVarChar(500), notes || null)
    .query(`
      UPDATE dbo.army_leave_requests SET
        status_key = @st, reviewed_by = @userId, reviewed_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()), review_notes = @notes
      WHERE leave_request_id = @id
    `);
  return listLeaveRequests();
}

async function createLeaveRequest(payload, userId) {
  const { isAllowedArmyLeaveTypeKey } = require('../config/armyLeaveTypeCatalog');
  if (!isAllowedArmyLeaveTypeKey(payload.leave_type_key)) throw err400('Invalid leave type.');
  if (!(await isOpsTableReady('army_leave_requests'))) throw err400('Ops tables not deployed.');
  if (payload.from_date > payload.to_date) throw err400('From date must be on or before to date.');
  const pool = await getPool();
  const emp = await pool.request().input('id', sql.Int, payload.employee_id)
    .query('SELECT 1 FROM dbo.army_employees WHERE employee_id = @id');
  if (!emp.recordset.length) throw err404('Employee not found.');
  await pool.request()
    .input('empId', sql.Int, payload.employee_id)
    .input('type', sql.NVarChar(20), payload.leave_type_key)
    .input('from', sql.Date, payload.from_date)
    .input('to', sql.Date, payload.to_date)
    .input('reason', sql.NVarChar(500), payload.reason || null)
    .query(`
      INSERT INTO dbo.army_leave_requests (employee_id, leave_type_key, from_date, to_date, reason, status_key, created_at)
      VALUES (@empId, @type, @from, @to, @reason, N'PENDING', DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  return listLeaveRequests();
}

// --- Payroll (S9) ---

async function listSalaryComponents() {
  if (!(await isOpsTableReady('army_salary_components'))) return [];
  const pool = await getPool();
  const r = await pool.request().query('SELECT * FROM dbo.army_salary_components WHERE is_active = 1 ORDER BY component_type, name');
  return r.recordset.map((row) => ({
    id: row.component_id,
    name: row.name,
    component_type: row.component_type,
    calc_type: row.calc_type,
    default_value: Number(row.default_value)
  }));
}

async function listPayrollRuns() {
  if (!(await isOpsTableReady('army_payroll_runs'))) return [];
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT r.*,
      (SELECT COUNT(*) FROM dbo.army_payroll_entries e WHERE e.payroll_run_id = r.payroll_run_id) AS employee_count,
      (SELECT SUM(net_amount) FROM dbo.army_payroll_entries e WHERE e.payroll_run_id = r.payroll_run_id) AS total_net
    FROM dbo.army_payroll_runs r ORDER BY r.month_key DESC
  `);
  return r.recordset.map((row) => ({
    id: row.payroll_run_id,
    month_key: row.month_key,
    status_key: row.status_key,
    employee_count: row.employee_count || 0,
    total_net: row.total_net != null ? Number(row.total_net) : 0,
    approved_at: wireDatetimeFromSql(row.approved_at)
  }));
}

async function createPayrollRun(monthKey, userId) {
  if (!(await isOpsTableReady('army_payroll_runs'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const existing = await pool.request().input('m', sql.NVarChar(7), monthKey).query('SELECT payroll_run_id FROM dbo.army_payroll_runs WHERE month_key = @m');
  if (existing.recordset.length) throw err400('Payroll run already exists for this month.');

  const runR = await pool.request().input('m', sql.NVarChar(7), monthKey).query(`
    INSERT INTO dbo.army_payroll_runs (month_key, status_key, created_at)
    OUTPUT INSERTED.payroll_run_id VALUES (@m, N'DRAFT', DATEADD(MINUTE, 330, SYSUTCDATETIME()))
  `);
  const runId = runR.recordset[0].payroll_run_id;

  const emps = await pool.request().query("SELECT employee_id FROM dbo.army_employees WHERE status_key IN (N'ACTIVE', N'ON_NOTICE')");
  for (const emp of emps.recordset) {
    const gross = 18000;
    const ded = 2000;
    await pool.request()
      .input('runId', sql.Int, runId)
      .input('empId', sql.Int, emp.employee_id)
      .input('gross', sql.Decimal(12, 2), gross)
      .input('ded', sql.Decimal(12, 2), ded)
      .input('net', sql.Decimal(12, 2), gross - ded)
      .query(`
        INSERT INTO dbo.army_payroll_entries (payroll_run_id, employee_id, gross_amount, deduction_amount, net_amount, lop_days)
        VALUES (@runId, @empId, @gross, @ded, @net, 0)
      `);
  }
  return listPayrollRuns();
}

async function approvePayrollRun(runId, userId) {
  if (!(await isOpsTableReady('army_payroll_runs'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, runId)
    .input('userId', sql.Int, userId || null)
    .query(`
      UPDATE dbo.army_payroll_runs SET status_key = N'APPROVED', approved_by = @userId, approved_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHERE payroll_run_id = @id AND status_key = N'DRAFT'
    `);
  return listPayrollRuns();
}

async function listSalaryAdvances() {
  if (!(await isOpsTableReady('army_salary_advances'))) return [];
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT a.*, e.full_name FROM dbo.army_salary_advances a
    INNER JOIN dbo.army_employees e ON e.employee_id = a.employee_id ORDER BY a.created_at DESC
  `);
  return r.recordset.map((row) => ({
    id: row.advance_id,
    employee_name: row.full_name,
    amount: Number(row.amount),
    status_key: row.status_key,
    repayment_months: row.repayment_months,
    created_at: wireDatetimeFromSql(row.created_at)
  }));
}

// --- Training / LMS (S10) ---

async function listLmsCourses() {
  if (!(await isOpsTableReady('army_lms_courses'))) return [];
  const pool = await getPool();
  const r = await pool.request().query('SELECT * FROM dbo.army_lms_courses WHERE is_active = 1 ORDER BY title');
  return r.recordset.map((row) => ({
    id: row.course_id,
    title: row.title,
    description: row.description || '',
    is_active: !!row.is_active
  }));
}

async function listTrainingAssignments(filters = {}) {
  if (!(await isOpsTableReady('army_training_assignments'))) return [];
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT a.*, e.full_name, c.title AS course_title
    FROM dbo.army_training_assignments a
    INNER JOIN dbo.army_employees e ON e.employee_id = a.employee_id
    INNER JOIN dbo.army_lms_courses c ON c.course_id = a.course_id
    ORDER BY a.created_at DESC
  `);
  return r.recordset.map((row) => ({
    id: row.assignment_id,
    employee_name: row.full_name,
    course_title: row.course_title,
    due_date: formatDateYmd(row.due_date),
    progress_pct: row.progress_pct,
    status_key: row.status_key
  }));
}

async function listTrainingSessions() {
  if (!(await isOpsTableReady('army_training_sessions'))) return [];
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT t.*, s.store_name FROM dbo.army_training_sessions t
    LEFT JOIN dbo.stores s ON s.store_id = t.store_id ORDER BY t.scheduled_at DESC
  `);
  return r.recordset.map((row) => ({
    id: row.session_id,
    session_type: row.session_type,
    title: row.title,
    scheduled_at: wireDatetimeFromSql(row.scheduled_at),
    venue: row.venue || '',
    store_name: row.store_name || '—'
  }));
}

async function createLmsCourse(payload) {
  if (!(await isOpsTableReady('army_lms_courses'))) throw err400('Ops tables not deployed.');
  const title = String(payload.title || '').trim();
  if (!title) throw err400('Course title is required.');
  const pool = await getPool();
  await pool.request()
    .input('title', sql.NVarChar(200), title)
    .input('desc', sql.NVarChar(1000), payload.description || null)
    .query(`
      INSERT INTO dbo.army_lms_courses (title, description, is_active, created_at)
      VALUES (@title, @desc, 1, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  return listLmsCourses();
}

async function createTrainingAssignment(payload) {
  if (!(await isOpsTableReady('army_training_assignments'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const emp = await pool.request().input('id', sql.Int, payload.employee_id)
    .query('SELECT 1 FROM dbo.army_employees WHERE employee_id = @id');
  if (!emp.recordset.length) throw err404('Employee not found.');
  const course = await pool.request().input('id', sql.Int, payload.course_id)
    .query('SELECT 1 FROM dbo.army_lms_courses WHERE course_id = @id AND is_active = 1');
  if (!course.recordset.length) throw err404('Course not found.');
  await pool.request()
    .input('empId', sql.Int, payload.employee_id)
    .input('courseId', sql.Int, payload.course_id)
    .input('due', sql.Date, payload.due_date || null)
    .query(`
      INSERT INTO dbo.army_training_assignments (employee_id, course_id, due_date, progress_pct, status_key, created_at)
      VALUES (@empId, @courseId, @due, 0, N'ASSIGNED', DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  return listTrainingAssignments();
}

async function createTrainingSession(payload) {
  if (!(await isOpsTableReady('army_training_sessions'))) throw err400('Ops tables not deployed.');
  const title = String(payload.title || '').trim();
  if (!title) throw err400('Session title is required.');
  if (!payload.scheduled_at) throw err400('Schedule date and time required.');
  const pool = await getPool();
  await pool.request()
    .input('type', sql.NVarChar(20), payload.session_type || 'ONSITE')
    .input('title', sql.NVarChar(200), title)
    .input('at', sql.DateTime2, payload.scheduled_at)
    .input('venue', sql.NVarChar(200), payload.venue || null)
    .input('storeId', sql.Int, payload.store_id || null)
    .input('trainer', sql.NVarChar(120), payload.trainer_name || null)
    .query(`
      INSERT INTO dbo.army_training_sessions (session_type, title, scheduled_at, venue, store_id, trainer_name, created_at)
      VALUES (@type, @title, @at, @venue, @storeId, @trainer, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  return listTrainingSessions();
}

// --- Performance (S11) ---

async function listPerformanceScores(filters = {}) {
  if (!(await isOpsTableReady('army_performance_scores'))) return [];
  const pool = await getPool();
  const req = pool.request();
  let where = '1=1';
  if (filters.month_key) {
    req.input('m', sql.NVarChar(7), filters.month_key);
    where += ' AND p.month_key = @m';
  }
  const r = await req.query(`
    SELECT p.*, e.full_name, e.employee_code
    FROM dbo.army_performance_scores p
    INNER JOIN dbo.army_employees e ON e.employee_id = p.employee_id
    WHERE ${where}
    ORDER BY p.total_score DESC
  `);
  return r.recordset.map((row) => ({
    id: row.performance_id,
    employee_name: row.full_name,
    employee_code: row.employee_code,
    month_key: row.month_key,
    sales_score: Number(row.sales_score),
    attendance_score: Number(row.attendance_score),
    training_score: Number(row.training_score),
    total_score: Number(row.total_score),
    computed_at: wireDatetimeFromSql(row.computed_at)
  }));
}

async function computePerformanceMonth(monthKey) {
  if (!(await isOpsTableReady('army_performance_scores'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  const emps = await pool.request().query("SELECT employee_id FROM dbo.army_employees WHERE status_key IN (N'ACTIVE', N'ON_NOTICE')");
  for (const emp of emps.recordset) {
    const attR = await pool.request()
      .input('empId', sql.Int, emp.employee_id)
      .input('m', sql.NVarChar(7), monthKey)
      .query(`
        SELECT
          SUM(CASE WHEN status_key IN (N'PRESENT', N'LATE') THEN 1 ELSE 0 END) AS present_days,
          COUNT(*) AS total_days
        FROM dbo.army_attendance
        WHERE employee_id = @empId AND CONVERT(VARCHAR(7), att_date, 126) = @m
      `);
    const att = attR.recordset[0] || {};
    const attScore = att.total_days ? Math.round((att.present_days / att.total_days) * 100) : 70;
    const trainR = await pool.request().input('empId', sql.Int, emp.employee_id).query(`
      SELECT AVG(CAST(progress_pct AS FLOAT)) AS avg_prog FROM dbo.army_training_assignments WHERE employee_id = @empId
    `);
    const trainScore = Math.round(trainR.recordset[0].avg_prog || 60);
    const salesScore = 75;
    const total = Math.round(salesScore * 0.4 + attScore * 0.35 + trainScore * 0.25);

    await pool.request()
      .input('empId', sql.Int, emp.employee_id)
      .input('m', sql.NVarChar(7), monthKey)
      .input('sales', sql.Decimal(5, 1), salesScore)
      .input('att', sql.Decimal(5, 1), attScore)
      .input('train', sql.Decimal(5, 1), trainScore)
      .input('total', sql.Decimal(5, 1), total)
      .query(`
        MERGE dbo.army_performance_scores AS t
        USING (SELECT @empId AS employee_id, @m AS month_key) AS s ON t.employee_id = s.employee_id AND t.month_key = s.month_key
        WHEN MATCHED THEN UPDATE SET sales_score = @sales, attendance_score = @att, training_score = @train, total_score = @total, computed_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHEN NOT MATCHED THEN INSERT (employee_id, month_key, sales_score, attendance_score, training_score, total_score, computed_at)
          VALUES (@empId, @m, @sales, @att, @train, @total, DATEADD(MINUTE, 330, SYSUTCDATETIME()));
      `);
  }
  return listPerformanceScores({ month_key: monthKey });
}

// --- Exit (S12) ---

async function listExitRequests() {
  if (!(await isOpsTableReady('army_exit_requests'))) return [];
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT x.*, e.full_name, e.employee_code
    FROM dbo.army_exit_requests x
    INNER JOIN dbo.army_employees e ON e.employee_id = x.employee_id
    ORDER BY x.created_at DESC
  `);
  return r.recordset.map((row) => ({
    id: row.exit_request_id,
    employee_name: row.full_name,
    employee_code: row.employee_code,
    reason: row.reason,
    requested_lwd: formatDateYmd(row.requested_lwd),
    confirmed_lwd: formatDateYmd(row.confirmed_lwd),
    status_key: row.status_key,
    created_at: wireDatetimeFromSql(row.created_at)
  }));
}

async function createExitRequest(payload, userId) {
  if (!(await isOpsTableReady('army_exit_requests'))) throw err400('Ops tables not deployed.');
  const reason = String(payload.reason || '').trim();
  if (!reason) throw err400('Reason is required.');
  const pool = await getPool();
  const emp = await pool.request().input('id', sql.Int, payload.employee_id)
    .query('SELECT 1 FROM dbo.army_employees WHERE employee_id = @id');
  if (!emp.recordset.length) throw err404('Employee not found.');
  const clearance = {};
  getArmyExitClearanceCatalog().forEach((item) => { clearance[item.key] = false; });
  await pool.request()
    .input('empId', sql.Int, payload.employee_id)
    .input('reason', sql.NVarChar(500), reason)
    .input('lwd', sql.Date, payload.requested_lwd)
    .input('json', sql.NVarChar(sql.MAX), JSON.stringify(clearance))
    .query(`
      INSERT INTO dbo.army_exit_requests (employee_id, reason, requested_lwd, status_key, clearance_json, created_at)
      VALUES (@empId, @reason, @lwd, N'PENDING', @json, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  await pool.request().input('empId', sql.Int, payload.employee_id).query(
    "UPDATE dbo.army_employees SET status_key = N'ON_NOTICE', updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE employee_id = @empId"
  );
  return listExitRequests();
}

async function updateExitStatus(exitId, statusKey, confirmedLwd) {
  if (!isAllowedArmyExitStatusKey(statusKey)) throw err400('Invalid exit status.');
  const pool = await getPool();
  await pool.request()
    .input('id', sql.Int, exitId)
    .input('st', sql.NVarChar(20), statusKey)
    .input('lwd', sql.Date, confirmedLwd || null)
    .query(`
      UPDATE dbo.army_exit_requests SET status_key = @st, confirmed_lwd = COALESCE(@lwd, confirmed_lwd)
      OUTPUT INSERTED.employee_id WHERE exit_request_id = @id
    `);
  if (statusKey === 'COMPLETED') {
    const row = await pool.request().input('id', sql.Int, exitId).query('SELECT employee_id FROM dbo.army_exit_requests WHERE exit_request_id = @id');
    if (row.recordset.length) {
      await pool.request().input('empId', sql.Int, row.recordset[0].employee_id).query(
        "UPDATE dbo.army_employees SET status_key = N'EXITED', updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE employee_id = @empId"
      );
    }
  }
  return listExitRequests();
}

// --- Offers (S4) ---

async function listOfferLetters() {
  if (!(await isOpsTableReady('army_offer_letters'))) return [];
  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT o.*, c.full_name AS candidate_name, j.title AS job_title
    FROM dbo.army_offer_letters o
    INNER JOIN dbo.army_applications a ON a.application_id = o.application_id
    INNER JOIN dbo.army_candidates c ON c.candidate_id = a.candidate_id
    INNER JOIN dbo.army_job_openings j ON j.job_opening_id = a.job_opening_id
    ORDER BY o.created_at DESC
  `);
  return r.recordset.map((row) => ({
    id: row.offer_letter_id,
    application_id: row.application_id,
    candidate_name: row.candidate_name,
    job_title: row.job_title,
    ctc_amount: Number(row.ctc_amount),
    joining_date: formatDateYmd(row.joining_date),
    status_key: row.status_key,
    issued_at: wireDatetimeFromSql(row.issued_at)
  }));
}

async function createOfferLetter(payload, userId) {
  if (!(await isOpsTableReady('army_offer_letters'))) throw err400('Ops tables not deployed.');
  const pool = await getPool();
  await pool.request()
    .input('appId', sql.Int, payload.application_id)
    .input('ctc', sql.Decimal(12, 2), payload.ctc_amount)
    .input('join', sql.Date, payload.joining_date)
    .input('userId', sql.Int, userId || null)
    .query(`
      INSERT INTO dbo.army_offer_letters (application_id, ctc_amount, joining_date, status_key, created_by, created_at)
      VALUES (@appId, @ctc, @join, N'DRAFT', @userId, DATEADD(MINUTE, 330, SYSUTCDATETIME()))
    `);
  return listOfferLetters();
}

async function issueOfferLetter(offerId, userId) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, offerId).query(`
    UPDATE dbo.army_offer_letters SET status_key = N'ISSUED', issued_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE offer_letter_id = @id
  `);
  return listOfferLetters();
}

async function acceptOfferLetter(offerId, userId) {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.Int, offerId).query(`
    SELECT o.*, c.full_name, c.phone, c.email, c.dob, a.candidate_id, j.department_key, j.store_id, j.title
    FROM dbo.army_offer_letters o
    INNER JOIN dbo.army_applications a ON a.application_id = o.application_id
    INNER JOIN dbo.army_candidates c ON c.candidate_id = a.candidate_id
    INNER JOIN dbo.army_job_openings j ON j.job_opening_id = a.job_opening_id
    WHERE o.offer_letter_id = @id
  `);
  if (!r.recordset.length) throw err404('Offer not found.');
  const row = r.recordset[0];
  const employee = await createEmployee({
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    dob: formatDateYmd(row.dob),
    candidate_id: row.candidate_id,
    application_id: row.application_id,
    department_key: row.department_key,
    store_id: row.store_id,
    job_title: row.title,
    status_key: 'ONBOARDING'
  }, userId);
  await pool.request()
    .input('id', sql.Int, offerId)
    .input('empId', sql.Int, employee.id)
    .query(`
      UPDATE dbo.army_offer_letters SET status_key = N'ACCEPTED', acknowledged_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()), employee_id = @empId WHERE offer_letter_id = @id
    `);
  return { offers: await listOfferLetters(), employee };
}

async function getOpsMeta() {
  return {
    ops_tables_ready: await isOpsReady(),
    leave_types: require('../config/armyLeaveTypeCatalog').getArmyLeaveTypeCatalog(),
    leave_statuses: require('../config/armyLeaveTypeCatalog').getArmyLeaveStatusCatalog(),
    attendance_statuses: require('../config/armyAttendanceStatusCatalog').getArmyAttendanceStatusCatalog(),
    payroll_run_statuses: require('../config/armyPayrollRunStatusCatalog').getArmyPayrollRunStatusCatalog(),
    exit_statuses: require('../config/armyExitStatusCatalog').getArmyExitStatusCatalog(),
    exit_clearance_items: require('../config/armyExitStatusCatalog').getArmyExitClearanceCatalog(),
    offer_statuses: require('../config/armyOfferStatusCatalog').getArmyOfferStatusCatalog(),
    store_orientation_items: getArmyStoreOrientationCatalog()
  };
}

module.exports = {
  isOpsReady,
  getOpsMeta,
  listPlacements,
  confirmPlacement,
  createPlacement,
  getOrientation,
  updateOrientation,
  listShiftTypes,
  listAttendance,
  upsertAttendance,
  listRosters,
  publishRoster,
  createRoster,
  listLeaveRequests,
  reviewLeaveRequest,
  createLeaveRequest,
  listSalaryComponents,
  listPayrollRuns,
  createPayrollRun,
  approvePayrollRun,
  listSalaryAdvances,
  listLmsCourses,
  createLmsCourse,
  listTrainingAssignments,
  createTrainingAssignment,
  listTrainingSessions,
  createTrainingSession,
  listPerformanceScores,
  computePerformanceMonth,
  listExitRequests,
  createExitRequest,
  updateExitStatus,
  listOfferLetters,
  createOfferLetter,
  issueOfferLetter,
  acceptOfferLetter
};
