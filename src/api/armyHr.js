'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const multer = require('multer');
const { requireModule, requirePermission } = require('../middleware/authorize');
const { getArmyDepartmentMetaForApi, isAllowedArmyDepartmentKey } = require('../config/armyDepartmentsCatalog');
const { getArmyEducationCatalog } = require('../config/armyEducationCatalog');
const { getArmyApplicationSourceCatalog } = require('../config/armyApplicationSourceCatalog');
const { getArmyApplicationStatusCatalog } = require('../config/armyApplicationStatusCatalog');
const { getArmyJobOpeningStatusCatalog, isAllowedArmyJobOpeningStatusKey } = require('../config/armyJobOpeningStatusCatalog');
const { getArmyEmploymentTypeCatalog, isAllowedArmyEmploymentTypeKey } = require('../config/armyEmploymentTypeCatalog');
const { getArmyInterviewerRoleCatalog } = require('../config/armyInterviewerRoleCatalog');
const { getArmyInterviewModeCatalog } = require('../config/armyInterviewModeCatalog');
const { getArmyInterviewStatusCatalog } = require('../config/armyInterviewStatusCatalog');
const { getArmyInterviewRecommendationCatalog } = require('../config/armyInterviewRecommendationCatalog');
const { getArmyRubricParameterCatalog } = require('../config/armyRubricParameterCatalog');
const { getArmyEmployeeStatusCatalog } = require('../config/armyEmployeeStatusCatalog');
const { getArmyEmployeeGenderCatalog } = require('../config/armyEmployeeGenderCatalog');
const { getArmyBloodGroupCatalog } = require('../config/armyBloodGroupCatalog');
const { getArmyBankAccountTypeCatalog } = require('../config/armyBankAccountTypeCatalog');
const { getArmyEmployeeDocumentTypeCatalog } = require('../config/armyEmployeeDocumentTypeCatalog');
const { getArmyEmployeeOnboardingItemCatalog } = require('../config/armyEmployeeOnboardingItemCatalog');
const {
  listInterviewTemplatesAdmin,
  getInterviewTemplateById,
  createInterviewTemplate,
  updateInterviewTemplate,
  setInterviewTemplateActive,
  duplicateInterviewTemplate,
  isInterviewTablesReady,
  isInterviewRatingsReady,
  listApplicationInterviews,
  updateApplicationInterview,
  saveApplicationInterviewRating,
  getApplicationInterviewRating
} = require('../services/armyInterviewRepository');
const { isAllowedArmyApplicationStatusKey } = require('../config/armyApplicationStatusCatalog');
const {
  listJobOpeningsAdmin,
  getJobOpeningAdminById,
  createJobOpening,
  updateJobOpening,
  listHiringStores,
  updateJobOpeningStatus,
  listApplicationsAdmin,
  getApplicationAdminById,
  getApplicationResumeFile,
  updateApplicationStatus,
  getHiringDashboardStats,
  isHiringTablesReady
} = require('../services/armyHiringRepository');
const {
  isEmployeesTablesReady,
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
} = require('../services/armyEmployeeRepository');
const mountArmyOpsRoutes = require('./armyOpsRoutes');
const { getOpsMeta } = require('../services/armyOpsRepository');

const router = express.Router();

const hrView = [
  requireModule('army'),
  requirePermission('army.hiring.job_openings.view', 'army.hiring.candidates.view')
];
const jobsView = [requireModule('army'), requirePermission('army.hiring.job_openings.view')];
const jobsEdit = [requireModule('army'), requirePermission('army.hiring.job_openings.edit')];
const candidatesView = [requireModule('army'), requirePermission('army.hiring.candidates.view')];
const candidatesEdit = [requireModule('army'), requirePermission('army.hiring.candidates.edit')];

const templatesView = [requireModule('army'), requirePermission('army.hiring.interview_templates.view')];
const templatesEdit = [requireModule('army'), requirePermission('army.hiring.interview_templates.edit')];

const staffView = [requireModule('army'), requirePermission('army.staff.view')];
const staffCreate = [requireModule('army'), requirePermission('army.staff.create')];
const staffEdit = [requireModule('army'), requirePermission('army.staff.edit')];

const armyHrMetaView = [
  requireModule('army'),
  requirePermission(
    'army.hiring.job_openings.view',
    'army.hiring.candidates.view',
    'army.staff.view'
  )
];

const employeeDocUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      try {
        const id = Number(req.params.id);
        if (!id) return cb(new Error('Invalid employee id.'));
        cb(null, ensureEmployeeDocDir(id));
      } catch (err) {
        cb(err);
      }
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ok = /\.(pdf|png|jpe?g|webp)$/i.test(file.originalname || '');
    cb(ok ? null : new Error('Upload PDF, PNG, JPG, or WEBP only.'), ok);
  }
});

const jobStatusSchema = Joi.object({
  status: Joi.string().trim().uppercase().required()
});

const appStatusSchema = Joi.object({
  status_key: Joi.string().trim().uppercase().required()
});

const jobOpeningBodySchema = Joi.object({
  title: Joi.string().trim().min(2).max(200).required(),
  department_key: Joi.string().trim().uppercase().required(),
  store_id: Joi.number().integer().positive().required(),
  vacancies: Joi.number().integer().min(1).max(99).required(),
  employment_type: Joi.string().trim().uppercase().required(),
  location: Joi.string().trim().max(200).allow('', null).optional(),
  apply_by: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null).optional(),
  about_text: Joi.string().trim().max(8000).allow('', null).optional(),
  requirements: Joi.alternatives().try(
    Joi.array().items(Joi.string().trim().max(500)),
    Joi.string().trim().max(8000).allow('')
  ).optional(),
  interview_template_id: Joi.number().integer().positive().allow(null).optional()
});

const templateStageSchema = Joi.object({
  stage_name: Joi.string().trim().min(2).max(120).required(),
  interviewer_role_key: Joi.string().trim().uppercase().required(),
  mode_key: Joi.string().trim().uppercase().default('IN_PERSON')
});

const interviewTemplateBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).required(),
  description: Joi.string().trim().max(500).allow('', null).optional(),
  is_active: Joi.boolean().optional(),
  stages: Joi.array().items(templateStageSchema).min(1).max(6).required()
});

const templateActiveSchema = Joi.object({
  is_active: Joi.boolean().required()
});

const interviewScheduleSchema = Joi.object({
  scheduled_at: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/).allow(null).optional(),
  location: Joi.string().trim().max(200).allow('', null).optional(),
  status_key: Joi.string().trim().uppercase().valid('PENDING', 'SCHEDULED', 'COMPLETED', 'SKIPPED').optional(),
  clear_schedule: Joi.boolean().optional(),
  clear_location: Joi.boolean().optional()
});

const interviewRatingSchema = Joi.object({
  scores: Joi.object().min(1).required(),
  notes: Joi.string().trim().min(1).max(2000).required(),
  recommendation_key: Joi.string().trim().uppercase().valid('PROCEED', 'HOLD', 'REJECT').required()
});

const employeeBodySchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(120).required(),
  phone: Joi.string().trim().min(10).max(15).required(),
  email: Joi.string().trim().email({ tlds: { allow: false } }).allow('', null).optional(),
  dob: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null).optional(),
  gender_key: Joi.string().trim().uppercase().allow('', null).optional(),
  blood_group_key: Joi.string().trim().uppercase().allow('', null).optional(),
  address_current: Joi.string().trim().max(500).allow('', null).optional(),
  address_permanent: Joi.string().trim().max(500).allow('', null).optional(),
  emergency_contact_name: Joi.string().trim().max(120).allow('', null).optional(),
  emergency_contact_relation: Joi.string().trim().max(60).allow('', null).optional(),
  emergency_contact_phone: Joi.string().trim().max(15).allow('', null).optional(),
  aadhaar_number: Joi.string().trim().max(12).allow('', null).optional(),
  pan_number: Joi.string().trim().max(10).allow('', null).optional(),
  bank_name: Joi.string().trim().max(120).allow('', null).optional(),
  bank_account_number: Joi.string().trim().max(30).allow('', null).optional(),
  bank_ifsc: Joi.string().trim().max(11).allow('', null).optional(),
  bank_account_type_key: Joi.string().trim().uppercase().allow('', null).optional(),
  store_id: Joi.number().integer().positive().allow(null).optional(),
  department_key: Joi.string().trim().uppercase().allow('', null).optional(),
  job_title: Joi.string().trim().max(120).allow('', null).optional(),
  status_key: Joi.string().trim().uppercase().optional(),
  candidate_id: Joi.number().integer().positive().allow(null).optional(),
  application_id: Joi.number().integer().positive().allow(null).optional()
});

const employeeStatusSchema = Joi.object({
  status_key: Joi.string().trim().uppercase().required()
});

const onboardingItemSchema = Joi.object({
  is_complete: Joi.boolean().required()
});

const documentVerifySchema = Joi.object({
  is_verified: Joi.boolean().required()
});

function handleServiceError(err, res, next) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  return next(err);
}

router.get('/meta/statuses', ...armyHrMetaView, async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        job_opening_statuses: getArmyJobOpeningStatusCatalog(),
        application_statuses: getArmyApplicationStatusCatalog(),
        departments: getArmyDepartmentMetaForApi(),
        employment_types: getArmyEmploymentTypeCatalog(),
        education_levels: getArmyEducationCatalog(),
        application_sources: getArmyApplicationSourceCatalog(),
        interviewer_roles: getArmyInterviewerRoleCatalog(),
        interview_modes: getArmyInterviewModeCatalog(),
        interview_templates: await listInterviewTemplatesAdmin({ active_only: true }),
        interview_tables_ready: await isInterviewTablesReady(),
        interview_ratings_ready: await isInterviewRatingsReady(),
        interview_statuses: getArmyInterviewStatusCatalog(),
        interview_recommendations: getArmyInterviewRecommendationCatalog(),
        rubric_parameters: getArmyRubricParameterCatalog(),
        employee_statuses: getArmyEmployeeStatusCatalog(),
        employee_genders: getArmyEmployeeGenderCatalog(),
        employee_blood_groups: getArmyBloodGroupCatalog(),
        employee_bank_account_types: getArmyBankAccountTypeCatalog(),
        employee_document_types: getArmyEmployeeDocumentTypeCatalog(),
        employee_onboarding_items: getArmyEmployeeOnboardingItemCatalog(),
        employees_tables_ready: await isEmployeesTablesReady(),
        ...(await getOpsMeta()),
        stores: await listHiringStores(),
        db_ready: await isHiringTablesReady()
      }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/dashboard/stats', ...hrView, async (req, res, next) => {
  try {
    const stats = await getHiringDashboardStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    return next(err);
  }
});

router.get('/meta/stores', ...jobsView, async (req, res, next) => {
  try {
    const stores = await listHiringStores();
    return res.json({ success: true, data: { stores } });
  } catch (err) {
    return next(err);
  }
});

router.get('/interview-templates', ...templatesView, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const templates = await listInterviewTemplatesAdmin({ q: q || undefined });
    return res.json({ success: true, data: { total: templates.length, templates } });
  } catch (err) {
    return next(err);
  }
});

router.get('/interview-templates/:id', ...templatesView, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid template id.' });
    const template = await getInterviewTemplateById(id);
    return res.json({ success: true, data: template });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.post('/interview-templates', ...templatesEdit, async (req, res, next) => {
  try {
    const { value, error } = interviewTemplateBodySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const template = await createInterviewTemplate(value, req.user && req.user.user_id);
    return res.status(201).json({ success: true, data: template });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.put('/interview-templates/:id', ...templatesEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid template id.' });
    const { value, error } = interviewTemplateBodySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const template = await updateInterviewTemplate(id, value);
    return res.json({ success: true, data: template });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.patch('/interview-templates/:id/status', ...templatesEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid template id.' });
    const { value, error } = templateActiveSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const template = await setInterviewTemplateActive(id, value.is_active);
    return res.json({ success: true, data: template });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.post('/interview-templates/:id/duplicate', ...templatesEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid template id.' });
    const template = await duplicateInterviewTemplate(id, req.user && req.user.user_id);
    return res.status(201).json({ success: true, data: template });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.get('/job-openings/:id', ...jobsView, async (req, res, next) => {
  try {
    const jobId = Number(req.params.id);
    if (!jobId) return res.status(400).json({ success: false, message: 'Invalid job opening id.' });
    const job = await getJobOpeningAdminById(jobId);
    return res.json({ success: true, data: job });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.post('/job-openings', ...jobsEdit, async (req, res, next) => {
  try {
    const { value, error } = jobOpeningBodySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    if (!isAllowedArmyDepartmentKey(value.department_key)) {
      return res.status(400).json({ success: false, message: 'Invalid department.' });
    }
    if (!isAllowedArmyEmploymentTypeKey(value.employment_type)) {
      return res.status(400).json({ success: false, message: 'Invalid employment type.' });
    }

    const job = await createJobOpening(value, req.user && req.user.user_id);
    return res.status(201).json({ success: true, data: job });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.put('/job-openings/:id', ...jobsEdit, async (req, res, next) => {
  try {
    const jobId = Number(req.params.id);
    if (!jobId) return res.status(400).json({ success: false, message: 'Invalid job opening id.' });

    const { value, error } = jobOpeningBodySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    if (!isAllowedArmyDepartmentKey(value.department_key)) {
      return res.status(400).json({ success: false, message: 'Invalid department.' });
    }
    if (!isAllowedArmyEmploymentTypeKey(value.employment_type)) {
      return res.status(400).json({ success: false, message: 'Invalid employment type.' });
    }

    const job = await updateJobOpening(jobId, value);
    return res.json({ success: true, data: job });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.get('/job-openings', ...jobsView, async (req, res, next) => {
  try {
    const status = String(req.query.status || '').trim().toUpperCase();
    const department_key = String(req.query.department_key || '').trim().toUpperCase();
    const q = String(req.query.q || '').trim();
    const jobs = await listJobOpeningsAdmin({
      status: status || undefined,
      department_key: department_key || undefined,
      q: q || undefined
    });
    return res.json({ success: true, data: { total: jobs.length, jobs } });
  } catch (err) {
    return next(err);
  }
});

router.patch('/job-openings/:id/status', ...jobsEdit, async (req, res, next) => {
  try {
    const jobId = Number(req.params.id);
    if (!jobId) return res.status(400).json({ success: false, message: 'Invalid job opening id.' });

    const { value, error } = jobStatusSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    if (!isAllowedArmyJobOpeningStatusKey(value.status)) {
      return res.status(400).json({ success: false, message: 'Invalid job opening status.' });
    }

    const job = await updateJobOpeningStatus(jobId, value.status, req.user && req.user.user_id);
    return res.json({ success: true, data: job });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.get('/applications', ...candidatesView, async (req, res, next) => {
  try {
    const status_key = String(req.query.status_key || '').trim().toUpperCase();
    const job_opening_id = req.query.job_opening_id ? Number(req.query.job_opening_id) : undefined;
    const q = String(req.query.q || '').trim();
    const applications = await listApplicationsAdmin({
      status_key: status_key || undefined,
      job_opening_id: job_opening_id || undefined,
      q: q || undefined
    });
    return res.json({ success: true, data: { total: applications.length, applications } });
  } catch (err) {
    return next(err);
  }
});

router.get('/applications/:id', ...candidatesView, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid application id.' });
    const application = await getApplicationAdminById(id);
    application.interviews = await listApplicationInterviews(id);
    return res.json({ success: true, data: application });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.patch('/applications/:id/interviews/:interviewId', ...candidatesEdit, async (req, res, next) => {
  try {
    const appId = Number(req.params.id);
    const interviewId = Number(req.params.interviewId);
    if (!appId || !interviewId) {
      return res.status(400).json({ success: false, message: 'Invalid application or interview id.' });
    }
    const { value, error } = interviewScheduleSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const interview = await updateApplicationInterview(appId, interviewId, value);
    return res.json({ success: true, data: interview });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.get('/applications/:id/interviews/:interviewId/rating', ...candidatesView, async (req, res, next) => {
  try {
    const appId = Number(req.params.id);
    const interviewId = Number(req.params.interviewId);
    if (!appId || !interviewId) {
      return res.status(400).json({ success: false, message: 'Invalid application or interview id.' });
    }
    const rating = await getApplicationInterviewRating(appId, interviewId);
    return res.json({ success: true, data: { rating } });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.put('/applications/:id/interviews/:interviewId/rating', ...candidatesEdit, async (req, res, next) => {
  try {
    const appId = Number(req.params.id);
    const interviewId = Number(req.params.interviewId);
    if (!appId || !interviewId) {
      return res.status(400).json({ success: false, message: 'Invalid application or interview id.' });
    }
    const { value, error } = interviewRatingSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const interview = await saveApplicationInterviewRating(appId, interviewId, value, req.user && req.user.user_id);
    return res.json({ success: true, data: interview });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.get('/applications/:id/resume', ...candidatesView, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid application id.' });
    const fileInfo = await getApplicationResumeFile(id);
    if (!fileInfo) {
      return res.status(404).json({ success: false, message: 'Resume not found for this application.' });
    }
    return res.download(fileInfo.absolutePath, fileInfo.downloadName, (err) => {
      if (err && !res.headersSent) return next(err);
    });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.patch('/applications/:id/status', ...candidatesEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid application id.' });

    const { value, error } = appStatusSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    if (!isAllowedArmyApplicationStatusKey(value.status_key)) {
      return res.status(400).json({ success: false, message: 'Invalid application status.' });
    }

    const application = await updateApplicationStatus(id, value.status_key);
    return res.json({ success: true, data: application });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.get('/employees/stats', ...staffView, async (req, res, next) => {
  try {
    const stats = await getEmployeeDashboardStats();
    return res.json({ success: true, data: stats });
  } catch (err) {
    return next(err);
  }
});

router.get('/employees', ...staffView, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const status_key = String(req.query.status || '').trim().toUpperCase();
    const store_id = req.query.store_id ? Number(req.query.store_id) : undefined;
    const employees = await listEmployeesAdmin({
      q: q || undefined,
      status_key: status_key || undefined,
      store_id: store_id || undefined
    });
    return res.json({ success: true, data: { total: employees.length, employees } });
  } catch (err) {
    return next(err);
  }
});

router.get('/employees/:id', ...staffView, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid employee id.' });
    const employee = await getEmployeeAdminById(id, { includeSensitive: true });
    return res.json({ success: true, data: employee });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.post('/employees', ...staffCreate, async (req, res, next) => {
  try {
    const { value, error } = employeeBodySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const employee = await createEmployee(value, req.user && req.user.user_id);
    return res.status(201).json({ success: true, data: employee });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.put('/employees/:id', ...staffEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid employee id.' });
    const { value, error } = employeeBodySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const employee = await updateEmployee(id, value);
    return res.json({ success: true, data: employee });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.patch('/employees/:id/status', ...staffEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid employee id.' });
    const { value, error } = employeeStatusSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const employee = await setEmployeeStatus(id, value.status_key);
    return res.json({ success: true, data: employee });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.patch('/employees/:id/onboarding/:itemKey', ...staffEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const itemKey = String(req.params.itemKey || '').trim().toUpperCase();
    if (!id || !itemKey) return res.status(400).json({ success: false, message: 'Invalid request.' });
    const { value, error } = onboardingItemSchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const employee = await setOnboardingItem(id, itemKey, value.is_complete, req.user && req.user.user_id);
    return res.json({ success: true, data: employee });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.post('/employees/:id/documents', ...staffEdit, (req, res, next) => {
  employeeDocUpload.single('document')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed.' });
    }
    next();
  });
}, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid employee id.' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Document file required.' });
    const docType = String(req.body.doc_type_key || '').trim().toUpperCase();
    if (!docType) return res.status(400).json({ success: false, message: 'doc_type_key required.' });
    const employee = await addEmployeeDocument(id, docType, req.file, req.user && req.user.user_id);
    return res.status(201).json({ success: true, data: employee });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.patch('/employees/:id/documents/:docId/verify', ...staffEdit, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const docId = Number(req.params.docId);
    if (!id || !docId) return res.status(400).json({ success: false, message: 'Invalid request.' });
    const { value, error } = documentVerifySchema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    const employee = await verifyEmployeeDocument(id, docId, value.is_verified);
    return res.json({ success: true, data: employee });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

mountArmyOpsRoutes(router, { handleServiceError });

module.exports = router;
