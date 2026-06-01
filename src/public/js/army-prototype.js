/* Army HR Admin — client shell */
(function armyHrBootstrap() {
  'use strict';

  var ARMY_PAGE_PATHS = {
    dashboard: '/army/hr/dashboard',
    'job-openings': '/army/hr/job-openings',
    pipeline: '/army/hr/pipeline'
  };

  var _user = null;
  var _meta = { job_opening_statuses: [], application_statuses: [], db_ready: false };
  var _jobs = [];
  var _applications = [];
  var _activeApplicationId = null;

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

  function pageFromPath() {
    var p = window.location.pathname.replace(/\/+$/, '');
    if (p === '/army/hr' || p === '/army/hr/dashboard') return 'dashboard';
    if (p.indexOf('/army/hr/job-openings') === 0) return 'job-openings';
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
    var labels = { dashboard: 'Dashboard', 'job-openings': 'Job Openings', pipeline: 'Candidate Pipeline' };
    var bc = document.getElementById('army-breadcrumb');
    if (bc) bc.textContent = labels[pageKey] || 'Dashboard';

    if (pageKey === 'dashboard') loadDashboard();
    if (pageKey === 'job-openings') loadJobOpenings();
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
    if (jobStatus) jobStatus.addEventListener('change', loadJobOpenings);
    if (jobQ) jobQ.addEventListener('input', debounce(loadJobOpenings, 300));
    if (pipeQ) pipeQ.addEventListener('input', debounce(loadPipeline, 300));
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
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-head">No job openings</div><div class="empty-sub">Published roles appear here after migration 78 or from seed data.</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = _jobs.map(function (job) {
      var actions = '';
      if (canEditJobs()) {
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
        handleJobAction(btn, btn.getAttribute('data-job-id'), btn.getAttribute('data-job-action'));
      });
    });
  }

  async function handleJobAction(btn, jobId, action) {
    if (!canEditJobs()) return;
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

  function renderPipelineBoard() {
    var board = document.getElementById('pipeline-board');
    if (!_applications.length) {
      board.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="empty-head">No applications yet</div><div class="empty-sub">Candidates who apply on the careers portal will appear here after migration 78.</div></div>';
      return;
    }

    board.innerHTML = PIPELINE_COLUMNS.map(function (statusKey) {
      var items = _applications.filter(function (a) { return a.status_key === statusKey; });
      var cards = items.map(function (app) {
        return '<div class="pipeline-card" data-app-id="' + app.id + '" tabindex="0" role="button">' +
          '<div class="name">' + escHtml(app.candidate.full_name) + '</div>' +
          '<div class="meta">' + escHtml(app.job.title) + '<br>' + escHtml(app.candidate.phone) + '</div>' +
          '</div>';
      }).join('') || '<div style="font-size:12px;color:var(--text3);padding:8px">No candidates</div>';

      return '<div class="pipeline-col">' +
        '<div class="pipeline-col-h"><span>' + escHtml(appStatusLabel(statusKey)) + '</span><span>' + items.length + '</span></div>' +
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

      body.innerHTML =
        '<div class="detail-grid">' +
        detailItem('Role', d.job.title + ' · ' + d.job.store_name) +
        detailItem('Phone', d.candidate.phone) +
        detailItem('Email', d.candidate.email) +
        detailItem('Applied', fmtDate(d.applied_at)) +
        detailItem('Experience', d.candidate.experience_years + 'y ' + d.candidate.experience_months + 'm') +
        detailItem('Education', d.candidate.education_key || '—') +
        detailItem('Joining', fmtJoiningAvailability(d.joining)) +
        detailItem('Preferred store', d.preferred_store || '—') +
        detailItem('Source', d.candidate.source_key || '—') +
        '</div>' +
        (d.candidate.resume_url
          ? '<p><a class="tr-link" href="' + escHtml(d.candidate.resume_url) + '" target="_blank" rel="noopener">View resume</a></p>'
          : '');
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
      closeCandidateModal();
      loadPipeline();
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
