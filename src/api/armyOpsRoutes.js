'use strict';

const Joi = require('joi');
const { requireModule, requirePermission } = require('../middleware/authorize');
const {
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
} = require('../services/armyOpsRepository');

function mountArmyOpsRoutes(router, { handleServiceError }) {
  const attView = [requireModule('army'), requirePermission('army.attendance.view')];
  const attEdit = [requireModule('army'), requirePermission('army.attendance.edit')];
  const leaveView = [requireModule('army'), requirePermission('army.leaves.view')];
  const leaveEdit = [requireModule('army'), requirePermission('army.leaves.edit')];
  const payrollView = [requireModule('army'), requirePermission('army.payroll.view')];
  const payrollEdit = [requireModule('army'), requirePermission('army.payroll.edit')];
  const staffView = [requireModule('army'), requirePermission('army.staff.view')];
  const staffEdit = [requireModule('army'), requirePermission('army.staff.edit')];
  const offersView = [requireModule('army'), requirePermission('army.hiring.offers.view', 'army.hiring.candidates.view')];
  const offersEdit = [requireModule('army'), requirePermission('army.hiring.offers.edit', 'army.hiring.candidates.edit')];

  router.get('/ops/meta', ...staffView, async (req, res, next) => {
    try {
      res.json({ success: true, data: await getOpsMeta() });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/placements', ...staffView, async (req, res, next) => {
    try {
      const placements = await listPlacements({ status_key: req.query.status || undefined });
      res.json({ success: true, data: { placements } });
    } catch (err) { return next(err); }
  });

  router.patch('/placements/:id/confirm', ...staffEdit, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      await confirmPlacement(id, req.user && req.user.user_id, req.body.notes);
      res.json({ success: true, data: { placements: await listPlacements() } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.post('/placements', ...staffEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        employee_id: Joi.number().integer().positive().required(),
        store_id: Joi.number().integer().positive().required(),
        notes: Joi.string().max(500).allow('', null).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const placements = await createPlacement(value, req.user && req.user.user_id);
      res.status(201).json({ success: true, data: { placements } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/employees/:id/orientation', ...staffView, async (req, res, next) => {
    try {
      const data = await getOrientation(Number(req.params.id));
      res.json({ success: true, data });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.put('/employees/:id/orientation', ...staffEdit, async (req, res, next) => {
    try {
      const data = await updateOrientation(Number(req.params.id), req.body, req.user && req.user.user_id);
      res.json({ success: true, data });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/shift-types', ...attView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { shift_types: await listShiftTypes() } });
    } catch (err) { return next(err); }
  });

  router.get('/attendance', ...attView, async (req, res, next) => {
    try {
      const records = await listAttendance({ from_date: req.query.from, to_date: req.query.to });
      res.json({ success: true, data: { records } });
    } catch (err) { return next(err); }
  });

  router.post('/attendance', ...attEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        employee_id: Joi.number().integer().positive().required(),
        att_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        status_key: Joi.string().trim().uppercase().required(),
        store_id: Joi.number().integer().positive().allow(null).optional(),
        late_minutes: Joi.number().integer().min(0).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const records = await upsertAttendance(value);
      res.json({ success: true, data: { records } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/rosters', ...attView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { rosters: await listRosters() } });
    } catch (err) { return next(err); }
  });

  router.patch('/rosters/:id/publish', ...attEdit, async (req, res, next) => {
    try {
      const rosters = await publishRoster(Number(req.params.id));
      res.json({ success: true, data: { rosters } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.post('/rosters', ...attEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        store_id: Joi.number().integer().positive().required(),
        week_start: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const rosters = await createRoster(value, req.user && req.user.user_id);
      res.status(201).json({ success: true, data: { rosters } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/leave-requests', ...leaveView, async (req, res, next) => {
    try {
      const requests = await listLeaveRequests({ status_key: req.query.status || undefined });
      res.json({ success: true, data: { requests } });
    } catch (err) { return next(err); }
  });

  router.patch('/leave-requests/:id/review', ...leaveEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        status_key: Joi.string().valid('APPROVED', 'REJECTED', 'CANCELLED').required(),
        review_notes: Joi.string().max(500).allow('', null).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const requests = await reviewLeaveRequest(Number(req.params.id), value.status_key, req.user && req.user.user_id, value.review_notes);
      res.json({ success: true, data: { requests } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.post('/leave-requests', ...leaveEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        employee_id: Joi.number().integer().positive().required(),
        leave_type_key: Joi.string().trim().uppercase().required(),
        from_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        to_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        reason: Joi.string().max(500).allow('', null).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const requests = await createLeaveRequest(value, req.user && req.user.user_id);
      res.status(201).json({ success: true, data: { requests } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/salary-components', ...payrollView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { components: await listSalaryComponents() } });
    } catch (err) { return next(err); }
  });

  router.get('/payroll-runs', ...payrollView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { runs: await listPayrollRuns() } });
    } catch (err) { return next(err); }
  });

  router.post('/payroll-runs', ...payrollEdit, async (req, res, next) => {
    try {
      const month = String(req.body.month_key || '').trim();
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month_key YYYY-MM required.' });
      const runs = await createPayrollRun(month, req.user && req.user.user_id);
      res.status(201).json({ success: true, data: { runs } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.patch('/payroll-runs/:id/approve', ...payrollEdit, async (req, res, next) => {
    try {
      const runs = await approvePayrollRun(Number(req.params.id), req.user && req.user.user_id);
      res.json({ success: true, data: { runs } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/salary-advances', ...payrollView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { advances: await listSalaryAdvances() } });
    } catch (err) { return next(err); }
  });

  router.get('/lms/courses', ...staffView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { courses: await listLmsCourses() } });
    } catch (err) { return next(err); }
  });

  router.get('/training/assignments', ...staffView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { assignments: await listTrainingAssignments() } });
    } catch (err) { return next(err); }
  });

  router.get('/training/sessions', ...staffView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { sessions: await listTrainingSessions() } });
    } catch (err) { return next(err); }
  });

  router.get('/performance/scores', ...staffView, async (req, res, next) => {
    try {
      const scores = await listPerformanceScores({ month_key: req.query.month || undefined });
      res.json({ success: true, data: { scores } });
    } catch (err) { return next(err); }
  });

  router.post('/performance/compute', ...staffEdit, async (req, res, next) => {
    try {
      const month = String(req.body.month_key || '').trim();
      if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ success: false, message: 'month_key YYYY-MM required.' });
      const scores = await computePerformanceMonth(month);
      res.json({ success: true, data: { scores } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/exit-requests', ...staffView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { requests: await listExitRequests() } });
    } catch (err) { return next(err); }
  });

  router.patch('/exit-requests/:id/status', ...staffEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        status_key: Joi.string().trim().uppercase().required(),
        confirmed_lwd: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const requests = await updateExitStatus(Number(req.params.id), value.status_key, value.confirmed_lwd);
      res.json({ success: true, data: { requests } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.post('/exit-requests', ...staffEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        employee_id: Joi.number().integer().positive().required(),
        requested_lwd: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
        reason: Joi.string().max(500).required()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const requests = await createExitRequest(value, req.user && req.user.user_id);
      res.status(201).json({ success: true, data: { requests } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.post('/lms/courses', ...staffEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        title: Joi.string().trim().max(200).required(),
        description: Joi.string().max(1000).allow('', null).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const courses = await createLmsCourse(value);
      res.status(201).json({ success: true, data: { courses } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.post('/training/assignments', ...staffEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        employee_id: Joi.number().integer().positive().required(),
        course_id: Joi.number().integer().positive().required(),
        due_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const assignments = await createTrainingAssignment(value);
      res.status(201).json({ success: true, data: { assignments } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.post('/training/sessions', ...staffEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        title: Joi.string().trim().max(200).required(),
        session_type: Joi.string().valid('ONSITE', 'OFFSITE').optional(),
        scheduled_at: Joi.string().isoDate().required(),
        venue: Joi.string().max(200).allow('', null).optional(),
        store_id: Joi.number().integer().positive().allow(null).optional(),
        trainer_name: Joi.string().max(120).allow('', null).optional()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const sessions = await createTrainingSession(value);
      res.status(201).json({ success: true, data: { sessions } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.get('/offer-letters', ...offersView, async (req, res, next) => {
    try {
      res.json({ success: true, data: { offers: await listOfferLetters() } });
    } catch (err) { return next(err); }
  });

  router.post('/offer-letters', ...offersEdit, async (req, res, next) => {
    try {
      const schema = Joi.object({
        application_id: Joi.number().integer().positive().required(),
        ctc_amount: Joi.number().positive().required(),
        joining_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
      });
      const { value, error } = schema.validate(req.body);
      if (error) return res.status(400).json({ success: false, message: error.details[0].message });
      const offers = await createOfferLetter(value, req.user && req.user.user_id);
      res.status(201).json({ success: true, data: { offers } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.patch('/offer-letters/:id/issue', ...offersEdit, async (req, res, next) => {
    try {
      const offers = await issueOfferLetter(Number(req.params.id), req.user && req.user.user_id);
      res.json({ success: true, data: { offers } });
    } catch (err) { return handleServiceError(err, res, next); }
  });

  router.patch('/offer-letters/:id/accept', ...offersEdit, async (req, res, next) => {
    try {
      const result = await acceptOfferLetter(Number(req.params.id), req.user && req.user.user_id);
      res.json({ success: true, data: result });
    } catch (err) { return handleServiceError(err, res, next); }
  });
}

module.exports = mountArmyOpsRoutes;
