/**
 * Army HR hiring loop — smoke test (public + optional authenticated).
 *
 * Usage:
 *   node scripts/smoke-army-hiring-e2e.js
 *
 * Optional .env for full HR checks:
 *   ARMY_SMOKE_USER, ARMY_SMOKE_PASS — HR login (needs army.hiring permissions)
 *
 * Requires: server running (npm start), API_KEY in .env
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const port = Number(process.env.PORT || 4000);
const base = 'http://127.0.0.1:' + port;
const apiKey = process.env.API_KEY;

const failures = [];
const passes = [];

function pass(msg) {
  passes.push(msg);
  console.log('  OK  ' + msg);
}

function fail(msg) {
  failures.push(msg);
  console.error(' FAIL ' + msg);
}

async function request(method, urlPath, options) {
  const opts = options || {};
  const headers = Object.assign({ 'X-API-Key': apiKey || '' }, opts.headers || {});
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(base + urlPath, {
    method,
    headers,
    body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined)
  });
  let data = {};
  const text = await res.text();
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  return { status: res.status, data, ok: res.ok };
}

async function login(username, password) {
  const res = await request('POST', '/api/auth/login', {
    headers: { 'X-API-Key': apiKey },
    body: { username, password }
  });
  if (!res.ok || !res.data.token) {
    throw new Error((res.data && res.data.message) || 'Login failed');
  }
  return res.data.token;
}

async function checkPublicCareers() {
  console.log('\n[1] Public careers portal');
  const jobs = await request('GET', '/api/army/careers/jobs');
  if (!jobs.ok) {
    fail('GET /api/army/careers/jobs → HTTP ' + jobs.status);
    return null;
  }
  const list = (jobs.data && jobs.data.data && jobs.data.data.jobs) || [];
  pass('GET /api/army/careers/jobs → ' + list.length + ' published job(s)');
  return list;
}

async function checkHrMeta(token) {
  console.log('\n[2] HR admin meta');
  const res = await request('GET', '/api/army/hr/meta/statuses', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) {
    fail('GET /api/army/hr/meta/statuses → HTTP ' + res.status);
    return null;
  }
  const data = res.data.data || {};
  if (data.db_ready) pass('Hiring DB tables deployed (db_ready=true)');
  else fail('Hiring DB not ready — run npm run migrate:78-army-hiring-pipeline (+ 79 for joining fields)');

  const stores = data.stores || [];
  if (stores.length) pass('Hiring stores available: ' + stores.length);
  else fail('No active stores for job opening form');

  return data;
}

async function checkHrLists(token) {
  console.log('\n[3] HR job openings + pipeline');
  const jobsRes = await request('GET', '/api/army/hr/job-openings', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!jobsRes.ok) {
    fail('GET /api/army/hr/job-openings → HTTP ' + jobsRes.status);
  } else {
    const jobs = (jobsRes.data.data && jobsRes.data.data.jobs) || [];
    pass('GET /api/army/hr/job-openings → ' + jobs.length + ' opening(s)');
  }

  const appsRes = await request('GET', '/api/army/hr/applications', {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!appsRes.ok) {
    fail('GET /api/army/hr/applications → HTTP ' + appsRes.status);
    return;
  }
  const apps = (appsRes.data.data && appsRes.data.data.applications) || [];
  pass('GET /api/army/hr/applications → ' + apps.length + ' application(s)');

  if (apps.length) {
    const detail = await request('GET', '/api/army/hr/applications/' + apps[0].id, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (detail.ok) pass('GET /api/army/hr/applications/:id → candidate detail loads');
    else fail('GET /api/army/hr/applications/:id → HTTP ' + detail.status);
  }
}

async function optionalApplySmoke(publishedJobs) {
  if (process.env.ARMY_SMOKE_APPLY !== '1') {
    console.log('\n[4] Apply flow — skipped (set ARMY_SMOKE_APPLY=1 to run OTP + submit test)');
    return;
  }

  console.log('\n[4] Apply flow (OTP + application)');
  if (!publishedJobs || !publishedJobs.length) {
    fail('No published job to apply to — publish a job in HR admin first');
    return;
  }

  const job = publishedJobs[0];
  const phone = String(process.env.ARMY_SMOKE_PHONE || '9876543210').replace(/\D/g, '').slice(-10);
  if (phone.length !== 10) {
    fail('ARMY_SMOKE_PHONE must be 10 digits');
    return;
  }

  const otpSend = await request('POST', '/api/army/careers/otp/send', { body: { phone } });
  if (!otpSend.ok) {
    fail('OTP send → HTTP ' + otpSend.status + ': ' + ((otpSend.data && otpSend.data.message) || ''));
    return;
  }
  const otpCode = (otpSend.data.data && otpSend.data.data.dev_otp) || process.env.ARMY_SMOKE_OTP;
  if (!otpCode) {
    fail('No dev_otp in response — check server logs or set ARMY_SMOKE_OTP');
    return;
  }
  pass('OTP sent (dev mode)');

  const otpVerify = await request('POST', '/api/army/careers/otp/verify', {
    body: { phone, otp_code: String(otpCode) }
  });
  if (!otpVerify.ok || !(otpVerify.data.data && otpVerify.data.data.verification_token)) {
    fail('OTP verify failed');
    return;
  }
  const verificationToken = otpVerify.data.data.verification_token;
  pass('OTP verified');

  const resumePath = path.join(__dirname, '_smoke-army-resume.pdf');
  if (!fs.existsSync(resumePath)) {
    fs.writeFileSync(resumePath, '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 1\ntrailer\n<< /Root 1 0 R >>\nstartxref\n0\n%%EOF\n');
  }

  const form = new FormData();
  form.append('job_slug', job.slug);
  form.append('full_name', 'Smoke Test Candidate');
  form.append('phone', phone);
  form.append('email', 'smoke.test+' + Date.now() + '@example.com');
  form.append('dob', '1995-06-15');
  form.append('experience_years', '2');
  form.append('experience_months', '0');
  form.append('education_key', 'GRADUATE');
  form.append('joining_availability_key', 'INSTANT');
  form.append('preferred_store', '');
  form.append('source', 'DIRECT');
  form.append('resume', new Blob([fs.readFileSync(resumePath)], { type: 'application/pdf' }), 'smoke-cv.pdf');

  const applyRes = await fetch(base + '/api/army/careers/applications', {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey || '',
      'X-Army-Verification-Token': verificationToken
    },
    body: form
  });
  let applyData = {};
  try { applyData = await applyRes.json(); } catch (_) { /* ignore */ }
  if (!applyRes.ok) {
    fail('POST /api/army/careers/applications → HTTP ' + applyRes.status + ': ' + (applyData.message || ''));
    return;
  }
  pass('Application submitted for job "' + job.title + '"');

  const user = process.env.ARMY_SMOKE_USER;
  const passWord = process.env.ARMY_SMOKE_PASS;
  if (user && passWord) {
    const token = await login(user, passWord);
    const appsRes = await request('GET', '/api/army/hr/applications?q=Smoke%20Test', {
      headers: { Authorization: 'Bearer ' + token }
    });
    const apps = (appsRes.data.data && appsRes.data.data.applications) || [];
    if (apps.length) pass('Application visible in HR pipeline search');
    else fail('Application not found in HR pipeline after submit');
  }
}

async function main() {
  console.log('Army hiring smoke test → ' + base);

  if (!apiKey) {
    console.error('Missing API_KEY in .env');
    process.exit(1);
  }

  const publishedJobs = await checkPublicCareers();

  const user = process.env.ARMY_SMOKE_USER;
  const passWord = process.env.ARMY_SMOKE_PASS;
  if (user && passWord) {
    try {
      const token = await login(user, passWord);
      pass('Login as ' + user);
      const meta = await checkHrMeta(token);
      if (meta && meta.db_ready) await checkHrLists(token);
    } catch (err) {
      fail('HR login/checks: ' + err.message);
    }
  } else {
    console.log('\n[2–3] HR admin checks — skipped (set ARMY_SMOKE_USER + ARMY_SMOKE_PASS in .env)');
  }

  await optionalApplySmoke(publishedJobs);

  console.log('\n--- Summary ---');
  console.log('Passed: ' + passes.length);
  if (failures.length) {
    console.error('Failed: ' + failures.length);
    failures.forEach(function (f) { console.error('  • ' + f); });
    process.exit(1);
  }
  console.log('All checks passed.');
}

main().catch(function (err) {
  console.error('Smoke test crashed:', err.message || err);
  process.exit(1);
});
