'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const { requireModule, requirePermission } = require('../middleware/authorize');
const { getArmyDepartmentMetaForApi, isAllowedArmyDepartmentKey } = require('../config/armyDepartmentsCatalog');
const { getArmyEducationCatalog } = require('../config/armyEducationCatalog');
const { getArmyApplicationSourceCatalog } = require('../config/armyApplicationSourceCatalog');
const { getArmyApplicationStatusCatalog } = require('../config/armyApplicationStatusCatalog');
const { getArmyJobOpeningStatusCatalog, isAllowedArmyJobOpeningStatusKey } = require('../config/armyJobOpeningStatusCatalog');
const { getArmyEmploymentTypeCatalog, isAllowedArmyEmploymentTypeKey } = require('../config/armyEmploymentTypeCatalog');
const { getArmyInterviewerRoleCatalog } = require('../config/armyInterviewerRoleCatalog');
const { getArmyInterviewModeCatalog } = require('../config/armyInterviewModeCatalog');
const {
  listInterviewTemplatesAdmin,
  getInterviewTemplateById,
  createInterviewTemplate,
  updateInterviewTemplate,
  setInterviewTemplateActive,
  duplicateInterviewTemplate,
  isInterviewTablesReady
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

function handleServiceError(err, res, next) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  return next(err);
}

router.get('/meta/statuses', ...hrView, async (req, res, next) => {
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
    return res.json({ success: true, data: application });
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

module.exports = router;
