/* Army HR Admin — client shell */
(function armyHrBootstrap() {
  'use strict';

  var ARMY_PAGE_PATHS = {
    dashboard: '/army/hr/dashboard',
    'job-openings': '/army/hr/job-openings',
    'interview-templates': '/army/hr/interview-templates',
    pipeline: '/army/hr/pipeline'
  };

  var _user = null;
  var _meta = { job_opening_statuses: [], application_statuses: [], db_ready: false };
  var _jobs = [];
  var _templates = [];
  var _applications = [];
  var _activeApplicationId = null;
  var _editingJobId = null;
  var _originalJobTemplateId = null;
  var _editingTemplateId = null;

  function getToken() {
    return sessionStorage.getItem('cosmos_token') || '';
  }

  function getUser() {
    if (_user) return _user;
    try {
      _user = JSON.parse(sessionStorage.getItem('cosmos_user') || '{}');
    } catch (_) {
      _user = {};
    }
    return _user;
  }

  function refreshUserFromSession() {
    _user = null;
    return getUser();
  }

  function userPermissionsLower() {
    var u = getUser();
    var raw = u && u.permissions;
    if (!Array.isArray(raw)) return [];
    return raw.map(function (x) { return String(x).toLowerCase(); }).filter(Boolean);
  }

  function hasPerm(key) {
    var u = getUser();
    if (String(u.role || '').toLowerCase() === 'super_admin') return true;
    var k = String(key || '').toLowerCase();
    if (!k) return false;
    return userPermissionsLower().indexOf(k) >= 0;
  }

  function canViewJobs() { return hasPerm('army.hiring.job_openings.view'); }
  function canEditJobs() { return hasPerm('army.hiring.job_openings.edit'); }
  function canViewCandidates() { return hasPerm('army.hiring.candidates.view'); }
  function canEditCandidates() { return hasPerm('army.hiring.candidates.edit'); }
  function canViewTemplates() { return hasPerm('army.hiring.interview_templates.view'); }
  function canEditTemplates() { return hasPerm('army.hiring.interview_templates.edit'); }

  function interviewerRoleLabel(key) {
    var row = (_meta.interviewer_roles || []).find(function (r) { return r.key === key; });
    return row ? row.label : (key || '—');
  }

  async function apiFetch(method, path, body) {
    var token = getToken();
    if (!token) {
      window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname);
      throw new Error('Not signed in');
    }
    var apiKey = typeof window.cosmosEnsureApiKey === 'function'
      ? await window.cosmosEnsureApiKey()
      : '';
    if (!apiKey) throw new Error('Invalid or missing API key');

    var res = await fetch(path, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Authorization': 'Bearer ' + token
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    var data;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) {
      var msg = (data && data.message) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  var apiGet = function (p) { return apiFetch('GET', p); };
  var apiPost = function (p, b) { return apiFetch('POST', p, b); };
  var apiPut = function (p, b) { return apiFetch('PUT', p, b); };
  var apiPatch = function (p, b) { return apiFetch('PATCH', p, b); };

  function escHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(v) {
    if (typeof window.cosmosFmtDate === 'function') return window.cosmosFmtDate(v);
    if (!v) return '—';
    return String(v);
  }

  function jobStatusBadge(status) {
    var row = (_meta.job_opening_statuses || []).find(function (s) { return s.key === status; });
    var cls = row ? row.badgeClass : 'b-gray';
    var label = row ? row.label : status;
    return '<span class="b ' + escHtml(cls) + '">' + escHtml(label) + '</span>';
  }

  function appStatusLabel(key) {
    var row = (_meta.application_statuses || []).find(function (s) { return s.key === key; });
    return row ? row.label : key;
  }

  function appStatusBadge(statusKey, statusObj) {
    var row = statusObj || (_meta.application_statuses || []).find(function (s) { return s.key === statusKey; });
    var cls = row && row.badgeClass ? row.badgeClass : 'status-applied';
    var label = row ? row.label : statusKey;
    return '<span class="b ' + escHtml(cls) + '">' + escHtml(label) + '</span>';
  }

  function educationLabel(key) {
    var row = (_meta.education_levels || []).find(function (e) { return e.key === key; });
    return row ? row.label : (key || '—');
  }

  function sourceLabel(key) {
    var row = (_meta.application_sources || []).find(function (s) { return s.key === key; });
    return row ? row.label : (key || '—');
  }

  function departmentLabel(key) {
    var departments = (_meta.departments && _meta.departments.departments) || [];
    var row = departments.find(function (d) { return d.key === key; });
    return row ? row.label : (key || '—');
  }

  function fmtExperience(years, months) {
    var y = Number(years) || 0;
    var m = Number(months) || 0;
    if (!y && !m) return 'Fresher';
    var parts = [];
    if (y) parts.push(y + (y === 1 ? ' year' : ' years'));
    if (m) parts.push(m + (m === 1 ? ' month' : ' months'));
    return parts.join(' ');
  }

  function normalizeWhatsAppPhone(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return '91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
    return digits || '';
  }

  function telHref(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.length === 10) return 'tel:+91' + digits;
    if (digits.length === 12 && digits.startsWith('91')) return 'tel:+' + digits;
    return digits ? 'tel:' + digits : '#';
  }

  function whatsAppHref(phone, message) {
    var wa = normalizeWhatsAppPhone(phone);
    if (!wa) return '#';
    var url = 'https://wa.me/' + wa;
    if (message) url += '?text=' + encodeURIComponent(message);
    return url;
  }

  async function downloadCandidateResume(appId, btn) {
    if (!canViewCandidates() || !appId) return;
    if (btn && typeof cosmosBtnLoading === 'function') cosmosBtnLoading(btn);
    try {
      var token = getToken();
      var apiKey = typeof window.cosmosEnsureApiKey === 'function'
        ? await window.cosmosEnsureApiKey()
        : '';
      if (!token || !apiKey) throw new Error('Not signed in');

      var res = await fetch('/api/army/hr/applications/' + appId + '/resume', {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Authorization': 'Bearer ' + token
        }
      });
      if (!res.ok) {
        var errData = {};
        try { errData = await res.json(); } catch (_) { /* ignore */ }
        throw new Error((errData && errData.message) || ('HTTP ' + res.status));
      }

      var disposition = res.headers.get('Content-Disposition') || '';
      var match = disposition.match(/filename="?([^";]+)"?/i);
      var filename = match ? match[1] : 'resume.pdf';
      var blob = await res.blob();
      var objectUrl = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      if (btn && typeof cosmosBtnSuccess === 'function') cosmosBtnSuccess(btn);
      else if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      cosmosToastSuccess('CV downloaded.');
    } catch (err) {
      if (btn && typeof cosmosBtnDone === 'function') cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  function renderCandidateDetail(d) {
    var cand = d.candidate || {};
    var job = d.job || {};
    var waMessage = 'Hi ' + (cand.full_name || 'there') + ', this is Eyewoot HR regarding your application for ' + (job.title || 'the role') + '.';
    var hasResume = !!cand.resume_url;
    var hasPhone = !!cand.phone;
    var hasEmail = !!cand.email;

    var actions =
      '<div class="cand-actions">' +
      (hasPhone
        ? '<a class="btn sm primary" href="' + escHtml(whatsAppHref(cand.phone, waMessage)) + '" target="_blank" rel="noopener">WhatsApp</a>' +
          '<a class="btn sm" href="' + escHtml(telHref(cand.phone)) + '">Call</a>'
        : '') +
      (hasResume
        ? '<button type="button" class="btn sm" id="cand-download-cv">Download CV</button>'
        : '') +
      (hasEmail
        ? '<a class="btn sm" href="mailto:' + escHtml(cand.email) + '?subject=' + encodeURIComponent('Eyewoot — ' + (job.title || 'Application')) + '">Email</a>'
        : '') +
      '</div>';

    var head =
      '<div class="cand-head">' +
      '<div class="cand-head-main">' + appStatusBadge(d.status_key, d.status) +
      '<span class="cand-meta">Applied ' + escHtml(fmtDate(d.applied_at)) +
      (d.updated_at && d.updated_at !== d.applied_at ? ' · Updated ' + escHtml(fmtDate(d.updated_at)) : '') +
      '</span></div>' +
      '<div class="cand-role">' + escHtml(job.title || '—') + '</div>' +
      '<div class="cand-role-sub">' + escHtml(job.store_name || '') +
      (job.department_key ? ' · ' + escHtml(departmentLabel(job.department_key)) : '') +
      '</div></div>';

    var contactSection =
      '<div class="cand-section"><div class="cand-section-title">Contact</div><div class="detail-grid">' +
      detailItem('Phone', cand.phone || '—') +
      detailItem('Email', cand.email || '—') +
      detailItem('Date of birth', fmtDate(cand.dob)) +
      detailItem('Preferred store', d.preferred_store || '—') +
      '</div></div>';

    var experienceSection =
      '<div class="cand-section"><div class="cand-section-title">Experience & education</div><div class="detail-grid">' +
      detailItem('Experience', fmtExperience(cand.experience_years, cand.experience_months)) +
      detailItem('Education', educationLabel(cand.education_key)) +
      detailItem('Last employer', cand.last_employer || '—') +
      detailItem('Referral code', cand.referral_code || '—') +
      '</div></div>';

    var applicationSection =
      '<div class="cand-section"><div class="cand-section-title">Application</div><div class="detail-grid">' +
      detailItem('Joining availability', fmtJoiningAvailability(d.joining)) +
      detailItem('Source', sourceLabel(cand.source_key)) +
      detailItem('Application ID', '#' + d.id) +
      detailItem('Job slug', job.slug || '—') +
      '</div>' +
      (hasResume
        ? ''
        : '<div class="cand-no-cv">No CV uploaded for this application.</div>') +
      '</div>';

    return head + actions + contactSection + experienceSection + applicationSection;
  }

  function pageFromPath() {
    var p = window.location.pathname.replace(/\/+$/, '');
    if (p === '/army/hr' || p === '/army/hr/dashboard') return 'dashboard';
    if (p.indexOf('/army/hr/job-openings') === 0) return 'job-openings';
    if (p.indexOf('/army/hr/interview-templates') === 0) return 'interview-templates';
    if (p.indexOf('/army/hr/pipeline') === 0) return 'pipeline';
    return 'dashboard';
  }

  function navigatePage(pageKey) {
    var path = ARMY_PAGE_PATHS[pageKey] || ARMY_PAGE_PATHS.dashboard;
    if (window.location.pathname !== path) {
      window.history.pushState({ page: pageKey }, '', path);
    }
    showPage(pageKey);
  }

  function showPage(pageKey) {
    document.querySelectorAll('.page').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-page') === pageKey);
    });
    document.querySelectorAll('#army-nav .nav-item[data-page]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-page') === pageKey);
    });
    var labels = {
      dashboard: 'Dashboard',
      'job-openings': 'Job Openings',
      'interview-templates': 'Interview Templates',
      pipeline: 'Candidate Pipeline'
    };
    var bc = document.getElementById('army-breadcrumb');
    if (bc) bc.textContent = labels[pageKey] || 'Dashboard';

    if (pageKey === 'dashboard') loadDashboard();
    if (pageKey === 'job-openings') {
      syncJobsNewBtn();
      loadJobOpenings();
    }
    if (pageKey === 'interview-templates') {
      syncTemplatesNewBtn();
      loadInterviewTemplates();
    }
    if (pageKey === 'pipeline') loadPipeline();
  }

  function bindNav() {
    document.querySelectorAll('#army-nav .nav-item[data-page]').forEach(function (el) {
      function go() { navigatePage(el.getAttribute('data-page')); }
      el.addEventListener('click', go);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
    var careers = document.getElementById('nav-careers-link');
    if (careers) {
      careers.addEventListener('click', function () { window.open('/army/careers', '_blank'); });
      careers.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.open('/army/careers', '_blank'); }
      });
    }
  }

  function bindFilters() {
    var jobStatus = document.getElementById('jobs-filter-status');
    var jobQ = document.getElementById('jobs-filter-q');
    var pipeQ = document.getElementById('pipeline-filter-q');
    var tplQ = document.getElementById('templates-filter-q');
    if (jobStatus) jobStatus.addEventListener('change', loadJobOpenings);
    if (jobQ) jobQ.addEventListener('input', debounce(loadJobOpenings, 300));
    if (pipeQ) pipeQ.addEventListener('input', debounce(loadPipeline, 300));
    if (tplQ) tplQ.addEventListener('input', debounce(loadInterviewTemplates, 300));
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      var self = this;
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  async function loadMeta() {
    var res = await apiGet('/api/army/hr/meta/statuses');
    _meta = res.data || _meta;

    var statusSel = document.getElementById('jobs-filter-status');
    if (statusSel && statusSel.options.length <= 1) {
      (_meta.job_opening_statuses || []).forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = s.label;
        statusSel.appendChild(opt);
      });
    }

    var modalStatus = document.getElementById('modal-status-select');
    if (modalStatus && modalStatus.options.length === 0) {
      (_meta.application_statuses || []).forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = s.label;
        modalStatus.appendChild(opt);
      });
    }

    var banner = document.getElementById('army-db-banner');
    if (banner && !_meta.db_ready) {
      banner.style.display = 'block';
      banner.textContent = 'Hiring tables not deployed yet — run npm run migrate:78-army-hiring-pipeline. Showing seed data where available.';
    }

    populateJobFormSelects();
    syncJobsNewBtn();
    syncTemplatesNav();
  }

  function syncTemplatesNav() {
    var nav = document.getElementById('nav-interview-templates');
    if (nav) nav.hidden = !canViewTemplates();
  }

  function syncTemplatesNewBtn() {
    var btn = document.getElementById('templates-new-btn');
    if (btn) btn.hidden = !canEditTemplates();
  }

  function syncJobsNewBtn() {
    var btn = document.getElementById('jobs-new-btn');
    if (!btn) return;
    btn.hidden = !canEditJobs();
  }

  function populateJobFormSelects() {
    var deptSel = document.getElementById('job-form-department');
    var storeSel = document.getElementById('job-form-store');
    var empSel = document.getElementById('job-form-employment');
    var departments = (_meta.departments && _meta.departments.departments) || [];

    if (deptSel && !deptSel.options.length) {
      deptSel.innerHTML = '<option value="">Select department</option>' +
        departments.map(function (d) {
          return '<option value="' + escHtml(d.key) + '">' + escHtml(d.label) + '</option>';
        }).join('');
    }

    if (storeSel) {
      var stores = _meta.stores || [];
      storeSel.innerHTML = '<option value="">Select store</option>' +
        stores.map(function (s) {
          var label = s.store_name + (s.city ? ' · ' + s.city : '');
          return '<option value="' + escHtml(String(s.store_id)) + '">' + escHtml(label) + '</option>';
        }).join('');
    }

    if (empSel && !empSel.options.length) {
      empSel.innerHTML = (_meta.employment_types || []).map(function (e) {
        return '<option value="' + escHtml(e.key) + '">' + escHtml(e.label) + '</option>';
      }).join('');
    }

    var tplSel = document.getElementById('job-form-interview-template');
    if (tplSel) {
      var current = tplSel.value;
      var templates = _meta.interview_templates || [];
      tplSel.innerHTML = '<option value="">None — manual pipeline only</option>' +
        templates.map(function (t) {
          var label = t.name + ' (' + (t.stage_count || (t.stages && t.stages.length) || 0) + ' stages)';
          return '<option value="' + escHtml(String(t.id)) + '">' + escHtml(label) + '</option>';
        }).join('');
      if (current) tplSel.value = current;
    }
  }

  function showJobFormError(message) {
    var el = document.getElementById('modal-job-error');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.textContent = message;
    el.hidden = false;
  }

  function clearJobFieldErrors() {
    document.querySelectorAll('#modal-job .army-form-input').forEach(function (input) {
      input.classList.remove('army-field-invalid');
      if (window.cosmosFieldClear) window.cosmosFieldClear(input);
    });
  }

  function closeJobModal() {
    var overlay = document.getElementById('modal-job');
    if (overlay) overlay.classList.remove('open');
    _editingJobId = null;
    showJobFormError('');
    clearJobFieldErrors();
  }

  function fillJobForm(job) {
    document.getElementById('job-form-title').value = job.title || '';
    document.getElementById('job-form-department').value = job.department_key || '';
    document.getElementById('job-form-store').value = job.store_id ? String(job.store_id) : '';
    document.getElementById('job-form-vacancies').value = job.vacancies || 1;
    document.getElementById('job-form-employment').value = job.employment_type || 'FULL_TIME';
    document.getElementById('job-form-location').value = job.location || '';
    document.getElementById('job-form-apply-by').value = job.apply_by || '';
    document.getElementById('job-form-about').value = job.about || '';
    document.getElementById('job-form-requirements').value = (job.requirements || []).join('\n');
    var tplSel = document.getElementById('job-form-interview-template');
    if (tplSel) tplSel.value = job.interview_template_id ? String(job.interview_template_id) : '';
    _originalJobTemplateId = job.interview_template_id ? Number(job.interview_template_id) : null;
  }

  function resetJobForm() {
    _originalJobTemplateId = null;
    fillJobForm({
      title: '',
      department_key: '',
      store_id: '',
      vacancies: 1,
      employment_type: 'FULL_TIME',
      location: '',
      apply_by: '',
      about: '',
      requirements: []
    });
  }

  async function openJobModal(jobId) {
    if (!canEditJobs()) return;
    populateJobFormSelects();
    showJobFormError('');
    clearJobFieldErrors();
    _editingJobId = jobId || null;

    var titleEl = document.getElementById('modal-job-title');
    var saveBtn = document.getElementById('modal-job-save');
    if (titleEl) titleEl.textContent = _editingJobId ? 'Edit job opening' : 'New job opening';
    if (saveBtn) saveBtn.textContent = _editingJobId ? 'Save changes' : 'Save draft';

    if (_editingJobId) {
      try {
        var res = await apiGet('/api/army/hr/job-openings/' + _editingJobId);
        populateJobFormSelects();
        fillJobForm(res.data || {});
      } catch (err) {
        cosmosToastError(err.message);
        return;
      }
    } else {
      resetJobForm();
    }

    document.getElementById('modal-job').classList.add('open');
  }

  function readJobTemplateId() {
    var tplSel = document.getElementById('job-form-interview-template');
    if (!tplSel || !tplSel.value) return null;
    return Number(tplSel.value);
  }

  function validateJobForm() {
    clearJobFieldErrors();
    showJobFormError('');

    var titleEl = document.getElementById('job-form-title');
    var deptEl = document.getElementById('job-form-department');
    var storeEl = document.getElementById('job-form-store');
    var vacEl = document.getElementById('job-form-vacancies');
    var title = titleEl.value.trim();
    var dept = deptEl.value;
    var storeId = Number(storeEl.value);
    var vacancies = Number(vacEl.value);

    if (!title) {
      if (window.cosmosFieldError) window.cosmosFieldError(titleEl, 'Required');
      showJobFormError('Enter a job title.');
      return null;
    }
    if (!dept) {
      if (window.cosmosFieldError) window.cosmosFieldError(deptEl, 'Required');
      showJobFormError('Select a department.');
      return null;
    }
    if (!storeId) {
      if (window.cosmosFieldError) window.cosmosFieldError(storeEl, 'Required');
      showJobFormError('Select a store.');
      return null;
    }
    if (!vacancies || vacancies < 1) {
      if (window.cosmosFieldError) window.cosmosFieldError(vacEl, 'Enter at least 1');
      showJobFormError('Vacancies must be at least 1.');
      return null;
    }

    return {
      title: title,
      department_key: dept,
      store_id: storeId,
      vacancies: vacancies,
      employment_type: document.getElementById('job-form-employment').value,
      location: document.getElementById('job-form-location').value.trim(),
      apply_by: document.getElementById('job-form-apply-by').value || null,
      about_text: document.getElementById('job-form-about').value.trim(),
      requirements: document.getElementById('job-form-requirements').value,
      interview_template_id: readJobTemplateId()
    };
  }

  async function saveJobOpening() {
    if (!canEditJobs()) return;
    var payload = validateJobForm();
    if (!payload) return;

    var btn = document.getElementById('modal-job-save');
    cosmosBtnLoading(btn);
    try {
      if (_editingJobId) {
        await apiPut('/api/army/hr/job-openings/' + _editingJobId, payload);
        cosmosBtnSuccess(btn);
        cosmosToastSuccess('Job opening updated.');
        if (_originalJobTemplateId !== payload.interview_template_id) {
          cosmosToastInfo('Template change applies to new applications only.');
        }
      } else {
        await apiPost('/api/army/hr/job-openings', payload);
        cosmosBtnSuccess(btn);
        cosmosToastSuccess('Draft job opening saved.');
      }
      closeJobModal();
      loadJobOpenings();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  function showTemplateFormError(message) {
    var el = document.getElementById('modal-template-error');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.textContent = message;
    el.hidden = false;
  }

  function defaultTemplateStage() {
    return { stage_name: '', interviewer_role_key: 'HR_ADMIN', mode_key: 'IN_PERSON' };
  }

  function buildRoleOptions(selected) {
    return (_meta.interviewer_roles || []).map(function (r) {
      var sel = r.key === selected ? ' selected' : '';
      return '<option value="' + escHtml(r.key) + '"' + sel + '>' + escHtml(r.label) + '</option>';
    }).join('');
  }

  function buildModeOptions(selected) {
    return (_meta.interview_modes || [{ key: 'IN_PERSON', label: 'In-person' }]).map(function (m) {
      var sel = m.key === selected ? ' selected' : '';
      return '<option value="' + escHtml(m.key) + '"' + sel + '>' + escHtml(m.label) + '</option>';
    }).join('');
  }

  function renderTemplateStages(stages) {
    var wrap = document.getElementById('template-stages-list');
    if (!wrap) return;
    var list = stages && stages.length ? stages : [defaultTemplateStage()];
    wrap.innerHTML = list.map(function (stage, index) {
      return '<div class="army-template-stage" data-stage-index="' + index + '">' +
        '<div class="army-template-stage-num">' + (index + 1) + '</div>' +
        '<label class="army-form-field"><span class="army-form-label">Stage name</span>' +
        '<input class="army-form-input template-stage-name" type="text" maxlength="120" value="' + escHtml(stage.stage_name || '') + '" placeholder="e.g. HR Screening"></label>' +
        '<label class="army-form-field"><span class="army-form-label">Interviewer role</span>' +
        '<select class="army-form-input template-stage-role">' + buildRoleOptions(stage.interviewer_role_key || 'HR_ADMIN') + '</select></label>' +
        '<label class="army-form-field"><span class="army-form-label">Mode</span>' +
        '<select class="army-form-input template-stage-mode">' + buildModeOptions(stage.mode_key || 'IN_PERSON') + '</select></label>' +
        '<button type="button" class="army-template-stage-remove" data-action="remove-stage" aria-label="Remove stage"' +
        (list.length <= 1 ? ' hidden' : '') + '>✕</button>' +
        '</div>';
    }).join('');

    wrap.querySelectorAll('[data-action="remove-stage"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var rows = collectTemplateStagesFromDom();
        var idx = Number(btn.closest('.army-template-stage').getAttribute('data-stage-index'));
        rows.splice(idx, 1);
        renderTemplateStages(rows.length ? rows : [defaultTemplateStage()]);
      });
    });
  }

  function collectTemplateStagesFromDom() {
    var rows = [];
    document.querySelectorAll('#template-stages-list .army-template-stage').forEach(function (row) {
      rows.push({
        stage_name: (row.querySelector('.template-stage-name') || {}).value || '',
        interviewer_role_key: (row.querySelector('.template-stage-role') || {}).value || 'HR_ADMIN',
        mode_key: (row.querySelector('.template-stage-mode') || {}).value || 'IN_PERSON'
      });
    });
    return rows;
  }

  function closeTemplateModal() {
    var overlay = document.getElementById('modal-template');
    if (overlay) overlay.classList.remove('open');
    _editingTemplateId = null;
    showTemplateFormError('');
  }

  async function openTemplateModal(templateId) {
    if (!canEditTemplates()) return;
    showTemplateFormError('');
    _editingTemplateId = templateId || null;

    var titleEl = document.getElementById('modal-template-title');
    var saveBtn = document.getElementById('modal-template-save');
    if (titleEl) titleEl.textContent = _editingTemplateId ? 'Edit interview template' : 'New interview template';
    if (saveBtn) saveBtn.textContent = _editingTemplateId ? 'Save changes' : 'Save template';

    if (_editingTemplateId) {
      try {
        var res = await apiGet('/api/army/hr/interview-templates/' + _editingTemplateId);
        var t = res.data || {};
        document.getElementById('template-form-name').value = t.name || '';
        document.getElementById('template-form-description').value = t.description || '';
        document.getElementById('template-form-active').checked = t.is_active !== false;
        renderTemplateStages(t.stages || []);
      } catch (err) {
        cosmosToastError(err.message);
        return;
      }
    } else {
      document.getElementById('template-form-name').value = '';
      document.getElementById('template-form-description').value = '';
      document.getElementById('template-form-active').checked = true;
      renderTemplateStages([defaultTemplateStage()]);
    }

    document.getElementById('modal-template').classList.add('open');
  }

  function validateTemplateForm() {
    showTemplateFormError('');
    var nameEl = document.getElementById('template-form-name');
    var name = nameEl.value.trim();
    if (!name) {
      if (window.cosmosFieldError) window.cosmosFieldError(nameEl, 'Required');
      showTemplateFormError('Enter a template name.');
      return null;
    }
    var stages = collectTemplateStagesFromDom();
    if (!stages.length) {
      showTemplateFormError('Add at least one stage.');
      return null;
    }
    for (var i = 0; i < stages.length; i++) {
      if (!stages[i].stage_name.trim()) {
        showTemplateFormError('Each stage needs a name.');
        return null;
      }
    }
    return {
      name: name,
      description: document.getElementById('template-form-description').value.trim(),
      is_active: document.getElementById('template-form-active').checked,
      stages: stages.map(function (s) {
        return {
          stage_name: s.stage_name.trim(),
          interviewer_role_key: s.interviewer_role_key,
          mode_key: s.mode_key
        };
      })
    };
  }

  async function saveTemplate() {
    if (!canEditTemplates()) return;
    var payload = validateTemplateForm();
    if (!payload) return;

    var btn = document.getElementById('modal-template-save');
    cosmosBtnLoading(btn);
    try {
      if (_editingTemplateId) {
        await apiPut('/api/army/hr/interview-templates/' + _editingTemplateId, payload);
        cosmosBtnSuccess(btn);
        cosmosToastSuccess('Template updated.');
      } else {
        await apiPost('/api/army/hr/interview-templates', payload);
        cosmosBtnSuccess(btn);
        cosmosToastSuccess('Template saved.');
      }
      closeTemplateModal();
      await loadMeta();
      loadInterviewTemplates();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function loadInterviewTemplates() {
    if (!canViewTemplates()) {
      document.getElementById('templates-tbody').innerHTML = '<tr><td colspan="5">No permission to view interview templates.</td></tr>';
      return;
    }
    cosmosSkeletonTable('templates-tbody', 5);
    var q = (document.getElementById('templates-filter-q') || {}).value || '';
    var qs = q ? '?q=' + encodeURIComponent(q) : '';
    try {
      var res = await apiGet('/api/army/hr/interview-templates' + qs);
      _templates = (res.data && res.data.templates) || [];
      renderTemplatesTable();
    } catch (err) {
      cosmosToastError(err.message);
      document.getElementById('templates-tbody').innerHTML = '';
    }
  }

  function renderTemplatesTable() {
    var tbody = document.getElementById('templates-tbody');
    if (!_templates.length) {
      var emptyAction = canEditTemplates()
        ? '<button type="button" class="btn primary" id="templates-empty-create">+ New template</button>'
        : '';
      tbody.innerHTML = '<tr><td colspan="5"><div class="empty"><div class="empty-head">No interview templates yet</div>' +
        '<div class="empty-sub" style="margin-bottom:12px">Create a template to define screening and interview rounds for new hires.</div>' +
        emptyAction + '</div></td></tr>';
      var emptyBtn = document.getElementById('templates-empty-create');
      if (emptyBtn) emptyBtn.addEventListener('click', function () { openTemplateModal(null); });
      return;
    }

    tbody.innerHTML = _templates.map(function (tpl) {
      var stagesText = (tpl.stage_count || 0) + ' stage' + ((tpl.stage_count || 0) === 1 ? '' : 's');
      if (tpl.stages && tpl.stages.length) {
        stagesText += ' · ' + tpl.stages.map(function (s) { return s.stage_name; }).join(' → ');
      } else if (tpl.stages_summary) {
        stagesText = tpl.stages_summary;
      }
      var usedBy = tpl.jobs_using_count ? (tpl.jobs_using_count + ' job' + (tpl.jobs_using_count === 1 ? '' : 's')) : '—';
      var statusBadge = tpl.is_active
        ? '<span class="b b-green">Active</span>'
        : '<span class="b b-gray">Inactive</span>';
      var actions = '';
      if (canEditTemplates()) {
        actions += '<button type="button" class="btn sm" data-tpl-action="edit" data-tpl-id="' + tpl.id + '">Edit</button> ';
        actions += '<button type="button" class="btn sm" data-tpl-action="duplicate" data-tpl-id="' + tpl.id + '">Duplicate</button> ';
        if (tpl.is_active) {
          actions += '<button type="button" class="btn sm" data-tpl-action="deactivate" data-tpl-id="' + tpl.id + '">Deactivate</button>';
        } else {
          actions += '<button type="button" class="btn sm" data-tpl-action="activate" data-tpl-id="' + tpl.id + '">Activate</button>';
        }
      } else {
        actions = '—';
      }
      return '<tr>' +
        '<td><strong>' + escHtml(tpl.name) + '</strong>' +
        (tpl.description ? '<br><span style="font-size:11px;color:var(--text3)">' + escHtml(tpl.description) + '</span>' : '') +
        '</td>' +
        '<td style="max-width:360px">' + escHtml(stagesText) + '</td>' +
        '<td>' + escHtml(usedBy) + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-tpl-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleTemplateAction(btn, btn.getAttribute('data-tpl-id'), btn.getAttribute('data-tpl-action'));
      });
    });
  }

  async function handleTemplateAction(btn, templateId, action) {
    if (!canEditTemplates()) return;
    var id = Number(templateId);
    if (action === 'edit') {
      openTemplateModal(id);
      return;
    }
    cosmosBtnLoading(btn);
    try {
      if (action === 'duplicate') {
        await apiPost('/api/army/hr/interview-templates/' + id + '/duplicate', {});
        cosmosBtnSuccess(btn);
        cosmosToastSuccess('Template duplicated.');
      } else {
        await apiPatch('/api/army/hr/interview-templates/' + id + '/status', { is_active: action === 'activate' });
        cosmosBtnSuccess(btn);
        cosmosToastSuccess(action === 'activate' ? 'Template activated.' : 'Template deactivated.');
      }
      await loadMeta();
      loadInterviewTemplates();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function loadDashboard() {
    if (!canViewJobs() && !canViewCandidates()) {
      cosmosToastWarn('You do not have permission to view hiring data.');
      return;
    }
    try {
      var res = await apiGet('/api/army/hr/dashboard/stats');
      var d = res.data || {};
      cosmosCountUp(document.getElementById('stat-published-jobs'), d.published_jobs || 0);
      cosmosCountUp(document.getElementById('stat-total-apps'), d.total_applications || 0);
      cosmosCountUp(document.getElementById('stat-screening'), d.screening || 0);
      cosmosCountUp(document.getElementById('stat-interview'), d.interview || 0);
    } catch (err) {
      cosmosToastError(err.message);
    }
  }

  async function loadJobOpenings() {
    if (!canViewJobs()) {
      document.getElementById('jobs-tbody').innerHTML = '<tr><td colspan="7">No permission to view job openings.</td></tr>';
      return;
    }
    cosmosSkeletonTable('jobs-tbody', 7);
    var status = (document.getElementById('jobs-filter-status') || {}).value || '';
    var q = (document.getElementById('jobs-filter-q') || {}).value || '';
    var qs = [];
    if (status) qs.push('status=' + encodeURIComponent(status));
    if (q) qs.push('q=' + encodeURIComponent(q));
    try {
      var res = await apiGet('/api/army/hr/job-openings' + (qs.length ? '?' + qs.join('&') : ''));
      _jobs = (res.data && res.data.jobs) || [];
      renderJobsTable();
    } catch (err) {
      cosmosToastError(err.message);
      document.getElementById('jobs-tbody').innerHTML = '';
    }
  }

  function renderJobsTable() {
    var tbody = document.getElementById('jobs-tbody');
    if (!_jobs.length) {
      var emptyAction = canEditJobs()
        ? '<button type="button" class="btn primary" id="jobs-empty-create">+ New opening</button>'
        : '';
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-head">No job openings</div><div class="empty-sub" style="margin-bottom:12px">Create a draft role, then publish it to the careers portal.</div>' + emptyAction + '</div></td></tr>';
      var emptyBtn = document.getElementById('jobs-empty-create');
      if (emptyBtn) emptyBtn.addEventListener('click', function () { openJobModal(null); });
      return;
    }
    tbody.innerHTML = _jobs.map(function (job) {
      var actions = '';
      if (canEditJobs()) {
        if (job.status === 'DRAFT' || job.status === 'PENDING_APPROVAL') {
          actions += '<button type="button" class="btn sm" data-job-action="edit" data-job-id="' + job.id + '">Edit</button> ';
        }
        if (job.status === 'PENDING_APPROVAL' || job.status === 'DRAFT') {
          actions += '<button type="button" class="btn sm primary" data-job-action="publish" data-job-id="' + job.id + '">Publish</button> ';
        }
        if (job.status === 'PUBLISHED') {
          actions += '<button type="button" class="btn sm" data-job-action="close" data-job-id="' + job.id + '">Close</button> ';
        }
      }
      if (!actions) actions = '—';
      return '<tr>' +
        '<td><strong>' + escHtml(job.title) + '</strong><br><span style="font-size:11px;color:var(--text3)">' + escHtml(job.slug) + '</span></td>' +
        '<td>' + escHtml(job.store_name) + '</td>' +
        '<td>' + escHtml(job.department_key) + '</td>' +
        '<td>' + escHtml(job.vacancies) + '</td>' +
        '<td>' + escHtml(job.application_count || 0) + '</td>' +
        '<td>' + jobStatusBadge(job.status) + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    }).join('');

    tbody.querySelectorAll('[data-job-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-job-action');
        var jobId = btn.getAttribute('data-job-id');
        if (action === 'edit') {
          openJobModal(Number(jobId));
          return;
        }
        handleJobAction(btn, jobId, action);
      });
    });
  }

  async function handleJobAction(btn, jobId, action) {
    if (!canEditJobs()) return;
    if (action === 'edit') {
      openJobModal(Number(jobId));
      return;
    }
    var status = action === 'publish' ? 'PUBLISHED' : 'CLOSED';
    cosmosBtnLoading(btn);
    try {
      await apiPatch('/api/army/hr/job-openings/' + jobId + '/status', { status: status });
      cosmosBtnSuccess(btn);
      cosmosToastSuccess(action === 'publish' ? 'Job published to careers portal.' : 'Job closed.');
      loadJobOpenings();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function loadPipeline() {
    if (!canViewCandidates()) {
      document.getElementById('pipeline-board').innerHTML = '<div class="empty"><div class="empty-head">No permission</div><div class="empty-sub">Ask an admin for army.hiring.candidates.view.</div></div>';
      return;
    }
    var board = document.getElementById('pipeline-board');
    board.innerHTML = '';
    cosmosSkeletonRows('pipeline-board', 5);
    var q = (document.getElementById('pipeline-filter-q') || {}).value || '';
    var qs = q ? '?q=' + encodeURIComponent(q) : '';
    try {
      var res = await apiGet('/api/army/hr/applications' + qs);
      _applications = (res.data && res.data.applications) || [];
      renderPipelineBoard();
    } catch (err) {
      cosmosToastError(err.message);
      board.innerHTML = '';
    }
  }

  var PIPELINE_COLUMNS = ['APPLIED', 'SCREENING', 'INTERVIEW', 'SELECTED', 'OFFER_ISSUED'];
  var PIPELINE_OTHER_STATUSES = ['ON_HOLD', 'NOT_SELECTED', 'OFFER_ACCEPTED', 'JOINED'];

  function pipelineBucket(statusKey) {
    if (PIPELINE_COLUMNS.indexOf(statusKey) !== -1) return statusKey;
    if (PIPELINE_OTHER_STATUSES.indexOf(statusKey) !== -1) return 'OTHER';
    return 'OTHER';
  }

  function renderPipelineBoard() {
    var board = document.getElementById('pipeline-board');
    if (!_applications.length) {
      board.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-head">No applications yet</div><div class="empty-sub">Publish a job opening, then candidates who apply on the careers portal will appear here.</div></div>';
      return;
    }

    var columns = PIPELINE_COLUMNS.concat(['OTHER']);
    board.innerHTML = columns.map(function (colKey) {
      var items = _applications.filter(function (a) { return pipelineBucket(a.status_key) === colKey; });
      var colLabel = colKey === 'OTHER' ? 'Other / closed' : appStatusLabel(colKey);
      var cards = items.map(function (app) {
        return '<div class="pipeline-card" data-app-id="' + app.id + '" tabindex="0" role="button">' +
          '<div class="name">' + escHtml(app.candidate.full_name) + '</div>' +
          '<div class="meta">' + escHtml(app.job.title) + '<br>' + escHtml(app.candidate.phone) +
          (colKey === 'OTHER' ? '<br>' + appStatusBadge(app.status_key) : '') +
          '</div>' +
          '</div>';
      }).join('') || '<div style="font-size:12px;color:var(--text3);padding:8px">No candidates</div>';

      return '<div class="pipeline-col">' +
        '<div class="pipeline-col-h"><span>' + escHtml(colLabel) + '</span><span>' + items.length + '</span></div>' +
        '<div class="pipeline-col-b">' + cards + '</div></div>';
    }).join('');

    board.querySelectorAll('.pipeline-card').forEach(function (card) {
      function openDetail() { openCandidateModal(Number(card.getAttribute('data-app-id'))); }
      card.addEventListener('click', openDetail);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); }
      });
    });
  }

  function fmtJoiningAvailability(joining) {
    if (!joining) return '—';
    if (joining.key === 'ON_NOTICE') {
      var parts = [joining.label || 'On notice period'];
      if (joining.notice_period_days) parts.push(joining.notice_period_days + ' days');
      if (joining.expected_join_date) parts.push('joining ' + fmtDate(joining.expected_join_date));
      return parts.join(' · ');
    }
    return joining.label || joining.key || '—';
  }

  async function openCandidateModal(appId) {
    if (!canViewCandidates()) return;
    _activeApplicationId = appId;
    var overlay = document.getElementById('modal-candidate');
    var body = document.getElementById('modal-candidate-body');
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('modal-candidate-body', 4);
    else body.innerHTML = '';
    overlay.classList.add('open');
    try {
      var res = await apiGet('/api/army/hr/applications/' + appId);
      var d = res.data;
      document.getElementById('modal-candidate-title').textContent = d.candidate.full_name;
      document.getElementById('modal-status-select').value = d.status_key;
      document.getElementById('modal-status-save').style.display = canEditCandidates() ? '' : 'none';

      body.innerHTML = renderCandidateDetail(d);

      var downloadBtn = document.getElementById('cand-download-cv');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', function () {
          downloadCandidateResume(appId, downloadBtn);
        });
      }
    } catch (err) {
      body.innerHTML = '<div class="empty"><div class="empty-head">Could not load</div><div class="empty-sub">' + escHtml(err.message) + '</div></div>';
    }
  }

  function detailItem(label, value) {
    return '<div class="detail-item"><label>' + escHtml(label) + '</label><div>' + escHtml(value) + '</div></div>';
  }

  function closeCandidateModal() {
    document.getElementById('modal-candidate').classList.remove('open');
    _activeApplicationId = null;
  }

  async function saveCandidateStatus() {
    if (!canEditCandidates() || !_activeApplicationId) return;
    var btn = document.getElementById('modal-status-save');
    var statusKey = document.getElementById('modal-status-select').value;
    cosmosBtnLoading(btn);
    try {
      await apiPatch('/api/army/hr/applications/' + _activeApplicationId + '/status', { status_key: statusKey });
      cosmosBtnSuccess(btn);
      cosmosToastSuccess('Candidate status updated.');
      await loadPipeline();
      if (_activeApplicationId) await openCandidateModal(_activeApplicationId);
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  function initUserChrome() {
    var u = refreshUserFromSession();
    var name = u.full_name || u.display_name || u.username || 'User';
    var role = u.role_label || u.role || u.role_key || 'Staff';
    var nameEl = document.getElementById('army-user-name');
    var roleEl = document.getElementById('army-user-role');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = role;
    var av = document.getElementById('army-user-av');
    if (av) av.textContent = String(name).trim().charAt(0).toUpperCase() || 'U';
  }

  function bindGlobalActions() {
    document.getElementById('army-refresh-btn').addEventListener('click', function () {
      showPage(pageFromPath());
    });
    var jobsNewBtn = document.getElementById('jobs-new-btn');
    if (jobsNewBtn) jobsNewBtn.addEventListener('click', function () { openJobModal(null); });
    var tplNewBtn = document.getElementById('templates-new-btn');
    if (tplNewBtn) tplNewBtn.addEventListener('click', function () { openTemplateModal(null); });
    document.getElementById('modal-template-close').addEventListener('click', closeTemplateModal);
    document.getElementById('modal-template-cancel').addEventListener('click', closeTemplateModal);
    document.getElementById('modal-template-save').addEventListener('click', saveTemplate);
    document.getElementById('template-add-stage').addEventListener('click', function () {
      var rows = collectTemplateStagesFromDom();
      if (rows.length >= 6) {
        cosmosToastWarn('Maximum 6 stages per template.');
        return;
      }
      rows.push(defaultTemplateStage());
      renderTemplateStages(rows);
    });
    document.getElementById('modal-template').addEventListener('click', function (e) {
      if (e.target.id === 'modal-template') closeTemplateModal();
    });
    document.getElementById('modal-job-close').addEventListener('click', closeJobModal);
    document.getElementById('modal-job-cancel').addEventListener('click', closeJobModal);
    document.getElementById('modal-job-save').addEventListener('click', saveJobOpening);
    document.getElementById('modal-job').addEventListener('click', function (e) {
      if (e.target.id === 'modal-job') closeJobModal();
    });
    ['job-form-title', 'job-form-department', 'job-form-store', 'job-form-vacancies'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', function () {
        el.classList.remove('army-field-invalid');
        if (window.cosmosFieldClear) window.cosmosFieldClear(el);
      });
      el.addEventListener('change', function () {
        el.classList.remove('army-field-invalid');
        if (window.cosmosFieldClear) window.cosmosFieldClear(el);
      });
    });
    document.getElementById('modal-candidate-close').addEventListener('click', closeCandidateModal);
    document.getElementById('modal-candidate').addEventListener('click', function (e) {
      if (e.target.id === 'modal-candidate') closeCandidateModal();
    });
    document.getElementById('modal-status-save').addEventListener('click', saveCandidateStatus);
    window.addEventListener('popstate', function () { showPage(pageFromPath()); });
  }

  async function boot() {
    if (!getToken()) {
      window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname);
      return;
    }
    initUserChrome();
    bindNav();
    bindFilters();
    bindGlobalActions();
    if (typeof window.initCosmosModuleSwitchFooter === 'function') {
      window.initCosmosModuleSwitchFooter(getUser(), { currentModule: 'army' });
    }
    try {
      await loadMeta();
    } catch (err) {
      cosmosToastError(err.message);
    }
    var initial = pageFromPath();
    if (window.location.pathname === '/army/hr') {
      window.history.replaceState({ page: initial }, '', ARMY_PAGE_PATHS[initial]);
    }
    showPage(initial);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
