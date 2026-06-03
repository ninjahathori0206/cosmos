'use strict';

const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { getPool } = require('../config/db');
const {
  listPublishedArmyCareersJobs,
  getPublishedArmyCareersJobBySlug
} = require('../config/armyCareersSeed');
const { getArmyApplicationStatusByKey } = require('../config/armyApplicationStatusCatalog');
const { getArmyJobOpeningStatusByKey } = require('../config/armyJobOpeningStatusCatalog');
const { getArmyJoiningAvailabilityByKey } = require('../config/armyJoiningAvailabilityCatalog');
const { getArmyDepartmentByKey, isAllowedArmyDepartmentKey } = require('../config/armyDepartmentsCatalog');
const { getArmyEmploymentTypeByKey, isAllowedArmyEmploymentTypeKey } = require('../config/armyEmploymentTypeCatalog');
const { formatDateYmd, wallClockIso } = require('../lib/cosmosIst');
const { assertTemplateExists, seedApplicationInterviewsFromJob } = require('./armyInterviewRepository');

let tablesReadyCache = null;

async function isHiringTablesReady() {
  if (tablesReadyCache !== null) return tablesReadyCache;
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      "SELECT OBJECT_ID(N'dbo.army_job_openings', N'U') AS oid"
    );
    tablesReadyCache = !!r.recordset[0].oid;
  } catch (_) {
    tablesReadyCache = false;
  }
  return tablesReadyCache;
}

function formatDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return formatDateYmd(value);
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function formatIstIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return wallClockIso(d);
}

function parseRequirementsJson(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function mapJobRow(row, { includeInternal } = {}) {
  const base = {
    slug: row.slug,
    title: row.title,
    department_key: row.department_key,
    store_name: row.store_name,
    employment_type: row.employment_type,
    employment_type_label: row.employment_type_label,
    vacancies: row.vacancies,
    location: row.location || null,
    apply_by: formatDateOnly(row.apply_by),
    about: row.about_text || '',
    requirements: parseRequirementsJson(row.requirements_json)
  };
  if (includeInternal) {
    base.id = row.job_opening_id;
    base.status = row.status;
    base.published_at = formatIstIso(row.published_at);
    base.created_at = formatIstIso(row.created_at);
    base.updated_at = formatIstIso(row.updated_at);
  }
  return base;
}

async function listPublishedJobs(filters = {}) {
  if (!(await isHiringTablesReady())) {
    return listPublishedArmyCareersJobs(filters);
  }

  const pool = await getPool();
  const req = pool.request();
  let where = "j.status = N'PUBLISHED'";
  if (filters.department_key) {
    req.input('dept', sql.NVarChar(30), filters.department_key);
    where += ' AND j.department_key = @dept';
  }
  if (filters.q) {
    req.input('q', sql.NVarChar(120), '%' + filters.q + '%');
    where += ' AND (j.title LIKE @q OR j.store_name LIKE @q OR j.location LIKE @q)';
  }

  const r = await req.query(`
    SELECT j.*
    FROM dbo.army_job_openings j
    WHERE ${where}
    ORDER BY j.published_at DESC, j.job_opening_id DESC
  `);
  return r.recordset.map((row) => mapJobRow(row));
}

async function getPublishedJobBySlug(slug) {
  if (!(await isHiringTablesReady())) {
    return getPublishedArmyCareersJobBySlug(slug);
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('slug', sql.NVarChar(120), slug)
    .query(`
      SELECT j.*
      FROM dbo.army_job_openings j
      WHERE j.slug = @slug AND j.status = N'PUBLISHED'
    `);
  if (!r.recordset.length) return null;
  return mapJobRow(r.recordset[0]);
}

async function createApplication(payload) {
  if (!(await isHiringTablesReady())) {
    const { createApplication: memCreate } = require('./armyCareersApplicationStore');
    return memCreate(payload);
  }

  const pool = await getPool();
  const jobR = await pool.request()
    .input('slug', sql.NVarChar(120), payload.job_slug)
    .query(`
      SELECT job_opening_id, slug, title, store_name, interview_template_id
      FROM dbo.army_job_openings
      WHERE slug = @slug AND status = N'PUBLISHED'
    `);
  if (!jobR.recordset.length) {
    const err = new Error('Job opening not found or no longer published.');
    err.statusCode = 404;
    throw err;
  }
  const job = jobR.recordset[0];

  const dupR = await pool.request()
    .input('phone', sql.NVarChar(15), payload.phone)
    .input('jobId', sql.Int, job.job_opening_id)
    .query(`
      SELECT TOP 1 a.application_id
      FROM dbo.army_applications a
      INNER JOIN dbo.army_candidates c ON c.candidate_id = a.candidate_id
      WHERE c.phone = @phone AND a.job_opening_id = @jobId AND a.status_key <> N'NOT_SELECTED'
    `);
  if (dupR.recordset.length) {
    const err = new Error('You have already applied for this role with this number.');
    err.statusCode = 409;
    throw err;
  }

  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const txReq = new sql.Request(tx);
    txReq.input('phone', sql.NVarChar(15), payload.phone);
    const candR = await txReq.query(`
      SELECT candidate_id FROM dbo.army_candidates WHERE phone = @phone
    `);

    let candidateId;
    if (candR.recordset.length) {
      candidateId = candR.recordset[0].candidate_id;
      await new sql.Request(tx)
        .input('cid', sql.Int, candidateId)
        .input('full_name', sql.NVarChar(120), payload.full_name)
        .input('email', sql.NVarChar(200), payload.email)
        .input('dob', sql.Date, payload.dob)
        .input('education_key', sql.NVarChar(30), payload.education_key || null)
        .input('experience_years', sql.Int, payload.experience_years)
        .input('experience_months', sql.Int, payload.experience_months)
        .input('last_employer', sql.NVarChar(160), payload.last_employer || null)
        .input('referral_code', sql.NVarChar(40), payload.referral_code || null)
        .input('resume_url', sql.NVarChar(500), payload.resume_url || null)
        .input('source_key', sql.NVarChar(30), payload.source_key)
        .query(`
          UPDATE dbo.army_candidates SET
            full_name = @full_name, email = @email, dob = @dob,
            education_key = @education_key, experience_years = @experience_years,
            experience_months = @experience_months, last_employer = @last_employer,
            referral_code = @referral_code, resume_url = @resume_url, source_key = @source_key,
            updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE candidate_id = @cid
        `);
    } else {
      const insCand = await new sql.Request(tx)
        .input('full_name', sql.NVarChar(120), payload.full_name)
        .input('phone', sql.NVarChar(15), payload.phone)
        .input('email', sql.NVarChar(200), payload.email)
        .input('dob', sql.Date, payload.dob)
        .input('education_key', sql.NVarChar(30), payload.education_key || null)
        .input('experience_years', sql.Int, payload.experience_years)
        .input('experience_months', sql.Int, payload.experience_months)
        .input('last_employer', sql.NVarChar(160), payload.last_employer || null)
        .input('referral_code', sql.NVarChar(40), payload.referral_code || null)
        .input('resume_url', sql.NVarChar(500), payload.resume_url || null)
        .input('source_key', sql.NVarChar(30), payload.source_key)
        .query(`
          INSERT INTO dbo.army_candidates (
            full_name, phone, email, dob, education_key, experience_years, experience_months,
            last_employer, referral_code, resume_url, source_key
          )
          OUTPUT INSERTED.candidate_id
          VALUES (
            @full_name, @phone, @email, @dob, @education_key, @experience_years, @experience_months,
            @last_employer, @referral_code, @resume_url, @source_key
          )
        `);
      candidateId = insCand.recordset[0].candidate_id;
    }

    const insApp = await new sql.Request(tx)
      .input('candidate_id', sql.Int, candidateId)
      .input('job_opening_id', sql.Int, job.job_opening_id)
      .input('preferred_store', sql.NVarChar(120), payload.preferred_store || null)
      .input('joining_key', sql.NVarChar(20), payload.joining_availability_key || 'INSTANT')
      .input('notice_days', sql.Int, payload.notice_period_days || null)
      .input('expected_join', sql.Date, payload.expected_join_date || null)
      .query(`
        INSERT INTO dbo.army_applications (
          candidate_id, job_opening_id, preferred_store, status_key,
          joining_availability_key, notice_period_days, expected_join_date
        )
        OUTPUT INSERTED.application_id, INSERTED.applied_at, INSERTED.status_key, INSERTED.updated_at
        VALUES (
          @candidate_id, @job_opening_id, @preferred_store, N'APPLIED',
          @joining_key, @notice_days, @expected_join
        )
      `);

    const appRow = insApp.recordset[0];
    await seedApplicationInterviewsFromJob(tx, appRow.application_id, job.job_opening_id);

    await tx.commit();

    return {
      id: appRow.application_id,
      job_slug: job.slug,
      job_title: job.title,
      store_name: job.store_name,
      full_name: payload.full_name,
      phone: payload.phone,
      email: payload.email,
      dob: payload.dob,
      experience_years: payload.experience_years,
      experience_months: payload.experience_months,
      education_key: payload.education_key,
      last_employer: payload.last_employer || null,
      referral_code: payload.referral_code || null,
      preferred_store: payload.preferred_store || null,
      resume_url: payload.resume_url || null,
      source_key: payload.source_key,
      status_key: appRow.status_key,
      applied_at: formatIstIso(appRow.applied_at),
      updated_at: formatIstIso(appRow.updated_at)
    };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function getLatestApplicationByPhone(phone) {
  if (!(await isHiringTablesReady())) {
    const { getLatestApplicationByPhone: memGet } = require('./armyCareersApplicationStore');
    return memGet(phone);
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('phone', sql.NVarChar(15), phone)
    .query(`
      SELECT TOP 1
        a.application_id AS id,
        j.slug AS job_slug,
        j.title AS job_title,
        j.store_name,
        a.status_key,
        a.applied_at,
        a.updated_at
      FROM dbo.army_applications a
      INNER JOIN dbo.army_candidates c ON c.candidate_id = a.candidate_id
      INNER JOIN dbo.army_job_openings j ON j.job_opening_id = a.job_opening_id
      WHERE c.phone = @phone
      ORDER BY a.applied_at DESC
    `);
  if (!r.recordset.length) return null;
  const row = r.recordset[0];
  return {
    id: row.id,
    job_slug: row.job_slug,
    job_title: row.job_title,
    store_name: row.store_name,
    status_key: row.status_key,
    applied_at: formatIstIso(row.applied_at),
    updated_at: formatIstIso(row.updated_at)
  };
}

function getApplicationPublicView(application) {
  if (!application) return null;
  const status = getArmyApplicationStatusByKey(application.status_key) || {
    key: application.status_key,
    label: application.status_key,
    hint: '',
    badgeClass: 'status-applied'
  };
  return {
    id: application.id,
    job_slug: application.job_slug,
    job_title: application.job_title,
    store_name: application.store_name,
    applied_at: application.applied_at,
    status: {
      key: status.key,
      label: status.label,
      hint: status.hint,
      badge_class: status.badgeClass
    }
  };
}

async function listJobOpeningsAdmin(filters = {}) {
  if (!(await isHiringTablesReady())) {
    return listPublishedArmyCareersJobs(filters).map((job) => ({
      ...job,
      id: job.slug,
      status: 'PUBLISHED',
      published_at: null,
      created_at: null,
      updated_at: null
    }));
  }

  const pool = await getPool();
  const req = pool.request();
  const clauses = ['1=1'];
  if (filters.status) {
    req.input('status', sql.NVarChar(30), filters.status);
    clauses.push('j.status = @status');
  }
  if (filters.department_key) {
    req.input('dept', sql.NVarChar(30), filters.department_key);
    clauses.push('j.department_key = @dept');
  }
  if (filters.q) {
    req.input('q', sql.NVarChar(120), '%' + filters.q + '%');
    clauses.push('(j.title LIKE @q OR j.store_name LIKE @q)');
  }

  const r = await req.query(`
    SELECT j.*,
      (SELECT COUNT(*) FROM dbo.army_applications a WHERE a.job_opening_id = j.job_opening_id) AS application_count
    FROM dbo.army_job_openings j
    WHERE ${clauses.join(' AND ')}
    ORDER BY j.updated_at DESC, j.job_opening_id DESC
  `);

  return r.recordset.map((row) => ({
    ...mapJobRow(row, { includeInternal: true }),
    application_count: row.application_count
  }));
}

const JOB_EDITABLE_STATUSES = ['DRAFT', 'PENDING_APPROVAL'];

function slugifyJobTitle(title, storeName) {
  const raw = [title, storeName].filter(Boolean).join(' ');
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

async function slugExists(slug, excludeJobId) {
  const pool = await getPool();
  const req = pool.request().input('slug', sql.NVarChar(120), slug);
  if (excludeJobId) req.input('excludeId', sql.Int, excludeJobId);
  const r = await req.query(`
    SELECT TOP 1 job_opening_id FROM dbo.army_job_openings
    WHERE slug = @slug ${excludeJobId ? 'AND job_opening_id <> @excludeId' : ''}
  `);
  return r.recordset.length > 0;
}

async function ensureUniqueSlug(baseSlug, excludeJobId) {
  let slug = baseSlug || 'opening';
  if (!(await slugExists(slug, excludeJobId))) return slug.slice(0, 120);
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${baseSlug}-${n}`.slice(0, 120);
    if (!(await slugExists(candidate, excludeJobId))) return candidate;
  }
  const err = new Error('Could not generate a unique slug for this opening.');
  err.statusCode = 409;
  throw err;
}

async function getStoreForHiring(storeId) {
  const pool = await getPool();
  const r = await pool.request()
    .input('storeId', sql.Int, storeId)
    .query(`
      SELECT store_id, store_name, city, status, is_active
      FROM dbo.stores
      WHERE store_id = @storeId
    `);
  if (!r.recordset.length) {
    const err = new Error('Store not found.');
    err.statusCode = 400;
    throw err;
  }
  const row = r.recordset[0];
  if (!row.is_active || String(row.status || '').toUpperCase() !== 'ACTIVE') {
    const err = new Error('Store must be active.');
    err.statusCode = 400;
    throw err;
  }
  return row;
}

async function listHiringStores() {
  try {
    const pool = await getPool();
    const r = await pool.request().query(`
      SELECT store_id, store_name, city
      FROM dbo.stores
      WHERE is_active = 1 AND status = N'ACTIVE'
      ORDER BY store_name
    `);
    return (r.recordset || []).map((row) => ({
      store_id: row.store_id,
      store_name: row.store_name,
      city: row.city || null
    }));
  } catch (_) {
    return [];
  }
}

function normalizeRequirements(requirements) {
  if (!requirements) return [];
  if (Array.isArray(requirements)) {
    return requirements.map((line) => String(line || '').trim()).filter(Boolean);
  }
  return String(requirements)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function getJobOpeningAdminById(jobId) {
  if (!(await isHiringTablesReady())) {
    const err = new Error('Job opening not found.');
    err.statusCode = 404;
    throw err;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, jobId)
    .query(`
      SELECT j.*,
        (SELECT COUNT(*) FROM dbo.army_applications a WHERE a.job_opening_id = j.job_opening_id) AS application_count,
        t.name AS interview_template_name
      FROM dbo.army_job_openings j
      LEFT JOIN dbo.army_interview_templates t ON t.interview_template_id = j.interview_template_id
      WHERE j.job_opening_id = @id
    `);
  if (!r.recordset.length) {
    const err = new Error('Job opening not found.');
    err.statusCode = 404;
    throw err;
  }
  const row = r.recordset[0];
  return {
    ...mapJobRow(row, { includeInternal: true }),
    store_id: row.store_id,
    application_count: row.application_count,
    interview_template_id: row.interview_template_id || null,
    interview_template_name: row.interview_template_name || null
  };
}

async function createJobOpening(payload, userId) {
  if (!(await isHiringTablesReady())) {
    const err = new Error('Hiring tables not deployed. Run migration 78.');
    err.statusCode = 503;
    throw err;
  }

  if (!isAllowedArmyDepartmentKey(payload.department_key)) {
    const err = new Error('Invalid department.');
    err.statusCode = 400;
    throw err;
  }
  if (!isAllowedArmyEmploymentTypeKey(payload.employment_type)) {
    const err = new Error('Invalid employment type.');
    err.statusCode = 400;
    throw err;
  }

  const store = await getStoreForHiring(payload.store_id);
  const employment = getArmyEmploymentTypeByKey(payload.employment_type);
  const requirements = normalizeRequirements(payload.requirements);
  const slug = await ensureUniqueSlug(slugifyJobTitle(payload.title, store.store_name));

  let interviewTemplateId = payload.interview_template_id || null;
  if (interviewTemplateId) {
    await assertTemplateExists(interviewTemplateId, { activeOnly: true });
  } else {
    interviewTemplateId = null;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('slug', sql.NVarChar(120), slug)
    .input('title', sql.NVarChar(200), payload.title.trim())
    .input('department_key', sql.NVarChar(30), String(payload.department_key).trim().toUpperCase())
    .input('store_id', sql.Int, store.store_id)
    .input('store_name', sql.NVarChar(120), store.store_name)
    .input('employment_type', sql.NVarChar(30), employment.key)
    .input('employment_type_label', sql.NVarChar(60), employment.label)
    .input('vacancies', sql.Int, payload.vacancies)
    .input('location', sql.NVarChar(200), payload.location || null)
    .input('about_text', sql.NVarChar(sql.MAX), payload.about_text || null)
    .input('requirements_json', sql.NVarChar(sql.MAX), requirements.length ? JSON.stringify(requirements) : null)
    .input('apply_by', sql.Date, payload.apply_by || null)
    .input('interview_template_id', sql.Int, interviewTemplateId)
    .input('userId', sql.Int, userId || null)
    .query(`
      INSERT INTO dbo.army_job_openings (
        slug, title, department_key, store_id, store_name,
        employment_type, employment_type_label, vacancies, location,
        about_text, requirements_json, apply_by, interview_template_id, status, created_by,
        created_at, updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @slug, @title, @department_key, @store_id, @store_name,
        @employment_type, @employment_type_label, @vacancies, @location,
        @about_text, @requirements_json, @apply_by, @interview_template_id, N'DRAFT', @userId,
        DATEADD(MINUTE, 330, SYSUTCDATETIME()),
        DATEADD(MINUTE, 330, SYSUTCDATETIME())
      )
    `);

  return mapJobRow(r.recordset[0], { includeInternal: true });
}

async function updateJobOpening(jobId, payload) {
  if (!(await isHiringTablesReady())) {
    const err = new Error('Hiring tables not deployed. Run migration 78.');
    err.statusCode = 503;
    throw err;
  }

  const existing = await getJobOpeningAdminById(jobId);
  if (!JOB_EDITABLE_STATUSES.includes(existing.status)) {
    const err = new Error('Only draft or pending-approval openings can be edited.');
    err.statusCode = 400;
    throw err;
  }

  if (!isAllowedArmyDepartmentKey(payload.department_key)) {
    const err = new Error('Invalid department.');
    err.statusCode = 400;
    throw err;
  }
  if (!isAllowedArmyEmploymentTypeKey(payload.employment_type)) {
    const err = new Error('Invalid employment type.');
    err.statusCode = 400;
    throw err;
  }

  const store = await getStoreForHiring(payload.store_id);
  const employment = getArmyEmploymentTypeByKey(payload.employment_type);
  const requirements = normalizeRequirements(payload.requirements);
  const slug = await ensureUniqueSlug(
    slugifyJobTitle(payload.title, store.store_name),
    jobId
  );

  let interviewTemplateId = payload.interview_template_id || null;
  if (interviewTemplateId) {
    await assertTemplateExists(interviewTemplateId, { activeOnly: true });
  } else {
    interviewTemplateId = null;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, jobId)
    .input('slug', sql.NVarChar(120), slug)
    .input('title', sql.NVarChar(200), payload.title.trim())
    .input('department_key', sql.NVarChar(30), String(payload.department_key).trim().toUpperCase())
    .input('store_id', sql.Int, store.store_id)
    .input('store_name', sql.NVarChar(120), store.store_name)
    .input('employment_type', sql.NVarChar(30), employment.key)
    .input('employment_type_label', sql.NVarChar(60), employment.label)
    .input('vacancies', sql.Int, payload.vacancies)
    .input('location', sql.NVarChar(200), payload.location || null)
    .input('about_text', sql.NVarChar(sql.MAX), payload.about_text || null)
    .input('requirements_json', sql.NVarChar(sql.MAX), requirements.length ? JSON.stringify(requirements) : null)
    .input('apply_by', sql.Date, payload.apply_by || null)
    .input('interview_template_id', sql.Int, interviewTemplateId)
    .query(`
      UPDATE dbo.army_job_openings SET
        slug = @slug,
        title = @title,
        department_key = @department_key,
        store_id = @store_id,
        store_name = @store_name,
        employment_type = @employment_type,
        employment_type_label = @employment_type_label,
        vacancies = @vacancies,
        location = @location,
        about_text = @about_text,
        requirements_json = @requirements_json,
        apply_by = @apply_by,
        interview_template_id = @interview_template_id,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      OUTPUT INSERTED.*
      WHERE job_opening_id = @id
        AND status IN (N'DRAFT', N'PENDING_APPROVAL')
    `);

  if (!r.recordset.length) {
    const err = new Error('Job opening not found or not editable.');
    err.statusCode = 404;
    throw err;
  }

  return mapJobRow(r.recordset[0], { includeInternal: true });
}

async function updateJobOpeningStatus(jobId, statusKey, userId) {
  if (!(await isHiringTablesReady())) {
    const err = new Error('Hiring tables not deployed. Run migration 78.');
    err.statusCode = 503;
    throw err;
  }

  const pool = await getPool();
  const publishedAt = statusKey === 'PUBLISHED' ? new Date() : null;
  const r = await pool.request()
    .input('id', sql.Int, jobId)
    .input('status', sql.NVarChar(30), statusKey)
    .input('userId', sql.Int, userId || null)
    .input('publishedAt', sql.DateTime2(0), publishedAt)
    .query(`
      UPDATE dbo.army_job_openings SET
        status = @status,
        published_at = CASE WHEN @status = N'PUBLISHED' THEN COALESCE(published_at, DATEADD(MINUTE, 330, SYSUTCDATETIME())) ELSE published_at END,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      OUTPUT INSERTED.*
      WHERE job_opening_id = @id
    `);
  if (!r.recordset.length) {
    const err = new Error('Job opening not found.');
    err.statusCode = 404;
    throw err;
  }
  return mapJobRow(r.recordset[0], { includeInternal: true });
}

async function listApplicationsAdmin(filters = {}) {
  if (!(await isHiringTablesReady())) {
    const { getLatestApplicationByPhone } = require('./armyCareersApplicationStore');
    return [];
  }

  const pool = await getPool();
  const req = pool.request();
  const clauses = ['1=1'];
  if (filters.status_key) {
    req.input('status', sql.NVarChar(30), filters.status_key);
    clauses.push('a.status_key = @status');
  }
  if (filters.job_opening_id) {
    req.input('jobId', sql.Int, filters.job_opening_id);
    clauses.push('a.job_opening_id = @jobId');
  }
  if (filters.q) {
    req.input('q', sql.NVarChar(120), '%' + filters.q + '%');
    clauses.push('(c.full_name LIKE @q OR c.phone LIKE @q OR c.email LIKE @q OR j.title LIKE @q)');
  }

  const r = await req.query(`
    SELECT
      a.application_id AS id,
      a.status_key,
      a.applied_at,
      a.updated_at,
      a.preferred_store,
      c.candidate_id,
      c.full_name,
      c.phone,
      c.email,
      j.job_opening_id,
      j.title AS job_title,
      j.store_name,
      j.department_key
    FROM dbo.army_applications a
    INNER JOIN dbo.army_candidates c ON c.candidate_id = a.candidate_id
    INNER JOIN dbo.army_job_openings j ON j.job_opening_id = a.job_opening_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY a.applied_at DESC
  `);

  return r.recordset.map((row) => ({
    id: row.id,
    status_key: row.status_key,
    applied_at: formatIstIso(row.applied_at),
    updated_at: formatIstIso(row.updated_at),
    preferred_store: row.preferred_store,
    candidate: {
      id: row.candidate_id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email
    },
    job: {
      id: row.job_opening_id,
      title: row.job_title,
      store_name: row.store_name,
      department_key: row.department_key
    }
  }));
}

const ARMY_RESUME_DIR = path.join(__dirname, '..', 'public', 'uploads', 'army-careers', 'resumes');

function slugifyDownloadName(value) {
  return String(value || 'candidate')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'candidate';
}

async function getApplicationResumeFile(applicationId) {
  const application = await getApplicationAdminById(applicationId);
  const resumeUrl = application.candidate && application.candidate.resume_url;
  if (!resumeUrl) return null;

  const filename = path.basename(String(resumeUrl));
  if (!filename || filename.includes('..')) return null;

  const absolutePath = path.join(ARMY_RESUME_DIR, filename);
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(ARMY_RESUME_DIR) + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;

  const ext = path.extname(filename) || '.pdf';
  const downloadName = slugifyDownloadName(application.candidate.full_name) + '-cv' + ext.toLowerCase();
  return { absolutePath: resolved, downloadName };
}

async function getApplicationAdminById(applicationId) {
  if (!(await isHiringTablesReady())) {
    const err = new Error('Application not found.');
    err.statusCode = 404;
    throw err;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, applicationId)
    .query(`
      SELECT
        a.application_id AS id,
        a.status_key,
        a.applied_at,
        a.updated_at,
        a.preferred_store,
        a.joining_availability_key,
        a.notice_period_days,
        a.expected_join_date,
        c.candidate_id,
        c.full_name,
        c.phone,
        c.email,
        c.dob,
        c.education_key,
        c.experience_years,
        c.experience_months,
        c.last_employer,
        c.referral_code,
        c.resume_url,
        c.source_key,
        j.job_opening_id,
        j.slug AS job_slug,
        j.title AS job_title,
        j.store_name,
        j.department_key
      FROM dbo.army_applications a
      INNER JOIN dbo.army_candidates c ON c.candidate_id = a.candidate_id
      INNER JOIN dbo.army_job_openings j ON j.job_opening_id = a.job_opening_id
      WHERE a.application_id = @id
    `);
  if (!r.recordset.length) {
    const err = new Error('Application not found.');
    err.statusCode = 404;
    throw err;
  }
  const row = r.recordset[0];
  const status = getArmyApplicationStatusByKey(row.status_key);
  const joiningMeta = getArmyJoiningAvailabilityByKey(row.joining_availability_key);
  return {
    id: row.id,
    status_key: row.status_key,
    status: status ? { key: status.key, label: status.label, badge_class: status.badgeClass } : null,
    applied_at: formatIstIso(row.applied_at),
    updated_at: formatIstIso(row.updated_at),
    preferred_store: row.preferred_store,
    joining: {
      key: row.joining_availability_key || 'INSTANT',
      label: joiningMeta ? joiningMeta.label : row.joining_availability_key,
      notice_period_days: row.notice_period_days,
      expected_join_date: formatDateOnly(row.expected_join_date)
    },
    candidate: {
      id: row.candidate_id,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      dob: formatDateOnly(row.dob),
      education_key: row.education_key,
      experience_years: row.experience_years,
      experience_months: row.experience_months,
      last_employer: row.last_employer,
      referral_code: row.referral_code,
      resume_url: row.resume_url,
      source_key: row.source_key
    },
    job: {
      id: row.job_opening_id,
      slug: row.job_slug,
      title: row.job_title,
      store_name: row.store_name,
      department_key: row.department_key
    }
  };
}

async function updateApplicationStatus(applicationId, statusKey) {
  if (!(await isHiringTablesReady())) {
    const err = new Error('Hiring tables not deployed. Run migration 78.');
    err.statusCode = 503;
    throw err;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, applicationId)
    .input('status', sql.NVarChar(30), statusKey)
    .query(`
      UPDATE dbo.army_applications SET
        status_key = @status,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      OUTPUT INSERTED.application_id
      WHERE application_id = @id
    `);
  if (!r.recordset.length) {
    const err = new Error('Application not found.');
    err.statusCode = 404;
    throw err;
  }

  if (statusKey === 'NOT_SELECTED') {
    // Phase 1 stub — wire WhatsApp/SMS provider in a later sprint
    // eslint-disable-next-line no-console
    console.info('[army-hiring] rejection notification queued for application', applicationId);
  }

  return getApplicationAdminById(applicationId);
}

async function getHiringDashboardStats() {
  if (!(await isHiringTablesReady())) {
    const jobs = listPublishedArmyCareersJobs({});
    return {
      published_jobs: jobs.length,
      total_applications: 0,
      screening: 0,
      interview: 0,
      db_ready: false
    };
  }

  const pool = await getPool();
  const r = await pool.request().query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.army_job_openings WHERE status = N'PUBLISHED') AS published_jobs,
      (SELECT COUNT(*) FROM dbo.army_applications) AS total_applications,
      (SELECT COUNT(*) FROM dbo.army_applications WHERE status_key = N'SCREENING') AS screening,
      (SELECT COUNT(*) FROM dbo.army_applications WHERE status_key = N'INTERVIEW') AS interview
  `);
  const row = r.recordset[0];
  return {
    published_jobs: row.published_jobs,
    total_applications: row.total_applications,
    screening: row.screening,
    interview: row.interview,
    db_ready: true
  };
}

module.exports = {
  isHiringTablesReady,
  listPublishedJobs,
  getPublishedJobBySlug,
  createApplication,
  getLatestApplicationByPhone,
  getApplicationPublicView,
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
  getArmyJobOpeningStatusByKey
};
