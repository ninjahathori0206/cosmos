'use strict';

const crypto = require('crypto');
const { getPublishedArmyCareersJobBySlug } = require('../config/armyCareersSeed');
const { getArmyApplicationStatusByKey } = require('../config/armyApplicationStatusCatalog');
const { wallClockIso } = require('../lib/cosmosIst');

const applications = [];

function istNowIso() {
  return wallClockIso();
}

function createApplication(payload) {
  const job = getPublishedArmyCareersJobBySlug(payload.job_slug);
  if (!job) {
    const err = new Error('Job opening not found or no longer published.');
    err.statusCode = 404;
    throw err;
  }

  const duplicate = applications.find(
    (row) => row.phone === payload.phone && row.job_slug === payload.job_slug && row.status_key !== 'NOT_SELECTED'
  );
  if (duplicate) {
    const err = new Error('You have already applied for this role with this number.');
    err.statusCode = 409;
    throw err;
  }

  const application = {
    id: crypto.randomUUID(),
    job_slug: payload.job_slug,
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
    joining_availability_key: payload.joining_availability_key || 'INSTANT',
    notice_period_days: payload.notice_period_days || null,
    expected_join_date: payload.expected_join_date || null,
    status_key: 'APPLIED',
    applied_at: istNowIso(),
    updated_at: istNowIso()
  };

  applications.unshift(application);
  return application;
}

function getLatestApplicationByPhone(phone) {
  return applications.find((row) => row.phone === phone) || null;
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

module.exports = {
  createApplication,
  getLatestApplicationByPhone,
  getApplicationPublicView
};
