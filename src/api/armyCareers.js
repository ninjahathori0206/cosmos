'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Joi = require('joi');
const { getArmyDepartmentMetaForApi, isAllowedArmyDepartmentKey, getArmyDepartmentByKey } = require('../config/armyDepartmentsCatalog');
const { getArmyEducationCatalog, isAllowedArmyEducationKey } = require('../config/armyEducationCatalog');
const { getArmyJoiningAvailabilityCatalog, isAllowedArmyJoiningAvailabilityKey } = require('../config/armyJoiningAvailabilityCatalog');
const { normalizeArmyApplicationSourceKey } = require('../config/armyApplicationSourceCatalog');
const { todayYmd } = require('../lib/cosmosIst');
const {
  sendOtp,
  verifyOtp,
  assertVerificationToken,
  revokeVerificationToken,
  normalizePhone
} = require('../services/armyCareersOtpService');
const {
  listPublishedJobs,
  getPublishedJobBySlug,
  createApplication,
  getLatestApplicationByPhone,
  getApplicationPublicView
} = require('../services/armyHiringRepository');

const router = express.Router();

const RESUME_DIR = path.join(__dirname, '..', 'public', 'uploads', 'army-careers', 'resumes');
if (!fs.existsSync(RESUME_DIR)) fs.mkdirSync(RESUME_DIR, { recursive: true });

const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, RESUME_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, 'resume-' + Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  }
});

const resumeUpload = multer({
  storage: resumeStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (ok.includes(ext)) return cb(null, true);
    cb(new Error('Resume must be PDF or DOC (max 5 MB).'));
  }
});

const listQuerySchema = Joi.object({
  department_key: Joi.string().trim().uppercase().allow('').optional(),
  q: Joi.string().trim().max(120).allow('').optional()
});

const otpSendSchema = Joi.object({
  phone: Joi.string().trim().required()
});

const otpVerifySchema = Joi.object({
  phone: Joi.string().trim().required(),
  otp_code: Joi.string().trim().pattern(/^\d{6}$/).required()
});

const applicationSchema = Joi.object({
  job_slug: Joi.string().trim().lowercase().required(),
  full_name: Joi.string().trim().min(2).max(120).required(),
  phone: Joi.string().trim().required(),
  email: Joi.string().trim().email().required(),
  dob: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  experience_years: Joi.number().integer().min(0).max(50).required(),
  experience_months: Joi.number().integer().min(0).max(11).required(),
  education_key: Joi.string().trim().uppercase().required(),
  last_employer: Joi.string().trim().max(160).allow('', null).optional(),
  referral_code: Joi.string().trim().max(40).allow('', null).optional(),
  preferred_store: Joi.string().trim().max(120).allow('', null).optional(),
  source: Joi.string().trim().max(40).allow('', null).optional(),
  joining_availability_key: Joi.string().trim().uppercase().required(),
  notice_period_days: Joi.alternatives().try(
    Joi.number().integer().min(1).max(180),
    Joi.string().trim().allow(''),
    Joi.valid(null)
  ).optional(),
  expected_join_date: Joi.alternatives().try(
    Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/),
    Joi.string().trim().allow(''),
    Joi.valid(null)
  ).optional()
}).custom((value, helpers) => {
  const key = String(value.joining_availability_key || '').toUpperCase();
  if (key === 'ON_NOTICE') {
    const days = Number(value.notice_period_days);
    if (!days || days < 1 || days > 180) {
      return helpers.error('any.custom', { message: 'Notice period days (1–180) required when on notice.' });
    }
    const dateStr = String(value.expected_join_date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return helpers.error('any.custom', { message: 'Expected joining date required when on notice.' });
    }
    const today = todayYmd();
    if (dateStr < today) {
      return helpers.error('any.custom', { message: 'Expected joining date cannot be in the past.' });
    }
  }
  return value;
});

function readVerificationToken(req) {
  return req.get('X-Army-Verification-Token') || req.get('x-army-verification-token') || '';
}

function handleJoiError(error, res) {
  return res.status(400).json({ success: false, message: error.details[0].message });
}

function handleServiceError(err, res, next) {
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  return next(err);
}

router.get('/meta/departments', (req, res) => {
  res.json({
    success: true,
    data: getArmyDepartmentMetaForApi()
  });
});

router.get('/meta/education', (req, res) => {
  res.json({
    success: true,
    data: { education_levels: getArmyEducationCatalog() }
  });
});

router.get('/meta/joining-availability', (req, res) => {
  res.json({
    success: true,
    data: { joining_options: getArmyJoiningAvailabilityCatalog() }
  });
});

router.get('/meta/stores', async (req, res, next) => {
  try {
    const jobs = await listPublishedJobs({});
    const stores = [...new Set(jobs.map((job) => job.store_name).filter(Boolean))].sort();
    return res.json({ success: true, data: { stores } });
  } catch (err) {
    return next(err);
  }
});

router.get('/jobs', async (req, res, next) => {
  try {
    const { value, error } = listQuerySchema.validate(req.query, { stripUnknown: true });
    if (error) return handleJoiError(error, res);
    const departmentKey = value.department_key || '';
    if (departmentKey && !isAllowedArmyDepartmentKey(departmentKey)) {
      return res.status(400).json({ success: false, message: 'Invalid department_key.' });
    }
    const jobs = (await listPublishedJobs({
      department_key: departmentKey,
      q: value.q || ''
    })).map((job) => ({
      ...job,
      department: getArmyDepartmentByKey(job.department_key)
    }));
    return res.json({
      success: true,
      data: { total: jobs.length, jobs }
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/jobs/:slug', async (req, res, next) => {
  try {
    const job = await getPublishedJobBySlug(req.params.slug);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job opening not found.' });
    }
    return res.json({
      success: true,
      data: { ...job, department: getArmyDepartmentByKey(job.department_key) }
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/otp/send', (req, res, next) => {
  try {
    const { value, error } = otpSendSchema.validate(req.body, { stripUnknown: true });
    if (error) return handleJoiError(error, res);
    const data = sendOtp(value.phone);
    return res.json({ success: true, data });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.post('/otp/verify', (req, res, next) => {
  try {
    const { value, error } = otpVerifySchema.validate(req.body, { stripUnknown: true });
    if (error) return handleJoiError(error, res);
    const data = verifyOtp(value.phone, value.otp_code);
    return res.json({ success: true, data });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.post('/applications', resumeUpload.single('resume'), async (req, res, next) => {
  try {
    const token = readVerificationToken(req);
    const verified = assertVerificationToken(token);

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume (CV) is required.' });
    }

    const { value, error } = applicationSchema.validate(req.body, { stripUnknown: true });
    if (error) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      const msg = error.details[0].message;
      return res.status(400).json({ success: false, message: msg });
    }

    if (!isAllowedArmyEducationKey(value.education_key)) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid education level.' });
    }

    if (!isAllowedArmyJoiningAvailabilityKey(value.joining_availability_key)) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Invalid joining availability.' });
    }

    const phone = normalizePhone(value.phone);
    if (!phone || phone !== verified.phone) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ success: false, message: 'Phone number must match verified number.' });
    }

    const joiningKey = String(value.joining_availability_key).toUpperCase();
    const noticeDays = joiningKey === 'ON_NOTICE' ? Number(value.notice_period_days) : null;
    const expectedJoin = joiningKey === 'ON_NOTICE' ? String(value.expected_join_date).trim() : null;

    const resumeUrl = '/uploads/army-careers/resumes/' + req.file.filename;

    const application = await createApplication({
      ...value,
      phone,
      source_key: normalizeArmyApplicationSourceKey(value.source),
      resume_url: resumeUrl,
      joining_availability_key: joiningKey,
      notice_period_days: noticeDays,
      expected_join_date: expectedJoin
    });

    revokeVerificationToken(token);

    return res.status(201).json({
      success: true,
      data: getApplicationPublicView(application)
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return handleServiceError(err, res, next);
  }
});

router.get('/applications/status', async (req, res, next) => {
  try {
    const token = readVerificationToken(req);
    const verified = assertVerificationToken(token);
    const application = await getLatestApplicationByPhone(verified.phone);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'No application found for this number.'
      });
    }
    return res.json({
      success: true,
      data: getApplicationPublicView(application)
    });
  } catch (err) {
    return handleServiceError(err, res, next);
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Resume must be 5 MB or smaller.' });
    }
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err && err.message && /Resume must be PDF/.test(err.message)) {
    return res.status(400).json({ success: false, message: err.message });
  }
  return next(err);
});

module.exports = router;
