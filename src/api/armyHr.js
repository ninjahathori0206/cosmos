'use strict';

const express = require('express');
const Joi = require('joi');
const { requireModule, requirePermission } = require('../middleware/authorize');
const { getArmyDepartmentMetaForApi } = require('../config/armyDepartmentsCatalog');
const { getArmyEducationCatalog } = require('../config/armyEducationCatalog');
const { getArmyApplicationStatusCatalog } = require('../config/armyApplicationStatusCatalog');
const { getArmyJobOpeningStatusCatalog, isAllowedArmyJobOpeningStatusKey } = require('../config/armyJobOpeningStatusCatalog');
const { isAllowedArmyApplicationStatusKey } = require('../config/armyApplicationStatusCatalog');
const {
  listJobOpeningsAdmin,
  updateJobOpeningStatus,
  listApplicationsAdmin,
  getApplicationAdminById,
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

const jobStatusSchema = Joi.object({
  status: Joi.string().trim().uppercase().required()
});

const appStatusSchema = Joi.object({
  status_key: Joi.string().trim().uppercase().required()
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
        education_levels: getArmyEducationCatalog(),
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
