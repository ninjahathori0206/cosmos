/* Army HR Ops — S6–S12 pages (registry for army-prototype.js) */
window.__cosmosArmyHrRegistry = {
  paths: {
    placements: '/army/hr/placements',
    attendance: '/army/hr/attendance',
    rosters: '/army/hr/rosters',
    leaves: '/army/hr/leaves',
    payroll: '/army/hr/payroll',
    training: '/army/hr/training',
    performance: '/army/hr/performance',
    exit: '/army/hr/exit',
    offers: '/army/hr/offers'
  },
  labels: {
    placements: 'Placements',
    attendance: 'Attendance',
    rosters: 'Rosters',
    leaves: 'Leave',
    payroll: 'Payroll',
    training: 'Training',
    performance: 'Performance',
    exit: 'Offboarding',
    offers: 'Offer Letters'
  },
  pathMatchers: [
    ['/army/hr/placements', 'placements'],
    ['/army/hr/attendance', 'attendance'],
    ['/army/hr/rosters', 'rosters'],
    ['/army/hr/leaves', 'leaves'],
    ['/army/hr/payroll', 'payroll'],
    ['/army/hr/training', 'training'],
    ['/army/hr/performance', 'performance'],
    ['/army/hr/exit', 'exit'],
    ['/army/hr/offers', 'offers']
  ],
  navItems: [
    { group: 'People', page: 'placements', label: 'Placements', icon: '📍', perm: 'army.staff.view' },
    { group: 'Time', page: 'attendance', label: 'Attendance', icon: '⏱', perm: 'army.attendance.view' },
    { group: 'Time', page: 'rosters', label: 'Rosters', icon: '📅', perm: 'army.attendance.view' },
    { group: 'Time', page: 'leaves', label: 'Leave', icon: '🏖', perm: 'army.leaves.view' },
    { group: 'Pay', page: 'payroll', label: 'Payroll', icon: '💰', perm: 'army.payroll.view' },
    { group: 'Growth', page: 'training', label: 'Training', icon: '🎓', perm: 'army.staff.view' },
    { group: 'Growth', page: 'performance', label: 'Performance', icon: '📈', perm: 'army.staff.view' },
    { group: 'Exit', page: 'exit', label: 'Offboarding', icon: '🚪', perm: 'army.staff.view' },
    { group: 'Hiring', page: 'offers', label: 'Offer Letters', icon: '📄', perm: 'army.hiring.offers.view army.hiring.candidates.view' }
  ],
  loaders: {}
};

(function armyOpsUi() {
  'use strict';

  var _meta = {};
  var _employees = [];
  var _stores = [];
  var _applications = [];
  var _courses = [];

  function istToday() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  function istMonth() {
    return istToday().slice(0, 7);
  }

  function openOpsModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('open');
  }

  function closeOpsModal(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }

  function fillSelect(selectEl, items, placeholder, valueKey, labelFn, selectedVal) {
    if (!selectEl) return;
    var html = placeholder ? '<option value="">' + esc(placeholder) + '</option>' : '';
    items.forEach(function (item) {
      var val = item[valueKey];
      html += '<option value="' + esc(String(val)) + '">' + esc(labelFn(item)) + '</option>';
    });
    selectEl.innerHTML = html;
    if (selectedVal != null) selectEl.value = String(selectedVal);
  }

  async function ensureLookups(force) {
    if (force || !_employees.length) {
      try {
        var er = await apiGet('/api/army/hr/employees');
        _employees = (er.data && er.data.employees) || [];
      } catch (_) { _employees = []; }
    }
    if (_meta.stores && _meta.stores.length) {
      _stores = _meta.stores;
    } else if (force || !_stores.length) {
      try {
        var sr = await apiGet('/api/army/hr/meta/stores');
        _stores = (sr.data && sr.data.stores) || [];
      } catch (_) { _stores = []; }
    }
  }

  async function ensureApplications(force) {
    if (!force && _applications.length) return;
    try {
      var ar = await apiGet('/api/army/hr/applications');
      _applications = (ar.data && ar.data.applications) || [];
    } catch (_) { _applications = []; }
  }

  async function ensureCourses(force) {
    if (!force && _courses.length) return;
    try {
      var cr = await apiGet('/api/army/hr/lms/courses');
      _courses = (cr.data && cr.data.courses) || [];
    } catch (_) { _courses = []; }
  }

  function employeeLabel(e) {
    return (e.full_name || 'Employee') + (e.employee_code ? ' (' + e.employee_code + ')' : '');
  }

  function storeLabel(s) {
    return s.store_name || s.name || ('Store #' + s.store_id);
  }

  function populateCatalogSelects() {
    fillSelect(document.getElementById('attendance-form-status'), _meta.attendance_statuses || [], null, 'key', function (x) { return x.label; });
    fillSelect(document.getElementById('leave-form-type'), _meta.leave_types || [], null, 'key', function (x) { return x.label; });
  }

  async function prepEmployeeStoreSelects(employeeSelectIds, storeSelectIds, includeEmptyStore) {
    await ensureLookups();
    employeeSelectIds.forEach(function (id) {
      fillSelect(document.getElementById(id), _employees, 'Select employee…', 'id', employeeLabel);
    });
    storeSelectIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      fillSelect(el, _stores, includeEmptyStore ? '—' : 'Select store…', 'store_id', storeLabel);
    });
  }

  function syncOpsButtons() {
    var map = [
      ['placements-new-btn', hasPerm('army.staff.edit')],
      ['attendance-new-btn', hasPerm('army.attendance.edit')],
      ['rosters-new-btn', hasPerm('army.attendance.edit')],
      ['leaves-new-btn', hasPerm('army.leaves.edit')],
      ['payroll-new-btn', hasPerm('army.payroll.edit')],
      ['training-assign-btn', hasPerm('army.staff.edit')],
      ['training-course-btn', hasPerm('army.staff.edit')],
      ['training-session-btn', hasPerm('army.staff.edit')],
      ['perf-compute-btn', hasPerm('army.staff.edit')],
      ['exit-new-btn', hasPerm('army.staff.edit')],
      ['offers-new-btn', hasOffersPerm(false)]
    ];
    map.forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (el) el.hidden = !pair[1];
    });
  }

  function bindOpsModals() {
    document.querySelectorAll('.ops-modal-close').forEach(function (btn) {
      btn.addEventListener('click', function () { closeOpsModal(btn.getAttribute('data-modal')); });
    });
    [
      'modal-offer', 'modal-placement', 'modal-attendance', 'modal-roster', 'modal-leave',
      'modal-payroll', 'modal-performance', 'modal-exit', 'modal-training-assign',
      'modal-training-course', 'modal-training-session'
    ].forEach(function (id) {
      var overlay = document.getElementById(id);
      if (!overlay) return;
      overlay.addEventListener('click', function (e) { if (e.target.id === id) closeOpsModal(id); });
    });

    var offersBtn = document.getElementById('offers-new-btn');
    if (offersBtn) offersBtn.addEventListener('click', openOfferModal);
    document.getElementById('modal-offer-save').addEventListener('click', saveOfferModal);

    var placementBtn = document.getElementById('placements-new-btn');
    if (placementBtn) placementBtn.addEventListener('click', openPlacementModal);
    document.getElementById('modal-placement-save').addEventListener('click', savePlacementModal);

    var attBtn = document.getElementById('attendance-new-btn');
    if (attBtn) attBtn.addEventListener('click', openAttendanceModal);
    document.getElementById('modal-attendance-save').addEventListener('click', saveAttendanceModal);

    var rosterBtn = document.getElementById('rosters-new-btn');
    if (rosterBtn) rosterBtn.addEventListener('click', openRosterModal);
    document.getElementById('modal-roster-save').addEventListener('click', saveRosterModal);

    var leaveBtn = document.getElementById('leaves-new-btn');
    if (leaveBtn) leaveBtn.addEventListener('click', openLeaveModal);
    document.getElementById('modal-leave-save').addEventListener('click', saveLeaveModal);

    var payBtn = document.getElementById('payroll-new-btn');
    if (payBtn) payBtn.addEventListener('click', openPayrollModal);
    document.getElementById('modal-payroll-save').addEventListener('click', savePayrollModal);

    var perfBtn = document.getElementById('perf-compute-btn');
    if (perfBtn) perfBtn.addEventListener('click', openPerformanceModal);
    document.getElementById('modal-performance-save').addEventListener('click', savePerformanceModal);

    var exitBtn = document.getElementById('exit-new-btn');
    if (exitBtn) exitBtn.addEventListener('click', openExitModal);
    document.getElementById('modal-exit-save').addEventListener('click', saveExitModal);

    var assignBtn = document.getElementById('training-assign-btn');
    if (assignBtn) assignBtn.addEventListener('click', openTrainingAssignModal);
    document.getElementById('modal-training-assign-save').addEventListener('click', saveTrainingAssignModal);

    var courseBtn = document.getElementById('training-course-btn');
    if (courseBtn) courseBtn.addEventListener('click', function () { openOpsModal('modal-training-course'); });
    document.getElementById('modal-training-course-save').addEventListener('click', saveTrainingCourseModal);

    var sessionBtn = document.getElementById('training-session-btn');
    if (sessionBtn) sessionBtn.addEventListener('click', openTrainingSessionModal);
    document.getElementById('modal-training-session-save').addEventListener('click', saveTrainingSessionModal);
  }

  async function openOfferModal() {
    await ensureApplications(true);
    var sel = document.getElementById('offer-form-candidate');
    fillSelect(sel, _applications, 'Select candidate…', 'id', function (a) {
      var name = (a.candidate && a.candidate.full_name) || a.full_name || 'Candidate';
      var role = (a.job && a.job.title) || a.job_title || 'Role';
      return name + ' — ' + role + ' (' + (a.status_key || '') + ')';
    });
    document.getElementById('offer-form-ctc').value = '';
    document.getElementById('offer-form-joining').value = '';
    openOpsModal('modal-offer');
  }

  async function saveOfferModal() {
    var cand = document.getElementById('offer-form-candidate');
    var ctc = document.getElementById('offer-form-ctc');
    var join = document.getElementById('offer-form-joining');
    if (!cand.value) { window.cosmosFieldError(cand, 'Pick a candidate'); return; }
    if (!ctc.value || Number(ctc.value) <= 0) { window.cosmosFieldError(ctc, 'Enter valid CTC'); return; }
    if (!join.value) { window.cosmosFieldError(join, 'Pick joining date'); return; }
    var btn = document.getElementById('modal-offer-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/offer-letters', {
        application_id: Number(cand.value),
        ctc_amount: Number(ctc.value),
        joining_date: join.value
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Offer letter saved as draft.');
      closeOpsModal('modal-offer');
      loadOffers();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function openPlacementModal() {
    await prepEmployeeStoreSelects(['placement-form-employee'], ['placement-form-store'], false);
    document.getElementById('placement-form-notes').value = '';
    openOpsModal('modal-placement');
  }

  async function savePlacementModal() {
    var emp = document.getElementById('placement-form-employee');
    var store = document.getElementById('placement-form-store');
    if (!emp.value) { window.cosmosFieldError(emp, 'Pick an employee'); return; }
    if (!store.value) { window.cosmosFieldError(store, 'Pick a store'); return; }
    var btn = document.getElementById('modal-placement-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/placements', {
        employee_id: Number(emp.value),
        store_id: Number(store.value),
        notes: document.getElementById('placement-form-notes').value.trim() || null
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Placement created.');
      closeOpsModal('modal-placement');
      loadPlacements();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function openAttendanceModal() {
    await prepEmployeeStoreSelects(['attendance-form-employee'], ['attendance-form-store'], true);
    document.getElementById('attendance-form-date').value = istToday();
    openOpsModal('modal-attendance');
  }

  async function saveAttendanceModal() {
    var emp = document.getElementById('attendance-form-employee');
    var dt = document.getElementById('attendance-form-date');
    var st = document.getElementById('attendance-form-status');
    if (!emp.value) { window.cosmosFieldError(emp, 'Pick an employee'); return; }
    if (!dt.value) { window.cosmosFieldError(dt, 'Pick a date'); return; }
    if (!st.value) { window.cosmosFieldError(st, 'Pick status'); return; }
    var storeVal = document.getElementById('attendance-form-store').value;
    var btn = document.getElementById('modal-attendance-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/attendance', {
        employee_id: Number(emp.value),
        att_date: dt.value,
        status_key: st.value,
        store_id: storeVal ? Number(storeVal) : null
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Attendance saved.');
      closeOpsModal('modal-attendance');
      loadAttendance();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function openRosterModal() {
    await prepEmployeeStoreSelects([], ['roster-form-store'], false);
    document.getElementById('roster-form-week').value = istToday();
    openOpsModal('modal-roster');
  }

  async function saveRosterModal() {
    var store = document.getElementById('roster-form-store');
    var week = document.getElementById('roster-form-week');
    if (!store.value) { window.cosmosFieldError(store, 'Pick a store'); return; }
    if (!week.value) { window.cosmosFieldError(week, 'Pick week start date'); return; }
    var btn = document.getElementById('modal-roster-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/rosters', { store_id: Number(store.value), week_start: week.value });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Roster week created.');
      closeOpsModal('modal-roster');
      loadRosters();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function openLeaveModal() {
    await prepEmployeeStoreSelects(['leave-form-employee'], [], false);
    document.getElementById('leave-form-from').value = istToday();
    document.getElementById('leave-form-to').value = istToday();
    document.getElementById('leave-form-reason').value = '';
    openOpsModal('modal-leave');
  }

  async function saveLeaveModal() {
    var emp = document.getElementById('leave-form-employee');
    var type = document.getElementById('leave-form-type');
    var from = document.getElementById('leave-form-from');
    var to = document.getElementById('leave-form-to');
    if (!emp.value) { window.cosmosFieldError(emp, 'Pick an employee'); return; }
    if (!type.value) { window.cosmosFieldError(type, 'Pick leave type'); return; }
    if (!from.value) { window.cosmosFieldError(from, 'Pick from date'); return; }
    if (!to.value) { window.cosmosFieldError(to, 'Pick to date'); return; }
    var btn = document.getElementById('modal-leave-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/leave-requests', {
        employee_id: Number(emp.value),
        leave_type_key: type.value,
        from_date: from.value,
        to_date: to.value,
        reason: document.getElementById('leave-form-reason').value.trim() || null
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Leave request submitted.');
      closeOpsModal('modal-leave');
      loadLeaves();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  function openPayrollModal() {
    document.getElementById('payroll-form-month').value = istMonth();
    openOpsModal('modal-payroll');
  }

  async function savePayrollModal() {
    var month = document.getElementById('payroll-form-month').value;
    if (!month) { window.cosmosToastWarn('Select a month.'); return; }
    var btn = document.getElementById('modal-payroll-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/payroll-runs', { month_key: month });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Payroll run created.');
      closeOpsModal('modal-payroll');
      loadPayroll();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  function openPerformanceModal() {
    document.getElementById('perf-form-month').value = istMonth();
    openOpsModal('modal-performance');
  }

  async function savePerformanceModal() {
    var month = document.getElementById('perf-form-month').value;
    if (!month) { window.cosmosToastWarn('Select a month.'); return; }
    var btn = document.getElementById('modal-performance-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/performance/compute', { month_key: month });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Performance scores computed.');
      closeOpsModal('modal-performance');
      loadPerformance();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function openExitModal() {
    await prepEmployeeStoreSelects(['exit-form-employee'], [], false);
    document.getElementById('exit-form-lwd').value = '';
    document.getElementById('exit-form-reason').value = '';
    openOpsModal('modal-exit');
  }

  async function saveExitModal() {
    var emp = document.getElementById('exit-form-employee');
    var lwd = document.getElementById('exit-form-lwd');
    var reason = document.getElementById('exit-form-reason');
    if (!emp.value) { window.cosmosFieldError(emp, 'Pick an employee'); return; }
    if (!lwd.value) { window.cosmosFieldError(lwd, 'Pick last working day'); return; }
    if (!reason.value.trim()) { window.cosmosFieldError(reason, 'Enter a reason'); return; }
    var btn = document.getElementById('modal-exit-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/exit-requests', {
        employee_id: Number(emp.value),
        requested_lwd: lwd.value,
        reason: reason.value.trim()
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Exit process started.');
      closeOpsModal('modal-exit');
      loadExit();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function openTrainingAssignModal() {
    await ensureLookups();
    await ensureCourses(true);
    fillSelect(document.getElementById('train-assign-employee'), _employees, 'Select employee…', 'id', employeeLabel);
    fillSelect(document.getElementById('train-assign-course'), _courses, 'Select course…', 'id', function (c) { return c.title; });
    document.getElementById('train-assign-due').value = '';
    openOpsModal('modal-training-assign');
  }

  async function saveTrainingAssignModal() {
    var emp = document.getElementById('train-assign-employee');
    var course = document.getElementById('train-assign-course');
    if (!emp.value) { window.cosmosFieldError(emp, 'Pick an employee'); return; }
    if (!course.value) { window.cosmosFieldError(course, 'Pick a course'); return; }
    var due = document.getElementById('train-assign-due').value;
    var btn = document.getElementById('modal-training-assign-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/training/assignments', {
        employee_id: Number(emp.value),
        course_id: Number(course.value),
        due_date: due || null
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Training assigned.');
      closeOpsModal('modal-training-assign');
      loadTraining();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function saveTrainingCourseModal() {
    var title = document.getElementById('train-course-title');
    if (!title.value.trim()) { window.cosmosFieldError(title, 'Enter course title'); return; }
    var btn = document.getElementById('modal-training-course-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/lms/courses', {
        title: title.value.trim(),
        description: document.getElementById('train-course-desc').value.trim() || null
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Course created.');
      _courses = [];
      closeOpsModal('modal-training-course');
      title.value = '';
      document.getElementById('train-course-desc').value = '';
      loadTraining();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function openTrainingSessionModal() {
    await prepEmployeeStoreSelects([], ['train-session-store'], true);
    document.getElementById('train-session-title').value = '';
    document.getElementById('train-session-venue').value = '';
    document.getElementById('train-session-trainer').value = '';
    document.getElementById('train-session-type').value = 'ONSITE';
    openOpsModal('modal-training-session');
  }

  async function saveTrainingSessionModal() {
    var title = document.getElementById('train-session-title');
    var dt = document.getElementById('train-session-datetime');
    if (!title.value.trim()) { window.cosmosFieldError(title, 'Enter session title'); return; }
    if (!dt.value) { window.cosmosFieldError(dt, 'Pick date and time'); return; }
    var storeVal = document.getElementById('train-session-store').value;
    var iso = dt.value.length === 16 ? dt.value + ':00+05:30' : dt.value;
    var btn = document.getElementById('modal-training-session-save');
    window.cosmosBtnLoading(btn);
    try {
      await apiPost('/api/army/hr/training/sessions', {
        title: title.value.trim(),
        session_type: document.getElementById('train-session-type').value,
        scheduled_at: iso,
        venue: document.getElementById('train-session-venue').value.trim() || null,
        store_id: storeVal ? Number(storeVal) : null,
        trainer_name: document.getElementById('train-session-trainer').value.trim() || null
      });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Session scheduled.');
      closeOpsModal('modal-training-session');
      loadTraining();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function hasPerm(key) {
    if (window.__cosmosArmyHrHasPerm) return window.__cosmosArmyHrHasPerm(key);
    return true;
  }

  async function apiGet(path) {
    if (window.__cosmosArmyHrApiGet) return window.__cosmosArmyHrApiGet(path);
    throw new Error('Army HR core not loaded');
  }

  async function apiPost(path, body) {
    if (window.__cosmosArmyHrApiPost) return window.__cosmosArmyHrApiPost(path, body);
    throw new Error('Army HR core not loaded');
  }

  async function apiPatch(path, body) {
    if (window.__cosmosArmyHrApiPatch) return window.__cosmosArmyHrApiPatch(path, body);
    throw new Error('Army HR core not loaded');
  }

  function hasOffersPerm(view) {
    if (view) return hasPerm('army.hiring.offers.view') || hasPerm('army.hiring.candidates.view');
    return hasPerm('army.hiring.offers.edit') || hasPerm('army.hiring.candidates.edit');
  }

  function renderSimpleTable(tbodyId, cols, rows, emptyMsg) {
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="' + cols + '"><div class="empty"><div class="empty-head">' + esc(emptyMsg) + '</div></div></td></tr>';
      return;
    }
    tbody.innerHTML = rows.join('');
  }

  function navItemVisible(perm) {
    if (!perm) return true;
    return String(perm).split(/\s+/).some(function (p) { return hasPerm(p); });
  }

  async function loadPlacements() {
    if (!hasPerm('army.staff.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('placements-tbody', 4);
    try {
      var res = await apiGet('/api/army/hr/placements');
      var list = (res.data && res.data.placements) || [];
      renderSimpleTable('placements-tbody', 4, list.map(function (p) {
        var actions = hasPerm('army.staff.edit') && p.status_key === 'PENDING'
          ? '<button type="button" class="btn sm primary ops-confirm-placement" data-id="' + p.id + '">Confirm</button>' : '—';
        return '<tr><td>' + esc(p.employee_name) + '</td><td>' + esc(p.store_name) + '</td><td><span class="b b-blue">' + esc(p.status_key) + '</span></td><td>' + actions + '</td></tr>';
      }), 'No placements yet');
      document.querySelectorAll('.ops-confirm-placement').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          window.cosmosBtnLoading(btn);
          try {
            await apiPatch('/api/army/hr/placements/' + btn.getAttribute('data-id') + '/confirm', {});
            window.cosmosBtnSuccess(btn);
            window.cosmosToastSuccess('Placement confirmed.');
            loadPlacements();
          } catch (e) {
            window.cosmosBtnDone(btn);
            window.cosmosToastError(e.message);
          }
        });
      });
    } catch (err) {
      window.cosmosToastError(err.message);
    }
  }

  async function loadAttendance() {
    if (!hasPerm('army.attendance.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('attendance-tbody', 5);
    try {
      var res = await apiGet('/api/army/hr/attendance');
      var list = (res.data && res.data.records) || [];
      renderSimpleTable('attendance-tbody', 5, list.map(function (r) {
        return '<tr><td>' + esc(r.att_date) + '</td><td>' + esc(r.employee_name) + '</td><td>' + esc(r.status_key) + '</td><td>' + esc(r.check_in_at || '—') + '</td><td>' + esc(r.store_name || '—') + '</td></tr>';
      }), 'No attendance records');
    } catch (err) { window.cosmosToastError(err.message); }
  }

  async function loadRosters() {
    if (!hasPerm('army.attendance.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('rosters-tbody', 5);
    try {
      var res = await apiGet('/api/army/hr/rosters');
      var list = (res.data && res.data.rosters) || [];
      renderSimpleTable('rosters-tbody', 5, list.map(function (r) {
        var pub = hasPerm('army.attendance.edit') && r.status_key === 'DRAFT'
          ? '<button type="button" class="btn sm primary ops-publish-roster" data-id="' + r.id + '">Publish</button>' : esc(r.status_key);
        return '<tr><td>' + esc(r.store_name) + '</td><td>' + esc(r.week_start) + '</td><td>' + esc(r.entry_count) + '</td><td>' + esc(r.status_key) + '</td><td>' + pub + '</td></tr>';
      }), 'No rosters yet');
      document.querySelectorAll('.ops-publish-roster').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          window.cosmosBtnLoading(btn);
          try {
            await apiPatch('/api/army/hr/rosters/' + btn.getAttribute('data-id') + '/publish', {});
            window.cosmosBtnSuccess(btn);
            window.cosmosToastSuccess('Roster published.');
            loadRosters();
          } catch (e) {
            window.cosmosBtnDone(btn);
            window.cosmosToastError(e.message);
          }
        });
      });
    } catch (err) { window.cosmosToastError(err.message); }
  }

  async function loadLeaves() {
    if (!hasPerm('army.leaves.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('leaves-tbody', 6);
    try {
      var res = await apiGet('/api/army/hr/leave-requests');
      var list = (res.data && res.data.requests) || [];
      renderSimpleTable('leaves-tbody', 6, list.map(function (l) {
        var actions = '';
        if (hasPerm('army.leaves.edit') && l.status_key === 'PENDING') {
          actions = '<button type="button" class="btn sm primary ops-leave-approve" data-id="' + l.id + '">Approve</button> ' +
            '<button type="button" class="btn sm ops-leave-reject" data-id="' + l.id + '">Reject</button>';
        } else actions = esc(l.status_key);
        return '<tr><td>' + esc(l.employee_name) + '</td><td>' + esc(l.leave_type_key) + '</td><td>' + esc(l.from_date) + '</td><td>' + esc(l.to_date) + '</td><td>' + esc(l.reason || '—') + '</td><td>' + actions + '</td></tr>';
      }), 'No leave requests');
      document.querySelectorAll('.ops-leave-approve').forEach(function (btn) {
        btn.addEventListener('click', function () { reviewLeave(btn.getAttribute('data-id'), 'APPROVED', btn); });
      });
      document.querySelectorAll('.ops-leave-reject').forEach(function (btn) {
        btn.addEventListener('click', function () { reviewLeave(btn.getAttribute('data-id'), 'REJECTED', btn); });
      });
    } catch (err) { window.cosmosToastError(err.message); }
  }

  async function reviewLeave(id, status, btn) {
    window.cosmosBtnLoading(btn);
    try {
      await apiPatch('/api/army/hr/leave-requests/' + id + '/review', { status_key: status });
      window.cosmosBtnSuccess(btn);
      window.cosmosToastSuccess('Leave ' + status.toLowerCase() + '.');
      loadLeaves();
    } catch (e) {
      window.cosmosBtnDone(btn);
      window.cosmosToastError(e.message);
    }
  }

  async function loadPayroll() {
    if (!hasPerm('army.payroll.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('payroll-tbody', 5);
    try {
      var res = await apiGet('/api/army/hr/payroll-runs');
      var list = (res.data && res.data.runs) || [];
      renderSimpleTable('payroll-tbody', 5, list.map(function (r) {
        var actions = hasPerm('army.payroll.edit') && r.status_key === 'DRAFT'
          ? '<button type="button" class="btn sm primary ops-approve-payroll" data-id="' + r.id + '">Approve</button>' : '—';
        return '<tr><td>' + esc(r.month_key) + '</td><td>' + esc(r.status_key) + '</td><td>' + esc(String(r.employee_count)) + '</td><td>₹' + esc(String(r.total_net)) + '</td><td>' + actions + '</td></tr>';
      }), 'No payroll runs');
      document.querySelectorAll('.ops-approve-payroll').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          window.cosmosBtnLoading(btn);
          try {
            await apiPatch('/api/army/hr/payroll-runs/' + btn.getAttribute('data-id') + '/approve', {});
            window.cosmosBtnSuccess(btn);
            window.cosmosToastSuccess('Payroll approved.');
            loadPayroll();
          } catch (e) {
            window.cosmosBtnDone(btn);
            window.cosmosToastError(e.message);
          }
        });
      });
    } catch (err) { window.cosmosToastError(err.message); }
  }

  async function loadPayroll() {
    if (!hasPerm('army.staff.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('training-tbody', 4);
    try {
      var courses = await apiGet('/api/army/hr/lms/courses');
      var assigns = await apiGet('/api/army/hr/training/assignments');
      var sessions = await apiGet('/api/army/hr/training/sessions');
      var rows = [];
      ((courses.data && courses.data.courses) || []).forEach(function (c) {
        rows.push('<tr><td>Course</td><td>' + esc(c.title) + '</td><td>—</td><td>Active</td></tr>');
      });
      ((assigns.data && assigns.data.assignments) || []).forEach(function (a) {
        rows.push('<tr><td>Assignment</td><td>' + esc(a.course_title) + '</td><td>' + esc(a.employee_name) + '</td><td>' + esc(a.status_key) + ' · ' + esc(String(a.progress_pct)) + '%</td></tr>');
      });
      ((sessions.data && sessions.data.sessions) || []).forEach(function (s) {
        rows.push('<tr><td>Session</td><td>' + esc(s.title) + '</td><td>' + esc(s.store_name) + '</td><td>' + esc(s.scheduled_at || '—') + '</td></tr>');
      });
      renderSimpleTable('training-tbody', 4, rows, 'No training data');
    } catch (err) { window.cosmosToastError(err.message); }
  }

  async function loadPerformance() {
    if (!hasPerm('army.staff.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('performance-tbody', 6);
    try {
      var res = await apiGet('/api/army/hr/performance/scores');
      var list = (res.data && res.data.scores) || [];
      renderSimpleTable('performance-tbody', 6, list.map(function (s) {
        return '<tr><td>' + esc(s.month_key) + '</td><td>' + esc(s.employee_name) + '</td><td>' + esc(String(s.sales_score)) + '</td><td>' + esc(String(s.attendance_score)) + '</td><td>' + esc(String(s.training_score)) + '</td><td><strong>' + esc(String(s.total_score)) + '</strong></td></tr>';
      }), 'No scores — compute a month below');
    } catch (err) { window.cosmosToastError(err.message); }
  }

  async function loadPerformance() {
    if (!hasPerm('army.staff.view')) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('exit-tbody', 5);
    try {
      var res = await apiGet('/api/army/hr/exit-requests');
      var list = (res.data && res.data.requests) || [];
      renderSimpleTable('exit-tbody', 5, list.map(function (x) {
        var actions = hasPerm('army.staff.edit') && x.status_key !== 'COMPLETED'
          ? '<button type="button" class="btn sm primary ops-exit-complete" data-id="' + x.id + '">Mark completed</button>' : esc(x.status_key);
        return '<tr><td>' + esc(x.employee_name) + '</td><td>' + esc(x.requested_lwd) + '</td><td>' + esc(x.reason) + '</td><td>' + esc(x.status_key) + '</td><td>' + actions + '</td></tr>';
      }), 'No exit requests');
      document.querySelectorAll('.ops-exit-complete').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          window.cosmosBtnLoading(btn);
          try {
            await apiPatch('/api/army/hr/exit-requests/' + btn.getAttribute('data-id') + '/status', { status_key: 'COMPLETED' });
            window.cosmosBtnSuccess(btn);
            window.cosmosToastSuccess('Exit completed.');
            loadExit();
          } catch (e) {
            window.cosmosBtnDone(btn);
            window.cosmosToastError(e.message);
          }
        });
      });
    } catch (err) { window.cosmosToastError(err.message); }
  }

  async function loadOffers() {
    if (!hasOffersPerm(true)) return;
    if (window.cosmosSkeletonTable) window.cosmosSkeletonTable('offers-tbody', 5);
    try {
      var res = await apiGet('/api/army/hr/offer-letters');
      var list = (res.data && res.data.offers) || [];
      renderSimpleTable('offers-tbody', 5, list.map(function (o) {
        var actions = '';
        if (hasOffersPerm(false)) {
          if (o.status_key === 'DRAFT') actions += '<button type="button" class="btn sm ops-offer-issue" data-id="' + o.id + '">Issue</button> ';
          if (o.status_key === 'ISSUED') actions += '<button type="button" class="btn sm primary ops-offer-accept" data-id="' + o.id + '">Accept → Employee</button>';
        }
        if (!actions) actions = esc(o.status_key);
        return '<tr><td>' + esc(o.candidate_name) + '</td><td>' + esc(o.job_title) + '</td><td>₹' + esc(String(o.ctc_amount)) + '</td><td>' + esc(o.joining_date) + '</td><td>' + actions + '</td></tr>';
      }), 'No offer letters');
      document.querySelectorAll('.ops-offer-issue').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          window.cosmosBtnLoading(btn);
          try {
            await apiPatch('/api/army/hr/offer-letters/' + btn.getAttribute('data-id') + '/issue', {});
            window.cosmosBtnSuccess(btn);
            loadOffers();
          } catch (e) { window.cosmosBtnDone(btn); window.cosmosToastError(e.message); }
        });
      });
      document.querySelectorAll('.ops-offer-accept').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          window.cosmosBtnLoading(btn);
          try {
            await apiPatch('/api/army/hr/offer-letters/' + btn.getAttribute('data-id') + '/accept', {});
            window.cosmosBtnSuccess(btn);
            window.cosmosToastSuccess('Offer accepted — employee created.');
            loadOffers();
          } catch (e) { window.cosmosBtnDone(btn); window.cosmosToastError(e.message); }
        });
      });
    } catch (err) { window.cosmosToastError(err.message); }
  }

  window.__cosmosArmyHrRegistry.loaders = {
    placements: loadPlacements,
    attendance: loadAttendance,
    rosters: loadRosters,
    leaves: loadLeaves,
    payroll: loadPayroll,
    training: loadTraining,
    performance: loadPerformance,
    exit: loadExit,
    offers: loadOffers
  };

  window.__cosmosArmyHrOpsInit = function (meta) {
    _meta = meta || {};
    populateCatalogSelects();
    syncOpsButtons();
    bindOpsModals();
    injectNav();
  };

  function injectNav() {
    var nav = document.getElementById('army-nav');
    if (!nav || nav.dataset.opsNavInjected) return;
    var anchor = document.getElementById('army-nav-ops-slot') || document.getElementById('nav-careers-link');
    var lastGroup = '';
    var items = window.__cosmosArmyHrRegistry.navItems || [];
    items.forEach(function (item) {
      if (!navItemVisible(item.perm)) return;
      if (item.group !== lastGroup) {
        var g = document.createElement('div');
        g.className = 'nav-group';
        g.textContent = item.group;
        if (anchor) nav.insertBefore(g, anchor);
        else nav.appendChild(g);
        lastGroup = item.group;
      }
      var el = document.createElement('div');
      el.className = 'nav-item';
      el.setAttribute('data-page', item.page);
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.innerHTML = '<span class="ic">' + item.icon + '</span> ' + esc(item.label);
      if (anchor) nav.insertBefore(el, anchor);
      else nav.appendChild(el);
    });
    nav.dataset.opsNavInjected = '1';
    if (window.__cosmosArmyHrRebindNav) window.__cosmosArmyHrRebindNav();
  }
})();
