/* Army HR Admin — client shell */
(function armyHrBootstrap() {
  'use strict';

  var ARMY_PAGE_PATHS = {
    dashboard: '/army/hr/dashboard',
    'job-openings': '/army/hr/job-openings',
    'interview-templates': '/army/hr/interview-templates',
    pipeline: '/army/hr/pipeline',
    employees: '/army/hr/employees'
  };

  var _user = null;
  var _meta = { job_opening_statuses: [], application_statuses: [], db_ready: false };
  var _jobs = [];
  var _templates = [];
  var _employees = [];
  var _applications = [];
  var _activeApplicationId = null;
  var _editingJobId = null;
  var _originalJobTemplateId = null;
  var _editingTemplateId = null;
  var _editingEmployeeId = null;
  var _employeeModalTab = 'personal';
  var _activeEmployeeData = null;
  var _candidateTab = 'profile';
  var _activeCandidateData = null;

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
  function canViewStaff() { return hasPerm('army.staff.view'); }
  function canCreateStaff() { return hasPerm('army.staff.create'); }
  function canEditStaff() { return hasPerm('army.staff.edit'); }

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
  var apiUpload = async function (p, formData) {
    var token = getToken();
    if (!token) {
      window.location.href = '/login.html?next=' + encodeURIComponent(window.location.pathname);
      throw new Error('Not signed in');
    }
    var apiKey = typeof window.cosmosEnsureApiKey === 'function'
      ? await window.cosmosEnsureApiKey()
      : '';
    if (!apiKey) throw new Error('Invalid or missing API key');
    var res = await fetch(p, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Authorization': 'Bearer ' + token },
      body: formData
    });
    var data;
    try { data = await res.json(); } catch (_) { data = {}; }
    if (!res.ok) throw new Error((data && data.message) || ('HTTP ' + res.status));
    return data;
  };

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

  function fmtDateTime(value) {
    if (!value) return '—';
    var d = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  function parseScheduledParts(scheduledAt) {
    if (!scheduledAt) return { date: '', time: '' };
    var raw = String(scheduledAt).replace(' ', 'T');
    var m = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (!m) return { date: '', time: '' };
    return { date: m[1], time: m[2] };
  }

  function renderCandidateTabs(activeTab) {
    return '<div class="cand-tabs" role="tablist">' +
      '<button type="button" class="cand-tab' + (activeTab === 'profile' ? ' active' : '') + '" data-cand-tab="profile" role="tab">Profile</button>' +
      '<button type="button" class="cand-tab' + (activeTab === 'interviews' ? ' active' : '') + '" data-cand-tab="interviews" role="tab">Interviews</button>' +
      '</div>';
  }

  function renderInterviewRatingSummary(rating) {
    if (!rating) return '';
    var params = _meta.rubric_parameters || [];
    var scoresHtml = params.map(function (p) {
      var val = rating.scores && rating.scores[p.key];
      return '<div class="int-rubric-score"><span>' + escHtml(p.label) + '</span><strong>' + escHtml(String(val != null ? val : '—')) + '</strong></div>';
    }).join('');
    return '<div class="int-rating-summary">' +
      '<div class="int-rating-head"><span class="b ' + escHtml(rating.recommendation_badge_class || 'b-gray') + '">' +
      escHtml(rating.recommendation_label || rating.recommendation_key) + '</span>' +
      '<span>Avg <strong>' + escHtml(String(rating.aggregate_score)) + '</strong> / 10</span></div>' +
      '<div class="int-rubric-grid">' + scoresHtml + '</div>' +
      '<div class="int-rating-notes"><label>Notes</label><div>' + escHtml(rating.notes) + '</div></div></div>';
  }

  function renderInterviewRatingForm(interviewId, existingRating) {
    if (!canEditCandidates()) return existingRating ? renderInterviewRatingSummary(existingRating) : '';
    var params = _meta.rubric_parameters || [];
    var scoresHtml = params.map(function (p) {
      var val = existingRating && existingRating.scores ? existingRating.scores[p.key] : '';
      return '<label class="army-form-field int-rubric-field"><span>' + escHtml(p.label) + ' (1–10)</span>' +
        '<input type="number" min="1" max="10" class="army-form-input int-rubric-input" data-rubric-key="' + escHtml(p.key) + '" value="' + escHtml(val !== '' && val != null ? String(val) : '') + '"></label>';
    }).join('');
    var recOpts = (_meta.interview_recommendations || []).map(function (r) {
      var sel = existingRating && existingRating.recommendation_key === r.key ? ' selected' : '';
      return '<option value="' + escHtml(r.key) + '"' + sel + '>' + escHtml(r.label) + '</option>';
    }).join('');
    return '<div class="int-rating-form" data-interview-id="' + interviewId + '">' +
      '<div class="cand-section-title" style="margin-top:12px">Interview rubric</div>' +
      '<div class="int-rubric-grid int-rubric-form-grid">' + scoresHtml + '</div>' +
      '<label class="army-form-field"><span>Interviewer notes</span>' +
      '<textarea class="army-form-input army-form-textarea int-rating-notes-input" rows="3" placeholder="Required">' +
      escHtml(existingRating ? existingRating.notes : '') + '</textarea></label>' +
      '<label class="army-form-field"><span>Recommendation</span>' +
      '<select class="army-form-input int-rating-rec-select"><option value="">Select…</option>' + recOpts + '</select></label>' +
      '<button type="button" class="btn primary sm int-save-rating" data-interview-id="' + interviewId + '">Save rating</button>' +
      '</div>';
  }

  function renderInterviewStageCard(interview, index) {
    var badgeClass = interview.status_badge_class || 'b-gray';
    var parts = parseScheduledParts(interview.scheduled_at);
    var canEdit = canEditCandidates();
    var scheduleBlock = '';
    if (canEdit && interview.status_key !== 'COMPLETED' && interview.status_key !== 'SKIPPED') {
      scheduleBlock =
        '<div class="int-schedule-form" data-interview-id="' + interview.id + '">' +
        '<div class="int-schedule-row">' +
        '<label class="army-form-field"><span>Date</span><input type="date" class="army-form-input int-sched-date" value="' + escHtml(parts.date) + '"></label>' +
        '<label class="army-form-field"><span>Time (IST)</span><input type="time" class="army-form-input int-sched-time" value="' + escHtml(parts.time) + '"></label>' +
        '<label class="army-form-field int-sched-loc"><span>Location</span><input type="text" class="army-form-input int-sched-location" maxlength="200" placeholder="Store / office" value="' + escHtml(interview.location || '') + '"></label>' +
        '</div>' +
        '<div class="int-schedule-actions">' +
        '<button type="button" class="btn primary sm int-save-schedule" data-interview-id="' + interview.id + '">Save schedule</button>' +
        (interview.status_key === 'SCHEDULED'
          ? ' <button type="button" class="btn sm int-rate-btn" data-interview-id="' + interview.id + '">Submit rating</button>'
          : '') +
        ' <button type="button" class="btn sm int-skip-btn" data-interview-id="' + interview.id + '">Mark skipped</button>' +
        '</div></div>';
    } else if (interview.scheduled_at) {
      scheduleBlock = '<div class="int-scheduled-meta">' +
        '<span>📅 ' + escHtml(fmtDateTime(interview.scheduled_at)) + '</span>' +
        (interview.location ? '<span>📍 ' + escHtml(interview.location) + '</span>' : '') +
        '</div>';
    }

    var ratingBlock = '';
    if (interview.rating) {
      ratingBlock = renderInterviewRatingSummary(interview.rating);
    } else if (canEdit && interview.status_key === 'SCHEDULED') {
      ratingBlock = '<div class="int-rating-panel hidden" id="int-rating-panel-' + interview.id + '">' +
        renderInterviewRatingForm(interview.id, null) + '</div>';
    }

    return '<div class="int-stage-card" data-interview-id="' + interview.id + '">' +
      '<div class="int-stage-head">' +
      '<span class="int-stage-num">' + (index + 1) + '</span>' +
      '<div class="int-stage-main"><strong>' + escHtml(interview.stage_name) + '</strong>' +
      '<div class="int-stage-sub">' + escHtml(interviewerRoleLabel(interview.interviewer_role_key)) +
      ' · ' + escHtml(interview.mode_label || interview.mode_key) + '</div></div>' +
      '<span class="b ' + escHtml(badgeClass) + '">' + escHtml(interview.status_label || interview.status_key) + '</span>' +
      '</div>' + scheduleBlock + ratingBlock + '</div>';
  }

  function renderCandidateInterviews(d) {
    var interviews = d.interviews || [];
    if (!interviews.length) {
      return '<div class="empty" style="padding:24px 0"><div class="empty-head">No interview stages</div>' +
        '<div class="empty-sub">Stages appear when the job opening has an interview template and the candidate applied after it was set.</div></div>';
    }
    return '<div class="int-timeline">' + interviews.map(renderInterviewStageCard).join('') + '</div>';
  }

  function renderCandidateModalBody(d) {
    return renderCandidateTabs(_candidateTab) +
      '<div class="cand-tab-panel">' +
      (_candidateTab === 'interviews' ? renderCandidateInterviews(d) : renderCandidateDetail(d)) +
      '</div>';
  }

  function bindCandidateModalEvents(d) {
    document.querySelectorAll('[data-cand-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _candidateTab = btn.getAttribute('data-cand-tab') || 'profile';
        var body = document.getElementById('modal-candidate-body');
        if (body && _activeCandidateData) {
          body.innerHTML = renderCandidateModalBody(_activeCandidateData);
          bindCandidateModalEvents(_activeCandidateData);
        }
      });
    });

    var downloadBtn = document.getElementById('cand-download-cv');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        downloadCandidateResume(d.id, downloadBtn);
      });
    }

    document.querySelectorAll('.int-save-schedule').forEach(function (btn) {
      btn.addEventListener('click', function () { saveInterviewSchedule(Number(btn.getAttribute('data-interview-id')), btn); });
    });
    document.querySelectorAll('.int-skip-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { markInterviewSkipped(Number(btn.getAttribute('data-interview-id')), btn); });
    });
    document.querySelectorAll('.int-rate-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-interview-id');
        var panel = document.getElementById('int-rating-panel-' + id);
        if (panel) panel.classList.toggle('hidden');
      });
    });
    document.querySelectorAll('.int-save-rating').forEach(function (btn) {
      btn.addEventListener('click', function () { saveInterviewRating(Number(btn.getAttribute('data-interview-id')), btn); });
    });
  }

  async function saveInterviewSchedule(interviewId, btn) {
    if (!canEditCandidates() || !_activeApplicationId) return;
    var form = document.querySelector('.int-schedule-form[data-interview-id="' + interviewId + '"]');
    if (!form) return;
    var dateEl = form.querySelector('.int-sched-date');
    var timeEl = form.querySelector('.int-sched-time');
    var locEl = form.querySelector('.int-sched-location');
    var dateVal = dateEl.value.trim();
    var timeVal = timeEl.value.trim();
    if (!dateVal || !timeVal) {
      if (!dateVal && window.cosmosFieldError) window.cosmosFieldError(dateEl, 'Required');
      if (!timeVal && window.cosmosFieldError) window.cosmosFieldError(timeEl, 'Required');
      cosmosToastWarn('Enter date and time for the interview.');
      return;
    }
    cosmosBtnLoading(btn);
    try {
      await apiPatch('/api/army/hr/applications/' + _activeApplicationId + '/interviews/' + interviewId, {
        scheduled_at: dateVal + 'T' + timeVal,
        location: locEl.value.trim()
      });
      cosmosBtnSuccess(btn);
      cosmosToastSuccess('Interview scheduled.');
      await refreshCandidateModal();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function markInterviewSkipped(interviewId, btn) {
    if (!canEditCandidates() || !_activeApplicationId) return;
    cosmosBtnLoading(btn);
    try {
      await apiPatch('/api/army/hr/applications/' + _activeApplicationId + '/interviews/' + interviewId, {
        status_key: 'SKIPPED'
      });
      cosmosBtnSuccess(btn);
      cosmosToastSuccess('Stage marked as skipped.');
      await refreshCandidateModal();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function saveInterviewRating(interviewId, btn) {
    if (!canEditCandidates() || !_activeApplicationId) return;
    var form = btn.closest('.int-rating-form');
    if (!form) return;
    var scores = {};
    var valid = true;
    form.querySelectorAll('.int-rubric-input').forEach(function (input) {
      var key = input.getAttribute('data-rubric-key');
      var num = Number(input.value);
      if (!key || !Number.isFinite(num) || num < 1 || num > 10) {
        valid = false;
        if (window.cosmosFieldError) window.cosmosFieldError(input, '1–10');
      } else {
        scores[key] = num;
        if (window.cosmosFieldClear) window.cosmosFieldClear(input);
      }
    });
    var notesEl = form.querySelector('.int-rating-notes-input');
    var recEl = form.querySelector('.int-rating-rec-select');
    var notes = notesEl ? notesEl.value.trim() : '';
    var rec = recEl ? recEl.value : '';
    if (!notes && notesEl && window.cosmosFieldError) window.cosmosFieldError(notesEl, 'Required');
    if (!rec && recEl && window.cosmosFieldError) window.cosmosFieldError(recEl, 'Required');
    if (!valid || !notes || !rec) {
      cosmosToastWarn('Complete all rubric scores, notes, and recommendation.');
      return;
    }
    cosmosBtnLoading(btn);
    try {
      await apiPut('/api/army/hr/applications/' + _activeApplicationId + '/interviews/' + interviewId + '/rating', {
        scores: scores,
        notes: notes,
        recommendation_key: rec
      });
      cosmosBtnSuccess(btn);
      cosmosToastSuccess('Rating saved.');
      await refreshCandidateModal();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function refreshCandidateModal() {
    if (!_activeApplicationId) return;
    try {
      var res = await apiGet('/api/army/hr/applications/' + _activeApplicationId);
      _activeCandidateData = res.data;
      var body = document.getElementById('modal-candidate-body');
      if (body) {
        body.innerHTML = renderCandidateModalBody(_activeCandidateData);
        bindCandidateModalEvents(_activeCandidateData);
      }
    } catch (err) {
      cosmosToastError(err.message);
    }
  }

  function pageFromPath() {
    var p = window.location.pathname.replace(/\/+$/, '');
    if (p === '/army/hr' || p === '/army/hr/dashboard') return 'dashboard';
    if (p.indexOf('/army/hr/job-openings') === 0) return 'job-openings';
    if (p.indexOf('/army/hr/interview-templates') === 0) return 'interview-templates';
    if (p.indexOf('/army/hr/pipeline') === 0) return 'pipeline';
    if (p.indexOf('/army/hr/employees') === 0) return 'employees';
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
      pipeline: 'Candidate Pipeline',
      employees: 'Employees'
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
    if (pageKey === 'employees') {
      syncEmployeesNewBtn();
      loadEmployeeStats();
      loadEmployees();
    }
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
    var empStatus = document.getElementById('employees-filter-status');
    var empQ = document.getElementById('employees-filter-q');
    if (empStatus) empStatus.addEventListener('change', loadEmployees);
    if (empQ) empQ.addEventListener('input', debounce(loadEmployees, 300));
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
    populateEmployeeFilters();
    syncJobsNewBtn();
    syncTemplatesNav();
    syncEmployeesNav();
  }

  function syncEmployeesNav() {
    var nav = document.getElementById('nav-employees');
    if (nav) nav.hidden = !canViewStaff();
  }

  function syncEmployeesNewBtn() {
    var btn = document.getElementById('employees-new-btn');
    if (btn) btn.hidden = !canCreateStaff();
  }

  function populateEmployeeFilters() {
    var statusSel = document.getElementById('employees-filter-status');
    if (statusSel && statusSel.options.length <= 1) {
      (_meta.employee_statuses || []).forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = s.label;
        statusSel.appendChild(opt);
      });
    }
    var empStatusModal = document.getElementById('employee-status-select');
    if (empStatusModal && empStatusModal.options.length === 0) {
      (_meta.employee_statuses || []).forEach(function (s) {
        var opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = s.label;
        empStatusModal.appendChild(opt);
      });
    }
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

  function showEmployeeFormError(message) {
    var el = document.getElementById('modal-employee-error');
    if (!el) return;
    if (!message) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = message;
    el.hidden = false;
  }

  function buildSelectOptions(catalog, selected, placeholder) {
    var html = placeholder ? '<option value="">' + escHtml(placeholder) + '</option>' : '';
    return html + (catalog || []).map(function (row) {
      var sel = selected === row.key ? ' selected' : '';
      return '<option value="' + escHtml(row.key) + '"' + sel + '>' + escHtml(row.label) + '</option>';
    }).join('');
  }

  function renderEmployeePersonalForm(emp) {
    emp = emp || {};
    return '<div class="army-job-form">' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">Full name *</span>' +
      '<input id="emp-form-name" class="army-form-input" type="text" maxlength="120" value="' + escHtml(emp.full_name || '') + '"></label>' +
      '<label class="army-form-field"><span class="army-form-label">Phone *</span>' +
      '<input id="emp-form-phone" class="army-form-input" type="tel" maxlength="15" value="' + escHtml(emp.phone || '') + '"></label></div>' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">Email</span>' +
      '<input id="emp-form-email" class="army-form-input" type="email" value="' + escHtml(emp.email || '') + '"></label>' +
      '<label class="army-form-field"><span class="army-form-label">Date of birth</span>' +
      '<input id="emp-form-dob" class="army-form-input" type="date" value="' + escHtml(emp.dob || '') + '"></label></div>' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">Gender</span>' +
      '<select id="emp-form-gender" class="army-form-input">' + buildSelectOptions(_meta.employee_genders, emp.gender_key, 'Select') + '</select></label>' +
      '<label class="army-form-field"><span class="army-form-label">Blood group</span>' +
      '<select id="emp-form-blood" class="army-form-input">' + buildSelectOptions(_meta.employee_blood_groups, emp.blood_group_key, 'Select') + '</select></label></div>' +
      '<label class="army-form-field"><span class="army-form-label">Current address</span>' +
      '<textarea id="emp-form-address-current" class="army-form-input army-form-textarea" rows="2">' + escHtml(emp.address_current || '') + '</textarea></label>' +
      '<label class="army-form-field"><span class="army-form-label">Permanent address</span>' +
      '<textarea id="emp-form-address-permanent" class="army-form-input army-form-textarea" rows="2">' + escHtml(emp.address_permanent || '') + '</textarea></label>' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">Emergency contact</span>' +
      '<input id="emp-form-em-name" class="army-form-input" type="text" value="' + escHtml(emp.emergency_contact_name || '') + '"></label>' +
      '<label class="army-form-field"><span class="army-form-label">Relation</span>' +
      '<input id="emp-form-em-relation" class="army-form-input" type="text" value="' + escHtml(emp.emergency_contact_relation || '') + '"></label></div>' +
      '<label class="army-form-field"><span class="army-form-label">Emergency phone</span>' +
      '<input id="emp-form-em-phone" class="army-form-input" type="tel" value="' + escHtml(emp.emergency_contact_phone || '') + '"></label>' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">Store</span>' +
      '<select id="emp-form-store" class="army-form-input"><option value="">Select store</option>' +
      (_meta.stores || []).map(function (s) {
        var sel = emp.store_id && String(emp.store_id) === String(s.store_id) ? ' selected' : '';
        return '<option value="' + escHtml(String(s.store_id)) + '"' + sel + '>' + escHtml(s.store_name) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="army-form-field"><span class="army-form-label">Department</span>' +
      '<select id="emp-form-department" class="army-form-input">' + buildSelectOptions((_meta.departments && _meta.departments.departments) || [], emp.department_key, 'Select') + '</select></label></div>' +
      '<label class="army-form-field"><span class="army-form-label">Job title</span>' +
      '<input id="emp-form-job-title" class="army-form-input" type="text" value="' + escHtml(emp.job_title || '') + '"></label>' +
      '</div>';
  }

  function renderEmployeeIdsForm(emp) {
    emp = emp || {};
    return '<div class="army-job-form">' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">Aadhaar number</span>' +
      '<input id="emp-form-aadhaar" class="army-form-input" type="text" maxlength="12" value="' + escHtml(emp.aadhaar_number || '') + '"></label>' +
      '<label class="army-form-field"><span class="army-form-label">PAN</span>' +
      '<input id="emp-form-pan" class="army-form-input" type="text" maxlength="10" value="' + escHtml(emp.pan_number || '') + '"></label></div>' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">Bank name</span>' +
      '<input id="emp-form-bank-name" class="army-form-input" type="text" value="' + escHtml(emp.bank_name || '') + '"></label>' +
      '<label class="army-form-field"><span class="army-form-label">Account number</span>' +
      '<input id="emp-form-bank-acct" class="army-form-input" type="text" value="' + escHtml(emp.bank_account_number || '') + '"></label></div>' +
      '<div class="army-form-row">' +
      '<label class="army-form-field"><span class="army-form-label">IFSC</span>' +
      '<input id="emp-form-bank-ifsc" class="army-form-input" type="text" maxlength="11" value="' + escHtml(emp.bank_ifsc || '') + '"></label>' +
      '<label class="army-form-field"><span class="army-form-label">Account type</span>' +
      '<select id="emp-form-bank-type" class="army-form-input">' + buildSelectOptions(_meta.employee_bank_account_types, emp.bank_account_type_key, 'Select') + '</select></label></div>' +
      '</div>';
  }

  function renderEmployeeOnboardingPanel(emp) {
    emp = emp || {};
    var items = emp.onboarding || _meta.employee_onboarding_items || [];
    if (!items.length) {
      return '<div class="empty-sub">Onboarding checklist will appear after the employee is saved.</div>';
    }
    var pct = emp.onboarding_progress_pct != null ? emp.onboarding_progress_pct : 0;
    var rows = items.map(function (item) {
      return '<label class="emp-onboard-row">' +
        '<input type="checkbox" class="emp-onboard-check" data-item-key="' + escHtml(item.item_key) + '"' +
        (item.is_complete ? ' checked' : '') + (canEditStaff() ? '' : ' disabled') + '>' +
        '<span>' + escHtml(item.label) + '</span></label>';
    }).join('');
    return '<div class="emp-onboard-progress"><strong>' + pct + '%</strong> complete</div>' +
      '<div class="emp-onboard-list">' + rows + '</div>';
  }

  function renderEmployeeDocumentsPanel(emp) {
    emp = emp || {};
    if (!_editingEmployeeId) {
      return '<div class="empty-sub">Save the employee first, then upload documents.</div>';
    }
    var docs = emp.documents || [];
    var uploadBlock = canEditStaff()
      ? '<div class="emp-doc-upload">' +
        '<label class="army-form-field"><span class="army-form-label">Document type</span>' +
        '<select id="emp-doc-type" class="army-form-input">' +
        buildSelectOptions(_meta.employee_document_types, '', 'Select type') + '</select></label>' +
        '<label class="army-form-field"><span class="army-form-label">File</span>' +
        '<input id="emp-doc-file" class="army-form-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"></label>' +
        '<button type="button" class="btn primary sm" id="emp-doc-upload-btn">Upload document</button></div>'
      : '';
    var list = docs.length
      ? '<table class="emp-doc-table"><thead><tr><th>Type</th><th>File</th><th>Verified</th><th></th></tr></thead><tbody>' +
        docs.map(function (d) {
          var verifyBtn = canEditStaff()
            ? '<button type="button" class="btn sm emp-doc-verify" data-doc-id="' + d.id + '" data-verified="' + (d.is_verified ? '0' : '1') + '">' +
              (d.is_verified ? 'Unverify' : 'Verify') + '</button>'
            : '';
          return '<tr><td>' + escHtml(d.doc_type_label) + '</td>' +
            '<td><a class="tr-link" href="' + escHtml(d.file_url) + '" target="_blank" rel="noopener">' + escHtml(d.file_name) + '</a></td>' +
            '<td>' + (d.is_verified ? '<span class="b b-green">Yes</span>' : '<span class="b b-gray">No</span>') + '</td>' +
            '<td>' + verifyBtn + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<div class="empty-sub" style="margin:12px 0">No documents uploaded yet.</div>';
    return uploadBlock + list;
  }

  function renderEmployeeModalPanel(emp) {
    if (_employeeModalTab === 'ids') return renderEmployeeIdsForm(emp);
    if (_employeeModalTab === 'onboarding') return renderEmployeeOnboardingPanel(emp);
    if (_employeeModalTab === 'documents') return renderEmployeeDocumentsPanel(emp);
    return renderEmployeePersonalForm(emp);
  }

  function collectEmployeeFormPayload(base) {
    base = base || {};
    function val(id, key) {
      var el = document.getElementById(id);
      if (!el) return base[key] != null ? base[key] : '';
      return el.value;
    }
    return {
      full_name: val('emp-form-name', 'full_name'),
      phone: val('emp-form-phone', 'phone'),
      email: val('emp-form-email', 'email') || null,
      dob: val('emp-form-dob', 'dob') || null,
      gender_key: val('emp-form-gender', 'gender_key') || null,
      blood_group_key: val('emp-form-blood', 'blood_group_key') || null,
      address_current: val('emp-form-address-current', 'address_current'),
      address_permanent: val('emp-form-address-permanent', 'address_permanent'),
      emergency_contact_name: val('emp-form-em-name', 'emergency_contact_name'),
      emergency_contact_relation: val('emp-form-em-relation', 'emergency_contact_relation'),
      emergency_contact_phone: val('emp-form-em-phone', 'emergency_contact_phone'),
      store_id: val('emp-form-store', 'store_id') || null,
      department_key: val('emp-form-department', 'department_key') || null,
      job_title: val('emp-form-job-title', 'job_title'),
      aadhaar_number: val('emp-form-aadhaar', 'aadhaar_number'),
      pan_number: val('emp-form-pan', 'pan_number'),
      bank_name: val('emp-form-bank-name', 'bank_name'),
      bank_account_number: val('emp-form-bank-acct', 'bank_account_number'),
      bank_ifsc: val('emp-form-bank-ifsc', 'bank_ifsc'),
      bank_account_type_key: val('emp-form-bank-type', 'bank_account_type_key') || null
    };
  }

  function bindEmployeeModalEvents(emp) {
    document.querySelectorAll('[data-emp-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _employeeModalTab = btn.getAttribute('data-emp-tab') || 'personal';
        document.querySelectorAll('[data-emp-tab]').forEach(function (b) {
          b.classList.toggle('active', b.getAttribute('data-emp-tab') === _employeeModalTab);
        });
        var panel = document.getElementById('employee-modal-panel');
        if (panel) panel.innerHTML = renderEmployeeModalPanel(emp);
        bindEmployeeModalEvents(emp);
      });
    });
    document.querySelectorAll('.emp-onboard-check').forEach(function (cb) {
      cb.addEventListener('change', function () {
        toggleOnboardingItem(cb.getAttribute('data-item-key'), cb.checked, cb);
      });
    });
    var uploadBtn = document.getElementById('emp-doc-upload-btn');
    if (uploadBtn) uploadBtn.addEventListener('click', uploadEmployeeDocument);
    document.querySelectorAll('.emp-doc-verify').forEach(function (btn) {
      btn.addEventListener('click', function () {
        verifyEmployeeDocument(Number(btn.getAttribute('data-doc-id')), btn.getAttribute('data-verified') === '1', btn);
      });
    });
  }

  async function loadEmployeeStats() {
    if (!canViewStaff()) return;
    var grid = document.getElementById('employees-stats-grid');
    try {
      var res = await apiGet('/api/army/hr/employees/stats');
      var d = res.data || {};
      if (grid) grid.hidden = false;
      cosmosCountUp(document.getElementById('stat-emp-total'), d.total_employees || 0);
      cosmosCountUp(document.getElementById('stat-emp-onboarding'), d.onboarding || 0);
      cosmosCountUp(document.getElementById('stat-emp-active'), d.active || 0);
    } catch (_) {
      if (grid) grid.hidden = true;
    }
  }

  async function loadEmployees() {
    if (!canViewStaff()) {
      document.getElementById('employees-tbody').innerHTML = '<tr><td colspan="6">No permission to view employees.</td></tr>';
      return;
    }
    if (!_meta.employees_tables_ready) {
      document.getElementById('employees-tbody').innerHTML = '<tr><td colspan="6">Employee tables not deployed — run npm run migrate:82-army-employees-s5</td></tr>';
      return;
    }
    cosmosSkeletonTable('employees-tbody', 6);
    var status = (document.getElementById('employees-filter-status') || {}).value || '';
    var q = (document.getElementById('employees-filter-q') || {}).value || '';
    var qs = [];
    if (status) qs.push('status=' + encodeURIComponent(status));
    if (q) qs.push('q=' + encodeURIComponent(q));
    try {
      var res = await apiGet('/api/army/hr/employees' + (qs.length ? '?' + qs.join('&') : ''));
      _employees = (res.data && res.data.employees) || [];
      renderEmployeesTable();
    } catch (err) {
      cosmosToastError(err.message);
      document.getElementById('employees-tbody').innerHTML = '';
    }
  }

  function renderEmployeesTable() {
    var tbody = document.getElementById('employees-tbody');
    if (!_employees.length) {
      var emptyAction = canCreateStaff()
        ? '<button type="button" class="btn primary" id="employees-empty-create">+ New employee</button>'
        : '';
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty"><div class="empty-head">No employees yet</div>' +
        '<div class="empty-sub" style="margin-bottom:12px">Create an employee profile to start onboarding.</div>' +
        emptyAction + '</div></td></tr>';
      var emptyBtn = document.getElementById('employees-empty-create');
      if (emptyBtn) emptyBtn.addEventListener('click', function () { openEmployeeModal(null); });
      return;
    }
    tbody.innerHTML = _employees.map(function (emp) {
      return '<tr class="tr-link" data-emp-id="' + emp.id + '">' +
        '<td><strong>' + escHtml(emp.employee_code) + '</strong></td>' +
        '<td>' + escHtml(emp.full_name) + '</td>' +
        '<td>' + escHtml(emp.store_name || '—') + '</td>' +
        '<td>' + escHtml(emp.job_title || '—') + '</td>' +
        '<td>' + escHtml(String(emp.onboarding_progress_pct || 0)) + '%</td>' +
        '<td><span class="b ' + escHtml(emp.status_badge_class || 'b-gray') + '">' + escHtml(emp.status_label || emp.status_key) + '</span></td>' +
        '</tr>';
    }).join('');
    tbody.querySelectorAll('tr[data-emp-id]').forEach(function (tr) {
      tr.addEventListener('click', function () { openEmployeeModal(Number(tr.getAttribute('data-emp-id'))); });
    });
  }

  function closeEmployeeModal() {
    document.getElementById('modal-employee').classList.remove('open');
    _editingEmployeeId = null;
    _employeeModalTab = 'personal';
    showEmployeeFormError('');
  }

  async function openEmployeeModal(employeeId) {
    if (employeeId && !canViewStaff()) return;
    if (!employeeId && !canCreateStaff()) return;
    showEmployeeFormError('');
    _editingEmployeeId = employeeId || null;
    _employeeModalTab = 'personal';
    var emp = {};
    var titleEl = document.getElementById('modal-employee-title');
    var saveBtn = document.getElementById('modal-employee-save');
    var statusSel = document.getElementById('employee-status-select');
    if (_editingEmployeeId) {
      try {
        var res = await apiGet('/api/army/hr/employees/' + _editingEmployeeId);
        emp = res.data || {};
        _activeEmployeeData = emp;
      } catch (err) {
        cosmosToastError(err.message);
        return;
      }
      if (titleEl) titleEl.textContent = emp.full_name + ' · ' + emp.employee_code;
      if (saveBtn) { saveBtn.textContent = 'Save changes'; saveBtn.hidden = !canEditStaff(); }
      if (statusSel) { statusSel.hidden = !canEditStaff(); statusSel.value = emp.status_key || 'ONBOARDING'; }
    } else {
      _activeEmployeeData = null;
      if (titleEl) titleEl.textContent = 'New employee';
      if (saveBtn) { saveBtn.textContent = 'Create employee'; saveBtn.hidden = false; }
      if (statusSel) statusSel.hidden = true;
    }
    document.querySelectorAll('[data-emp-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-emp-tab') === 'personal');
      b.hidden = !_editingEmployeeId && b.getAttribute('data-emp-tab') !== 'personal';
      if (_editingEmployeeId) b.hidden = false;
    });
    document.getElementById('employee-modal-panel').innerHTML = renderEmployeeModalPanel(emp);
    bindEmployeeModalEvents(emp);
    document.getElementById('modal-employee').classList.add('open');
  }

  async function saveEmployee() {
    if (!_editingEmployeeId && !canCreateStaff()) return;
    if (_editingEmployeeId && !canEditStaff()) return;
    showEmployeeFormError('');
    var payload = collectEmployeeFormPayload(_activeEmployeeData || {});
    if (!payload.full_name.trim()) {
      if (window.cosmosFieldError) window.cosmosFieldError(document.getElementById('emp-form-name'), 'Required');
      showEmployeeFormError('Full name is required.');
      return;
    }
    var btn = document.getElementById('modal-employee-save');
    cosmosBtnLoading(btn);
    try {
      if (_editingEmployeeId) {
        await apiPut('/api/army/hr/employees/' + _editingEmployeeId, payload);
        var statusKey = (document.getElementById('employee-status-select') || {}).value;
        if (statusKey) await apiPatch('/api/army/hr/employees/' + _editingEmployeeId + '/status', { status_key: statusKey });
        cosmosBtnSuccess(btn);
        cosmosToastSuccess('Employee updated.');
        await openEmployeeModal(_editingEmployeeId);
      } else {
        var created = await apiPost('/api/army/hr/employees', payload);
        cosmosBtnSuccess(btn);
        cosmosToastSuccess('Employee created.');
        closeEmployeeModal();
        _editingEmployeeId = created.data && created.data.id;
        if (_editingEmployeeId) await openEmployeeModal(_editingEmployeeId);
      }
      loadEmployees();
      loadEmployeeStats();
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function toggleOnboardingItem(itemKey, isComplete, cb) {
    if (!canEditStaff() || !_editingEmployeeId) return;
    try {
      await apiPatch('/api/army/hr/employees/' + _editingEmployeeId + '/onboarding/' + itemKey, { is_complete: isComplete });
      var res = await apiGet('/api/army/hr/employees/' + _editingEmployeeId);
      var emp = res.data;
      document.getElementById('employee-modal-panel').innerHTML = renderEmployeeModalPanel(emp);
      bindEmployeeModalEvents(emp);
      loadEmployees();
    } catch (err) {
      if (cb) cb.checked = !isComplete;
      cosmosToastError(err.message);
    }
  }

  async function uploadEmployeeDocument() {
    if (!canEditStaff() || !_editingEmployeeId) return;
    var typeEl = document.getElementById('emp-doc-type');
    var fileEl = document.getElementById('emp-doc-file');
    var btn = document.getElementById('emp-doc-upload-btn');
    if (!typeEl.value) {
      if (window.cosmosFieldError) window.cosmosFieldError(typeEl, 'Required');
      cosmosToastWarn('Select document type.');
      return;
    }
    if (!fileEl.files || !fileEl.files[0]) {
      if (window.cosmosFieldError) window.cosmosFieldError(fileEl, 'Required');
      cosmosToastWarn('Choose a file to upload.');
      return;
    }
    var fd = new FormData();
    fd.append('doc_type_key', typeEl.value);
    fd.append('document', fileEl.files[0]);
    cosmosBtnLoading(btn);
    try {
      await apiUpload('/api/army/hr/employees/' + _editingEmployeeId + '/documents', fd);
      cosmosBtnSuccess(btn);
      cosmosToastSuccess('Document uploaded.');
      await openEmployeeModal(_editingEmployeeId);
      _employeeModalTab = 'documents';
      document.querySelectorAll('[data-emp-tab]').forEach(function (b) {
        b.classList.toggle('active', b.getAttribute('data-emp-tab') === 'documents');
      });
      var res = await apiGet('/api/army/hr/employees/' + _editingEmployeeId);
      document.getElementById('employee-modal-panel').innerHTML = renderEmployeeModalPanel(res.data);
      bindEmployeeModalEvents(res.data);
    } catch (err) {
      cosmosBtnDone(btn);
      cosmosToastError(err.message);
    }
  }

  async function verifyEmployeeDocument(docId, isVerified, btn) {
    if (!canEditStaff() || !_editingEmployeeId) return;
    cosmosBtnLoading(btn);
    try {
      await apiPatch('/api/army/hr/employees/' + _editingEmployeeId + '/documents/' + docId + '/verify', { is_verified: isVerified });
      cosmosBtnSuccess(btn);
      await openEmployeeModal(_editingEmployeeId);
      _employeeModalTab = 'documents';
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
    _candidateTab = 'profile';
    var overlay = document.getElementById('modal-candidate');
    var body = document.getElementById('modal-candidate-body');
    if (typeof cosmosSkeletonRows === 'function') cosmosSkeletonRows('modal-candidate-body', 4);
    else body.innerHTML = '';
    overlay.classList.add('open');
    try {
      var res = await apiGet('/api/army/hr/applications/' + appId);
      var d = res.data;
      _activeCandidateData = d;
      document.getElementById('modal-candidate-title').textContent = d.candidate.full_name;
      document.getElementById('modal-status-select').value = d.status_key;
      document.getElementById('modal-status-save').style.display = canEditCandidates() ? '' : 'none';

      body.innerHTML = renderCandidateModalBody(d);
      bindCandidateModalEvents(d);
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
    var empNewBtn = document.getElementById('employees-new-btn');
    if (empNewBtn) empNewBtn.addEventListener('click', function () { openEmployeeModal(null); });
    document.getElementById('modal-employee-close').addEventListener('click', closeEmployeeModal);
    document.getElementById('modal-employee-cancel').addEventListener('click', closeEmployeeModal);
    document.getElementById('modal-employee-save').addEventListener('click', saveEmployee);
    document.getElementById('modal-employee').addEventListener('click', function (e) {
      if (e.target.id === 'modal-employee') closeEmployeeModal();
    });
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
