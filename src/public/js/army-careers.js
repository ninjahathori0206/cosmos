(function () {
  'use strict';

  var state = {
    departments: [],
    educationLevels: [],
    storeOptions: [],
    jobs: [],
    activeDept: '',
    searchQuery: '',
    searchTimer: null,
    currentSlug: '',
    currentJob: null,
    applySlug: '',
    applyJob: null,
    applyStep: 1,
    applySubmitted: false,
    verificationToken: '',
    verifiedPhone: '',
    sourceKey: 'DIRECT',
    joiningOptions: []
  };

  var els = {};

  function cacheElements() {
    els.screenHome = document.getElementById('screen-careers-home');
    els.screenDetail = document.getElementById('screen-careers-detail');
    els.screenApply = document.getElementById('screen-careers-apply');
    els.screenStatus = document.getElementById('screen-careers-status');
    els.search = document.getElementById('careers-search');
    els.chips = document.getElementById('careers-chips');
    els.count = document.getElementById('careers-count');
    els.jobs = document.getElementById('careers-jobs');
    els.trackBtn = document.getElementById('careers-track-btn');
    els.backBtn = document.getElementById('careers-back-btn');
    els.detailTitle = document.getElementById('careers-detail-title');
    els.detailContent = document.getElementById('careers-detail-content');
    els.detailApply = document.getElementById('careers-detail-apply');
    els.applyBack = document.getElementById('careers-apply-back');
    els.applyTitle = document.getElementById('careers-apply-title');
    els.applyContent = document.getElementById('careers-apply-content');
    els.applyError = document.getElementById('careers-apply-error');
    els.applyJobSummary = document.getElementById('careers-apply-job-summary');
    els.applyPhone = document.getElementById('apply-phone');
    els.applySendOtp = document.getElementById('apply-send-otp');
    els.applyOtpWrap = document.getElementById('apply-otp-verify-wrap');
    els.applyOtp = document.getElementById('apply-otp');
    els.applyVerifyOtp = document.getElementById('apply-verify-otp');
    els.applyVerifiedBadge = document.getElementById('apply-verified-badge');
    els.applyForm = document.getElementById('careers-apply-form');
    els.applyEducation = document.getElementById('apply-education');
    els.applyPreferredStore = document.getElementById('apply-preferred-store');
    els.applyBottom = document.getElementById('careers-apply-bottom');
    els.applySuccess = document.getElementById('careers-apply-success');
    els.applySuccessStatus = document.getElementById('careers-apply-success-status');
    els.applyStepLabel = document.getElementById('careers-apply-step-label');
    els.applyProgressFill = document.getElementById('careers-apply-progress-fill');
    els.applyProgressBar = document.getElementById('careers-apply-progress-bar');
    els.applyWizardBack = document.getElementById('apply-wizard-back');
    els.applyWizardForward = document.getElementById('apply-wizard-forward');
    els.applyNoticeFields = document.getElementById('apply-notice-fields');
    els.applyResume = document.getElementById('apply-resume');
    els.applyResumeDrop = document.getElementById('apply-resume-drop');
    els.applyResumeLabel = document.getElementById('apply-resume-label');
    els.applyReviewSummary = document.getElementById('apply-review-summary');
    els.applyReviewBody = document.getElementById('apply-review-body');
    els.applyProgressWrap = document.getElementById('careers-apply-progress');
    els.statusBack = document.getElementById('careers-status-back');
    els.statusPhone = document.getElementById('status-phone');
    els.statusSendOtp = document.getElementById('status-send-otp');
    els.statusOtpWrap = document.getElementById('status-otp-verify-wrap');
    els.statusOtp = document.getElementById('status-otp');
    els.statusVerifyOtp = document.getElementById('status-verify-otp');
    els.statusResult = document.getElementById('careers-status-result');
  }

  function istFormatDate(isoDate) {
    if (!isoDate) return '—';
    var raw = String(isoDate);
    var datePart = raw.indexOf('T') >= 0 ? raw.split('T')[0] : raw.split(' ')[0];
    var parts = datePart.split('-');
    if (parts.length !== 3) return raw;
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return Number(parts[2]) + ' ' + (months[Number(parts[1]) - 1] || parts[1]) + ' ' + parts[0];
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function apiRequest(url, options) {
    return fetch(url, options || {}).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok || !body || body.success !== true) {
          throw new Error(body && body.message ? body.message : 'Request failed.');
        }
        return body.data;
      });
    });
  }

  function apiGet(url) {
    return apiRequest(url, { headers: { Accept: 'application/json' } });
  }

  function apiPost(url, payload) {
    return apiRequest(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    });
  }

  function parseCareersPath() {
    var path = window.location.pathname.replace(/\/+$/, '');
    var prefix = '/army/careers';
    if (path === prefix) return { screen: 'home' };
    if (path === prefix + '/status') return { screen: 'status' };
    if (path.indexOf(prefix + '/') !== 0) return { screen: 'home' };
    var rest = decodeURIComponent(path.slice(prefix.length + 1)).trim();
    var parts = rest.split('/').filter(Boolean);
    if (parts.length === 2 && parts[1] === 'apply') return { screen: 'apply', slug: parts[0].toLowerCase() };
    if (parts.length === 1) return { screen: 'detail', slug: parts[0].toLowerCase() };
    return { screen: 'home' };
  }

  function showScreen(name) {
    if (els.screenHome) els.screenHome.classList.toggle('active', name === 'home');
    if (els.screenDetail) els.screenDetail.classList.toggle('active', name === 'detail');
    if (els.screenApply) els.screenApply.classList.toggle('active', name === 'apply');
    if (els.screenStatus) els.screenStatus.classList.toggle('active', name === 'status');
  }

  function navigate(path, replace, histState) {
    if (replace) window.history.replaceState(histState || {}, '', path);
    else window.history.pushState(histState || {}, '', path);
  }

  function navigateHome(replace) {
    navigate('/army/careers', replace, { screen: 'home' });
    state.currentSlug = '';
    state.currentJob = null;
    showScreen('home');
    document.title = 'Eyewoot Careers';
  }

  function navigateDetail(slug, replace) {
    navigate('/army/careers/' + encodeURIComponent(slug), replace, { screen: 'detail', slug: slug });
    state.currentSlug = slug;
    showScreen('detail');
    loadJobDetail(slug);
  }

  function navigateApply(slug, replace) {
    navigate('/army/careers/' + encodeURIComponent(slug) + '/apply', replace, { screen: 'apply', slug: slug });
    state.applySlug = slug;
    showScreen('apply');
    loadApplyScreen(slug);
  }

  function navigateStatus(replace) {
    navigate('/army/careers/status', replace, { screen: 'status' });
    showScreen('status');
    document.title = 'Track Application · Eyewoot Careers';
    resetStatusScreen();
  }

  function readSourceFromQuery() {
    var params = new URLSearchParams(window.location.search);
    var source = (params.get('source') || 'direct').toUpperCase().replace(/-/g, '_');
    state.sourceKey = source;
  }

  function renderSkeletonCards(count) {
    if (!els.jobs) return;
    var html = '';
    for (var i = 0; i < count; i += 1) {
      html += '<div class="army-job-card" aria-hidden="true">' +
        '<span class="skel skel-title"></span>' +
        '<span class="skel skel-text"></span>' +
        '<span class="skel skel-text-sm"></span>' +
        '<span class="skel skel-btn"></span></div>';
    }
    els.jobs.innerHTML = html;
  }

  function renderCountSkeleton() {
    if (!els.count) return;
    els.count.innerHTML = '<span class="skel skel-text" style="width:128px;height:13px;display:block"></span>';
  }

  function renderChips() {
    if (!els.chips) return;
    var chips = [{ key: '', label: 'All' }];
    state.departments.forEach(function (dept) {
      chips.push({ key: dept.key, label: dept.filterLabel || dept.label });
    });
    els.chips.innerHTML = chips.map(function (chip) {
      var active = state.activeDept === chip.key;
      return '<button type="button" class="army-chip' + (active ? ' active' : '') + '" data-dept="' + escapeHtml(chip.key) + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '">' + escapeHtml(chip.label) + '</button>';
    }).join('');
    els.chips.querySelectorAll('.army-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.activeDept = btn.getAttribute('data-dept') || '';
        renderChips();
        loadJobs();
      });
    });
  }

  function renderJobs() {
    if (!els.jobs || !els.count) return;
    if (!state.jobs.length) {
      els.count.textContent = '0 open positions';
      els.jobs.innerHTML = '<div class="army-empty"><div class="army-empty-title">No openings match your search</div><div class="army-empty-sub">Try another department or clear your search.</div></div>';
      return;
    }
    els.count.textContent = state.jobs.length + ' open position' + (state.jobs.length === 1 ? '' : 's');
    els.jobs.innerHTML = state.jobs.map(function (job) {
      var dept = job.department || {};
      return (
        '<article class="army-job-card" data-slug="' + escapeHtml(job.slug) + '">' +
        '<div class="army-job-card-head"><h2 class="army-job-title">' + escapeHtml(job.title) + '</h2>' +
        '<span class="army-dept-badge ' + escapeHtml(dept.badgeClass || 'dept-hq') + '">' + escapeHtml(dept.label || '') + '</span></div>' +
        '<div class="army-job-meta">' + escapeHtml(job.store_name) + ' · ' + escapeHtml(job.employment_type_label) + '</div>' +
        '<div class="army-job-deadline">Apply by ' + escapeHtml(istFormatDate(job.apply_by)) + '</div>' +
        '<button type="button" class="btn primary army-btn-primary army-job-apply" data-slug="' + escapeHtml(job.slug) + '">Apply Now</button>' +
        '</article>'
      );
    }).join('');
    els.jobs.querySelectorAll('.army-job-apply').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        navigateApply(btn.getAttribute('data-slug') || '');
      });
    });
    els.jobs.querySelectorAll('.army-job-card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.army-job-apply')) return;
        navigateDetail(card.getAttribute('data-slug') || '');
      });
    });
  }

  function loadJobs() {
    renderSkeletonCards(3);
    renderCountSkeleton();
    var params = new URLSearchParams();
    if (state.activeDept) params.set('department_key', state.activeDept);
    if (state.searchQuery) params.set('q', state.searchQuery);
    var qs = params.toString();
    apiGet('/api/army/careers/jobs' + (qs ? '?' + qs : ''))
      .then(function (data) {
        state.jobs = (data && data.jobs) || [];
        renderJobs();
      })
      .catch(function (err) {
        if (els.jobs) {
          els.jobs.innerHTML = '<div class="army-empty"><div class="army-empty-title">Could not load openings</div><div class="army-empty-sub">' + escapeHtml(err.message) + '</div></div>';
        }
        if (els.count) els.count.textContent = '—';
        if (window.cosmosToastError) window.cosmosToastError(err.message);
      });
  }

  function detailRow(label, value) {
    return '<div class="army-detail-row"><span class="army-detail-label">' + escapeHtml(label) + '</span><span class="army-detail-value">' + escapeHtml(value || '—') + '</span></div>';
  }

  function renderDetailSkeleton() {
    if (!els.detailContent) return;
    els.detailContent.innerHTML =
      '<div class="army-detail-card army-detail-skel" aria-hidden="true">' +
      '<span class="skel skel-title"></span>' +
      '<span class="skel skel-text"></span>' +
      '<span class="skel skel-row"></span>' +
      '<span class="skel skel-row"></span>' +
      '<span class="skel skel-row"></span></div>' +
      '<div class="army-detail-card army-detail-skel" aria-hidden="true">' +
      '<span class="skel skel-title"></span>' +
      '<span class="skel skel-text"></span></div>';
  }

  function renderJobDetail(job) {
    if (!els.detailContent || !els.detailTitle) return;
    state.currentJob = job;
    els.detailTitle.textContent = job.title;
    document.title = job.title + ' · Eyewoot Careers';
    var dept = job.department || {};
    var requirements = Array.isArray(job.requirements) ? job.requirements : [];
    els.detailContent.innerHTML =
      '<div class="army-detail-card"><div class="army-detail-badge-row"><span class="army-dept-badge ' + escapeHtml(dept.badgeClass || 'dept-hq') + '">' + escapeHtml(dept.label || '') + '</span><span class="army-detail-vacancies">' + escapeHtml(String(job.vacancies)) + ' vacancies</span></div>' +
      detailRow('Store', job.store_name) + detailRow('Type', job.employment_type_label) + detailRow('Apply by', istFormatDate(job.apply_by)) + detailRow('Location', job.location) + '</div>' +
      '<div class="army-detail-card"><h2 class="army-section-title">About the role</h2><p class="army-section-body">' + escapeHtml(job.about) + '</p></div>' +
      '<div class="army-detail-card"><h2 class="army-section-title">What we look for</h2><ul class="army-bullets">' + requirements.map(function (i) { return '<li>' + escapeHtml(i) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="army-note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span>We will contact you on WhatsApp after you submit.</span></div>';
  }

  function loadJobDetail(slug) {
    renderDetailSkeleton();
    apiGet('/api/army/careers/jobs/' + encodeURIComponent(slug))
      .then(renderJobDetail)
      .catch(function (err) {
        if (els.detailContent) {
          els.detailContent.innerHTML = '<div class="army-empty"><div class="army-empty-title">Job not found</div><div class="army-empty-sub">' + escapeHtml(err.message) + '</div></div>';
        }
        if (window.cosmosToastError) window.cosmosToastError(err.message);
      });
  }

  function populateEducationSelect() {
    if (!els.applyEducation) return;
    els.applyEducation.innerHTML = '<option value="">Select education level</option>' +
      state.educationLevels.map(function (row) {
        return '<option value="' + escapeHtml(row.key) + '">' + escapeHtml(row.label) + '</option>';
      }).join('');
  }

  function populateStoreSelect() {
    if (!els.applyPreferredStore) return;
    els.applyPreferredStore.innerHTML = '<option value="">No preference</option>' +
      state.storeOptions.map(function (name) {
        return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>';
      }).join('');
  }

  function istToday() {
    return typeof window.cosmosIstToday === 'function' ? window.cosmosIstToday() : '';
  }

  function getJoiningKey() {
    var checked = document.querySelector('input[name="joining_availability_key"]:checked');
    return checked ? checked.value : 'INSTANT';
  }

  function applyDraftKey() {
    return 'army_apply_draft_' + (state.applySlug || 'unknown');
  }

  function saveApplyDraft() {
    try {
      var draft = {
        full_name: (document.getElementById('apply-full-name') || {}).value || '',
        email: (document.getElementById('apply-email') || {}).value || '',
        dob: (document.getElementById('apply-dob') || {}).value || '',
        experience_years: (document.getElementById('apply-exp-years') || {}).value || '0',
        experience_months: (document.getElementById('apply-exp-months') || {}).value || '0',
        education_key: (document.getElementById('apply-education') || {}).value || '',
        preferred_store: (document.getElementById('apply-preferred-store') || {}).value || '',
        last_employer: (document.getElementById('apply-last-employer') || {}).value || '',
        referral_code: (document.getElementById('apply-referral') || {}).value || '',
        joining_availability_key: getJoiningKey(),
        notice_period_days: (document.getElementById('apply-notice-days') || {}).value || '',
        expected_join_date: (document.getElementById('apply-expected-join-date') || {}).value || ''
      };
      sessionStorage.setItem(applyDraftKey(), JSON.stringify(draft));
    } catch (_) { /* ignore */ }
  }

  function restoreApplyDraft() {
    try {
      var raw = sessionStorage.getItem(applyDraftKey());
      if (!raw) return;
      var draft = JSON.parse(raw);
      if (draft.full_name && document.getElementById('apply-full-name')) document.getElementById('apply-full-name').value = draft.full_name;
      if (draft.email && document.getElementById('apply-email')) document.getElementById('apply-email').value = draft.email;
      if (draft.dob && document.getElementById('apply-dob')) document.getElementById('apply-dob').value = draft.dob;
      if (document.getElementById('apply-exp-years')) document.getElementById('apply-exp-years').value = draft.experience_years || '0';
      if (document.getElementById('apply-exp-months')) document.getElementById('apply-exp-months').value = draft.experience_months || '0';
      if (draft.education_key && document.getElementById('apply-education')) document.getElementById('apply-education').value = draft.education_key;
      if (document.getElementById('apply-preferred-store')) document.getElementById('apply-preferred-store').value = draft.preferred_store || '';
      if (document.getElementById('apply-last-employer')) document.getElementById('apply-last-employer').value = draft.last_employer || '';
      if (document.getElementById('apply-referral')) document.getElementById('apply-referral').value = draft.referral_code || '';
      var joinKey = draft.joining_availability_key || 'INSTANT';
      var joinRadio = document.querySelector('input[name="joining_availability_key"][value="' + joinKey + '"]');
      if (joinRadio) joinRadio.checked = true;
      if (document.getElementById('apply-notice-days')) document.getElementById('apply-notice-days').value = draft.notice_period_days || '';
      if (document.getElementById('apply-expected-join-date')) document.getElementById('apply-expected-join-date').value = draft.expected_join_date || '';
      toggleNoticeFields();
    } catch (_) { /* ignore */ }
  }

  function toggleNoticeFields() {
    var onNotice = getJoiningKey() === 'ON_NOTICE';
    if (els.applyNoticeFields) els.applyNoticeFields.hidden = !onNotice;
    if (!onNotice) {
      var noticeDays = document.getElementById('apply-notice-days');
      var joinDate = document.getElementById('apply-expected-join-date');
      if (noticeDays) {
        noticeDays.value = '';
        if (window.cosmosFieldClear) window.cosmosFieldClear(noticeDays);
      }
      if (joinDate) {
        joinDate.value = '';
        if (window.cosmosFieldClear) window.cosmosFieldClear(joinDate);
      }
    }
  }

  function hideApplySuccess() {
    if (els.applySuccess) els.applySuccess.hidden = true;
    if (els.applyProgressWrap) els.applyProgressWrap.hidden = false;
    if (els.applyBottom) els.applyBottom.hidden = false;
    if (els.applyJobSummary) els.applyJobSummary.hidden = false;
  }

  function showApplySuccess() {
    state.applySubmitted = true;
    document.querySelectorAll('.army-apply-step').forEach(function (p) { p.hidden = true; p.classList.remove('active'); });
    if (els.applyProgressWrap) els.applyProgressWrap.hidden = true;
    if (els.applyJobSummary) els.applyJobSummary.hidden = true;
    if (els.applyBottom) els.applyBottom.hidden = true;
    if (els.applySuccess) els.applySuccess.hidden = false;
  }

  function updateApplyForwardButton() {
    if (!els.applyWizardForward || state.applySubmitted) return;
    var step = state.applyStep;
    if (step < 4) {
      els.applyWizardForward.textContent = 'Continue';
      els.applyWizardForward.disabled = false;
      els.applyWizardForward.removeAttribute('aria-disabled');
      return;
    }
    els.applyWizardForward.textContent = 'Submit Application';
    var hasFile = els.applyResume && els.applyResume.files && els.applyResume.files[0];
    els.applyWizardForward.disabled = !hasFile;
    if (!hasFile) els.applyWizardForward.setAttribute('aria-disabled', 'true');
    else els.applyWizardForward.removeAttribute('aria-disabled');
  }

  function updateApplyProgress() {
    if (state.applySubmitted) return;
    hideApplySuccess();
    var step = state.applyStep;
    if (els.applyStepLabel) els.applyStepLabel.textContent = 'Step ' + step + ' of 4';
    if (els.applyProgressFill) els.applyProgressFill.style.width = (step * 25) + '%';
    if (els.applyProgressBar) els.applyProgressBar.setAttribute('aria-valuenow', String(step));
    document.querySelectorAll('.army-apply-step').forEach(function (panel) {
      var n = Number(panel.getAttribute('data-step'));
      var active = n === step;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
    if (els.applyProgressWrap) els.applyProgressWrap.hidden = step > 4;
    if (step === 3) toggleNoticeFields();
    if (step === 4) renderApplyReview();
    updateApplyForwardButton();
  }

  function goApplyStep(step) {
    if (state.applySubmitted) {
      hideApplySuccess();
      state.applySubmitted = false;
    }
    state.applyStep = Math.max(1, Math.min(4, step));
    saveApplyDraft();
    updateApplyProgress();
    if (els.applyContent) els.applyContent.scrollTop = 0;
  }

  function joiningLabel(key) {
    var row = state.joiningOptions.find(function (o) { return o.key === key; });
    return row ? row.label : key;
  }

  function educationLabel(key) {
    var row = state.educationLevels.find(function (o) { return o.key === key; });
    return row ? row.label : key;
  }

  function renderApplyReview() {
    if (!els.applyReviewBody || !els.applyReviewSummary) return;
    var joinKey = getJoiningKey();
    var joinText = joiningLabel(joinKey);
    if (joinKey === 'ON_NOTICE') {
      var days = (document.getElementById('apply-notice-days') || {}).value || '—';
      var joinDate = (document.getElementById('apply-expected-join-date') || {}).value || '';
      joinText += ' · ' + days + ' days · ' + (joinDate ? istFormatDate(joinDate) : '—');
    }
    var resumeName = '—';
    if (els.applyResume && els.applyResume.files && els.applyResume.files[0]) {
      resumeName = els.applyResume.files[0].name;
    }
    els.applyReviewBody.innerHTML =
      reviewRow('Role', state.applyJob ? state.applyJob.title : '—') +
      reviewRow('Name', (document.getElementById('apply-full-name') || {}).value) +
      reviewRow('Phone', state.verifiedPhone ? '+91 ' + state.verifiedPhone : '—') +
      reviewRow('Email', (document.getElementById('apply-email') || {}).value) +
      reviewRow('Education', educationLabel((document.getElementById('apply-education') || {}).value)) +
      reviewRow('Joining', joinText) +
      reviewRow('CV', resumeName);
    els.applyReviewSummary.hidden = false;
  }

  function reviewRow(label, value) {
    return '<div class="army-apply-review-row"><span>' + escapeHtml(label) + '</span><span>' + escapeHtml(value || '—') + '</span></div>';
  }

  function resetApplyScreen() {
    state.verificationToken = '';
    state.verifiedPhone = '';
    state.applyStep = 1;
    state.applySubmitted = false;
    hideApplySuccess();
    if (els.applyError) { els.applyError.hidden = true; els.applyError.textContent = ''; }
    if (els.applyPhone) els.applyPhone.value = '';
    if (els.applyOtp) els.applyOtp.value = '';
    if (els.applyOtpWrap) els.applyOtpWrap.hidden = true;
    if (els.applyVerifiedBadge) els.applyVerifiedBadge.hidden = true;
    if (els.applyForm) {
      els.applyForm.hidden = false;
      els.applyForm.reset();
    }
    var expYears = document.getElementById('apply-exp-years');
    var expMonths = document.getElementById('apply-exp-months');
    if (expYears) expYears.value = '0';
    if (expMonths) expMonths.value = '0';
    if (els.applyPhone) els.applyPhone.disabled = false;
    if (els.applySendOtp) els.applySendOtp.disabled = false;
    var instantRadio = document.getElementById('apply-joining-instant');
    if (instantRadio) instantRadio.checked = true;
    if (document.getElementById('apply-notice-days')) document.getElementById('apply-notice-days').value = '';
    if (document.getElementById('apply-expected-join-date')) document.getElementById('apply-expected-join-date').value = '';
    toggleNoticeFields();
    if (els.applyResume) els.applyResume.value = '';
    if (els.applyResumeDrop) els.applyResumeDrop.classList.remove('has-file');
    if (els.applyResumeLabel) els.applyResumeLabel.textContent = 'Tap to upload CV';
    if (els.applyReviewSummary) els.applyReviewSummary.hidden = true;
    if (els.applyJobSummary) els.applyJobSummary.hidden = false;
    document.querySelectorAll('.army-apply-step').forEach(function (p) { p.hidden = p.getAttribute('data-step') !== '1'; });
    if (window.cosmosBtnDone && els.applySendOtp) window.cosmosBtnDone(els.applySendOtp);
    if (window.cosmosBtnDone && els.applyVerifyOtp) window.cosmosBtnDone(els.applyVerifyOtp);
    if (window.cosmosBtnDone && els.applyWizardForward) window.cosmosBtnDone(els.applyWizardForward);
    updateApplyProgress();
  }

  function loadApplyScreen(slug) {
    resetApplyScreen();
    if (els.applyJobSummary) {
      els.applyJobSummary.innerHTML =
        '<span class="skel skel-title" style="width:70%;display:block;margin-bottom:8px"></span>' +
        '<span class="skel skel-text-sm" style="width:50%;display:block"></span>';
    }
    document.title = 'Apply · Eyewoot Careers';
    apiGet('/api/army/careers/jobs/' + encodeURIComponent(slug))
      .then(function (job) {
        state.applyJob = job;
        if (els.applyTitle) els.applyTitle.textContent = 'Apply · ' + job.title;
        if (els.applyJobSummary) {
          els.applyJobSummary.innerHTML =
            '<div class="army-job-title">' + escapeHtml(job.title) + '</div>' +
            '<div class="army-job-meta">' + escapeHtml(job.store_name) + ' · ' + escapeHtml(job.employment_type_label) + '</div>';
        }
        restoreApplyDraft();
        updateApplyProgress();
      })
      .catch(function (err) {
        if (window.cosmosToastError) window.cosmosToastError(err.message);
        navigateHome(false);
      });
  }

  function showApplyError(message) {
    if (!els.applyError) return;
    els.applyError.textContent = message;
    els.applyError.hidden = !message;
  }

  function handleApplySendOtp() {
    var phone = (els.applyPhone && els.applyPhone.value || '').replace(/\D/g, '');
    if (phone.length !== 10) {
      if (window.cosmosFieldError && els.applyPhone) window.cosmosFieldError(els.applyPhone, 'Enter a valid 10-digit number');
      return;
    }
    if (window.cosmosFieldClear && els.applyPhone) window.cosmosFieldClear(els.applyPhone);
    if (window.cosmosBtnLoading) window.cosmosBtnLoading(els.applySendOtp);
    apiPost('/api/army/careers/otp/send', { phone: phone })
      .then(function (data) {
        if (window.cosmosBtnSuccess) window.cosmosBtnSuccess(els.applySendOtp);
        if (els.applyOtpWrap) els.applyOtpWrap.hidden = false;
        if (window.cosmosToastSuccess) window.cosmosToastSuccess('OTP sent to WhatsApp');
        if (data.dev_otp && window.cosmosToastInfo) {
          window.cosmosToastInfo('Dev OTP: ' + data.dev_otp);
        }
      })
      .catch(function (err) {
        if (window.cosmosBtnDone) window.cosmosBtnDone(els.applySendOtp);
        if (window.cosmosToastError) window.cosmosToastError(err.message);
      });
  }

  function handleApplyVerifyOtp() {
    var phone = (els.applyPhone && els.applyPhone.value || '').replace(/\D/g, '');
    var otp = (els.applyOtp && els.applyOtp.value || '').trim();
    if (window.cosmosBtnLoading) window.cosmosBtnLoading(els.applyVerifyOtp);
    apiPost('/api/army/careers/otp/verify', { phone: phone, otp_code: otp })
      .then(function (data) {
        state.verificationToken = data.verification_token;
        state.verifiedPhone = data.phone;
        if (window.cosmosBtnSuccess) window.cosmosBtnSuccess(els.applyVerifyOtp);
        if (els.applyVerifiedBadge) els.applyVerifiedBadge.hidden = false;
        if (els.applyPhone) els.applyPhone.disabled = true;
        if (els.applySendOtp) els.applySendOtp.disabled = true;
        if (window.cosmosToastSuccess) window.cosmosToastSuccess('Number verified — tap Continue');
      })
      .catch(function (err) {
        if (window.cosmosBtnDone) window.cosmosBtnDone(els.applyVerifyOtp);
        if (window.cosmosToastError) window.cosmosToastError(err.message);
      });
  }

  function validateApplyStep(step) {
    showApplyError('');
    if (step === 1) {
      if (!state.verificationToken) {
        showApplyError('Verify your mobile number with OTP before continuing.');
        if (window.cosmosToastWarn) window.cosmosToastWarn('Complete OTP verification first.');
        return false;
      }
      return true;
    }
    if (step === 2) {
      var fullName = document.getElementById('apply-full-name');
      var email = document.getElementById('apply-email');
      var dob = document.getElementById('apply-dob');
      var education = document.getElementById('apply-education');
      var ok = true;
      if (!fullName.value.trim()) { if (window.cosmosFieldError) window.cosmosFieldError(fullName, 'Required'); ok = false; }
      if (!email.value.trim()) { if (window.cosmosFieldError) window.cosmosFieldError(email, 'Required'); ok = false; }
      if (!dob.value) { if (window.cosmosFieldError) window.cosmosFieldError(dob, 'Required'); ok = false; }
      if (!education.value) { if (window.cosmosFieldError) window.cosmosFieldError(education, 'Select education'); ok = false; }
      return ok;
    }
    if (step === 3) {
      var joinKey = getJoiningKey();
      if (joinKey === 'ON_NOTICE') {
        var noticeDays = document.getElementById('apply-notice-days');
        var joinDate = document.getElementById('apply-expected-join-date');
        var okNotice = true;
        var days = Number(noticeDays && noticeDays.value);
        if (!days || days < 1 || days > 180) {
          if (window.cosmosFieldError && noticeDays) window.cosmosFieldError(noticeDays, 'Enter 1–180 days');
          okNotice = false;
        }
        if (!joinDate || !joinDate.value) {
          if (window.cosmosFieldError && joinDate) window.cosmosFieldError(joinDate, 'Required');
          okNotice = false;
        } else if (joinDate.value < istToday()) {
          if (window.cosmosFieldError && joinDate) window.cosmosFieldError(joinDate, 'Cannot be in the past');
          okNotice = false;
        }
        return okNotice;
      }
      return true;
    }
    if (step === 4) {
      if (!els.applyResume || !els.applyResume.files || !els.applyResume.files[0]) {
        if (window.cosmosToastError) window.cosmosToastError('Upload your CV to submit.');
        return false;
      }
      var file = els.applyResume.files[0];
      var ext = file.name.split('.').pop().toLowerCase();
      if (['pdf', 'doc', 'docx'].indexOf(ext) === -1) {
        if (window.cosmosToastError) window.cosmosToastError('CV must be PDF, DOC or DOCX.');
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        if (window.cosmosToastError) window.cosmosToastError('CV must be 5 MB or smaller.');
        return false;
      }
      return true;
    }
    return true;
  }

  function handleApplyWizardNext() {
    if (!validateApplyStep(state.applyStep)) return;
    if (window.cosmosBtnLoading) window.cosmosBtnLoading(els.applyWizardForward);
    goApplyStep(state.applyStep + 1);
    if (window.cosmosBtnDone) window.cosmosBtnDone(els.applyWizardForward);
  }

  function handleApplyWizardForward() {
    if (state.applySubmitted) return;
    if (state.applyStep < 4) {
      handleApplyWizardNext();
      return;
    }
    if (state.applyStep === 4) handleApplySubmit();
  }

  function handleApplyWizardBack() {
    if (state.applySubmitted) {
      if (state.applySlug) navigateDetail(state.applySlug, false);
      else navigateHome(false);
      return;
    }
    if (state.applyStep <= 1) {
      if (state.applySlug) navigateDetail(state.applySlug, false);
      else navigateHome(false);
      return;
    }
    goApplyStep(state.applyStep - 1);
  }

  function handleResumeChange() {
    var file = els.applyResume && els.applyResume.files && els.applyResume.files[0];
    if (file && els.applyResumeLabel) els.applyResumeLabel.textContent = file.name;
    if (els.applyResumeDrop) els.applyResumeDrop.classList.toggle('has-file', !!file);
    if (state.applyStep === 4) renderApplyReview();
    updateApplyForwardButton();
  }

  function handleApplySubmit() {
    if (state.applyStep !== 4 || state.applySubmitted) return;
    if (!validateApplyStep(4)) return;
    if (!state.verificationToken) {
      showApplyError('Session expired. Go back to step 1 and verify your number again.');
      return;
    }
    if (window.cosmosBtnLoading) window.cosmosBtnLoading(els.applyWizardForward);

    var joinKey = getJoiningKey();
    var formData = new FormData();
    formData.append('job_slug', state.applySlug);
    formData.append('full_name', document.getElementById('apply-full-name').value.trim());
    formData.append('phone', state.verifiedPhone);
    formData.append('email', document.getElementById('apply-email').value.trim());
    formData.append('dob', document.getElementById('apply-dob').value);
    formData.append('experience_years', document.getElementById('apply-exp-years').value || '0');
    formData.append('experience_months', document.getElementById('apply-exp-months').value || '0');
    formData.append('education_key', document.getElementById('apply-education').value);
    formData.append('preferred_store', document.getElementById('apply-preferred-store').value);
    formData.append('last_employer', document.getElementById('apply-last-employer').value.trim());
    formData.append('referral_code', document.getElementById('apply-referral').value.trim());
    formData.append('source', state.sourceKey);
    formData.append('joining_availability_key', joinKey);
    if (joinKey === 'ON_NOTICE') {
      formData.append('notice_period_days', document.getElementById('apply-notice-days').value);
      formData.append('expected_join_date', document.getElementById('apply-expected-join-date').value);
    }
    formData.append('resume', els.applyResume.files[0]);

    fetch('/api/army/careers/applications', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'X-Army-Verification-Token': state.verificationToken
      },
      body: formData
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok || !body || body.success !== true) throw new Error(body && body.message ? body.message : 'Submit failed.');
          return body.data;
        });
      })
      .then(function () {
        if (window.cosmosBtnSuccess) window.cosmosBtnSuccess(els.applyWizardForward);
        try { sessionStorage.removeItem(applyDraftKey()); } catch (_) { /* ignore */ }
        showApplySuccess();
        if (window.cosmosToastSuccess) window.cosmosToastSuccess('Application submitted');
        state.verificationToken = '';
      })
      .catch(function (err) {
        if (window.cosmosBtnDone) window.cosmosBtnDone(els.applyWizardForward);
        if (window.cosmosToastError) window.cosmosToastError(err.message);
      });
  }

  function resetStatusScreen() {
    state.verificationToken = '';
    if (els.statusPhone) { els.statusPhone.value = ''; els.statusPhone.disabled = false; }
    if (els.statusOtp) els.statusOtp.value = '';
    if (els.statusOtpWrap) els.statusOtpWrap.hidden = true;
    if (els.statusResult) els.statusResult.innerHTML = '';
    if (els.statusSendOtp) { els.statusSendOtp.disabled = false; window.cosmosBtnDone && window.cosmosBtnDone(els.statusSendOtp); }
    if (els.statusVerifyOtp) window.cosmosBtnDone && window.cosmosBtnDone(els.statusVerifyOtp);
  }

  function renderStatusResult(data) {
    if (!els.statusResult) return;
    var status = data.status || {};
    els.statusResult.innerHTML =
      '<div class="army-detail-card">' +
      '<div class="army-job-title">' + escapeHtml(data.job_title) + ' · ' + escapeHtml(data.store_name) + '</div>' +
      '<div class="army-job-deadline" style="margin:8px 0">Applied ' + escapeHtml(istFormatDate(data.applied_at)) + '</div>' +
      '<span class="army-status-badge ' + escapeHtml(status.badge_class || 'status-applied') + '">' + escapeHtml(status.label || 'Applied') + '</span>' +
      '<p class="army-section-body" style="margin-top:12px">' + escapeHtml(status.hint || '') + '</p>' +
      '</div>';
  }

  function handleStatusSendOtp() {
    var phone = (els.statusPhone && els.statusPhone.value || '').replace(/\D/g, '');
    if (phone.length !== 10) {
      if (window.cosmosFieldError && els.statusPhone) window.cosmosFieldError(els.statusPhone, 'Enter a valid 10-digit number');
      return;
    }
    if (window.cosmosFieldClear && els.statusPhone) window.cosmosFieldClear(els.statusPhone);
    if (window.cosmosBtnLoading) window.cosmosBtnLoading(els.statusSendOtp);
    apiPost('/api/army/careers/otp/send', { phone: phone })
      .then(function (data) {
        if (window.cosmosBtnSuccess) window.cosmosBtnSuccess(els.statusSendOtp);
        if (els.statusOtpWrap) els.statusOtpWrap.hidden = false;
        if (window.cosmosToastSuccess) window.cosmosToastSuccess('OTP sent to WhatsApp');
        if (data.dev_otp && window.cosmosToastInfo) window.cosmosToastInfo('Dev OTP: ' + data.dev_otp);
      })
      .catch(function (err) {
        if (window.cosmosBtnDone) window.cosmosBtnDone(els.statusSendOtp);
        if (window.cosmosToastError) window.cosmosToastError(err.message);
      });
  }

  function handleStatusVerifyOtp() {
    var phone = (els.statusPhone && els.statusPhone.value || '').replace(/\D/g, '');
    var otp = (els.statusOtp && els.statusOtp.value || '').trim();
    if (window.cosmosBtnLoading) window.cosmosBtnLoading(els.statusVerifyOtp);
    apiPost('/api/army/careers/otp/verify', { phone: phone, otp_code: otp })
      .then(function (data) {
        state.verificationToken = data.verification_token;
        if (els.statusPhone) els.statusPhone.disabled = true;
        if (els.statusSendOtp) els.statusSendOtp.disabled = true;
        return fetch('/api/army/careers/applications/status', {
          headers: {
            Accept: 'application/json',
            'X-Army-Verification-Token': state.verificationToken
          }
        }).then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok || !body || body.success !== true) throw new Error(body && body.message ? body.message : 'Status lookup failed.');
            return body.data;
          });
        });
      })
      .then(function (data) {
        if (window.cosmosBtnSuccess) window.cosmosBtnSuccess(els.statusVerifyOtp);
        renderStatusResult(data);
      })
      .catch(function (err) {
        if (window.cosmosBtnDone) window.cosmosBtnDone(els.statusVerifyOtp);
        if (els.statusResult) {
          els.statusResult.innerHTML = '<div class="army-empty"><div class="army-empty-title">' + escapeHtml(err.message) + '</div></div>';
        }
        if (window.cosmosToastError) window.cosmosToastError(err.message);
      });
  }

  function bindFieldClear() {
    ['apply-phone', 'apply-full-name', 'apply-email', 'apply-dob', 'apply-education', 'apply-notice-days', 'apply-expected-join-date', 'status-phone'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || !window.cosmosFieldClear) return;
      el.addEventListener('input', function () { window.cosmosFieldClear(el); });
      el.addEventListener('change', function () { window.cosmosFieldClear(el); });
    });
  }

  function bindEvents() {
    if (els.search) {
      els.search.addEventListener('input', function () {
        clearTimeout(state.searchTimer);
        state.searchTimer = setTimeout(function () {
          state.searchQuery = els.search.value.trim();
          loadJobs();
        }, 250);
      });
    }
    if (els.trackBtn) els.trackBtn.addEventListener('click', function () { navigateStatus(false); });
    if (els.backBtn) els.backBtn.addEventListener('click', function () { if (window.history.length > 1) window.history.back(); else navigateHome(true); });
    if (els.detailApply) els.detailApply.addEventListener('click', function () { if (state.currentSlug) navigateApply(state.currentSlug, false); });
    if (els.applyBack) els.applyBack.addEventListener('click', handleApplyWizardBack);
    if (els.applyWizardBack) els.applyWizardBack.addEventListener('click', handleApplyWizardBack);
    if (els.applySendOtp) els.applySendOtp.addEventListener('click', handleApplySendOtp);
    if (els.applyVerifyOtp) els.applyVerifyOtp.addEventListener('click', handleApplyVerifyOtp);
    if (els.applyWizardForward) els.applyWizardForward.addEventListener('click', handleApplyWizardForward);
    if (els.applyResume) els.applyResume.addEventListener('change', handleResumeChange);
    document.querySelectorAll('input[name="joining_availability_key"]').forEach(function (radio) {
      radio.addEventListener('change', toggleNoticeFields);
    });
    if (els.applySuccessStatus) els.applySuccessStatus.addEventListener('click', function () { navigateStatus(false); });
    if (els.statusBack) els.statusBack.addEventListener('click', function () { navigateHome(false); });
    if (els.statusSendOtp) els.statusSendOtp.addEventListener('click', handleStatusSendOtp);
    if (els.statusVerifyOtp) els.statusVerifyOtp.addEventListener('click', handleStatusVerifyOtp);
    window.addEventListener('popstate', function () { routeFromLocation(true); });
    bindFieldClear();
  }

  function routeFromLocation(isPop) {
    var route = parseCareersPath();
    readSourceFromQuery();
    if (route.screen === 'home') {
      showScreen('home');
      state.currentSlug = '';
      if (!isPop) loadJobs();
      document.title = 'Eyewoot Careers';
      return;
    }
    if (route.screen === 'detail') {
      state.currentSlug = route.slug;
      showScreen('detail');
      loadJobDetail(route.slug);
      return;
    }
    if (route.screen === 'apply') {
      state.applySlug = route.slug;
      showScreen('apply');
      loadApplyScreen(route.slug);
      return;
    }
    if (route.screen === 'status') {
      showScreen('status');
      document.title = 'Track Application · Eyewoot Careers';
      if (!isPop) resetStatusScreen();
    }
  }

  function initMeta() {
    return Promise.all([
      apiGet('/api/army/careers/meta/departments'),
      apiGet('/api/army/careers/meta/education'),
      apiGet('/api/army/careers/meta/stores'),
      apiGet('/api/army/careers/meta/joining-availability')
    ]).then(function (results) {
      state.departments = (results[0] && results[0].departments) || [];
      state.educationLevels = (results[1] && results[1].education_levels) || [];
      state.storeOptions = (results[2] && results[2].stores) || [];
      state.joiningOptions = (results[3] && results[3].joining_options) || [];
      renderChips();
      populateEducationSelect();
      populateStoreSelect();
    });
  }

  function init() {
    cacheElements();
    bindEvents();
    renderSkeletonCards(3);
    readSourceFromQuery();
    initMeta()
      .catch(function (err) {
        if (window.cosmosToastWarn) window.cosmosToastWarn(err.message);
      })
      .finally(function () {
        routeFromLocation(false);
        var route = parseCareersPath();
        if (route.screen === 'home') loadJobs();
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
