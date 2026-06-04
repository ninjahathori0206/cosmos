/**
 * cosmos-time-monitor — poll server IST vs device/SQL; show global drift modal.
 * Requires cosmos-ui-polish.js (cosmosFmtDateTime) and an auth token in session.
 */
(function cosmosTimeMonitorBootstrap() {
  'use strict';

  var POLL_MS = 5 * 60 * 1000;
  var IST_TZ = 'Asia/Kolkata';
  var OVERLAY_ID = 'cosmos-time-drift-overlay';
  var DISMISS_KEY = 'cosmos_time_drift_dismiss_sig';
  var _timer = null;
  var _lastPayload = null;

  function deviceIstWire() {
    return new Date().toLocaleString('sv-SE', { timeZone: IST_TZ }).replace(' ', 'T').slice(0, 19);
  }

  function resolveAuthToken() {
    try {
      var direct = sessionStorage.getItem('cosmos_token');
      if (direct) return direct;
    } catch (_) { /* ignore */ }
    try {
      var posRaw = sessionStorage.getItem('pos_session');
      if (posRaw) {
        var pos = JSON.parse(posRaw);
        if (pos && pos.token) return pos.token;
      }
    } catch (_) { /* ignore */ }
    return null;
  }

  function wireIstToUtcMs(wire) {
    var m = String(wire || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
      - 330 * 60 * 1000;
  }

  function skewMinutes(aWire, bWire) {
    var a = wireIstToUtcMs(aWire);
    var b = wireIstToUtcMs(bWire);
    if (a == null || b == null) return null;
    return Math.round((a - b) / 60000);
  }

  function formatSkewIssue(labelA, labelB, skewMin) {
    if (skewMin == null || skewMin === 0) return null;
    var abs = Math.abs(skewMin);
    if (skewMin > 0) return labelA + ' is ' + abs + ' min ahead of ' + labelB + '.';
    return labelB + ' is ' + abs + ' min ahead of ' + labelA + '.';
  }

  function evaluateHealth(data, deviceWire) {
    var threshold = Number(data.threshold_minutes) || 5;
    var issues = [];
    var skews = {
      device_server_minutes: null,
      device_sql_minutes: null,
      node_sql_minutes: data.skew_node_sql_minutes
    };

    if (deviceWire) {
      skews.device_server_minutes = skewMinutes(deviceWire, data.server_ist_wire || data.node_ist_wire);
      skews.device_sql_minutes = skewMinutes(deviceWire, data.sql_ist_wire);
      if (skews.device_server_minutes != null && Math.abs(skews.device_server_minutes) > threshold) {
        issues.push(formatSkewIssue('This device', 'server', skews.device_server_minutes));
      }
      if (skews.device_sql_minutes != null && Math.abs(skews.device_sql_minutes) > threshold) {
        issues.push(formatSkewIssue('This device', 'SQL server', skews.device_sql_minutes));
      }
    }
    if (skews.node_sql_minutes != null && Math.abs(skews.node_sql_minutes) > threshold) {
      issues.push(formatSkewIssue('Node server', 'SQL server', skews.node_sql_minutes));
    }

    return {
      device_ist_wire: deviceWire,
      skews: skews,
      threshold_minutes: threshold,
      healthy: issues.length === 0,
      issues: issues.filter(Boolean)
    };
  }

  function fmtClock(wire) {
    if (!wire) return '—';
    if (typeof window.cosmosFmtDateTime === 'function') return window.cosmosFmtDateTime(wire);
    return String(wire).replace('T', ' ');
  }

  function dismissSignature(payload) {
    return [
      payload.threshold_minutes,
      payload.skews && payload.skews.device_server_minutes,
      payload.skews && payload.skews.device_sql_minutes,
      payload.skews && payload.skews.node_sql_minutes,
      (payload.issues || []).join('|')
    ].join('::');
  }

  function isDismissed(payload) {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === dismissSignature(payload);
    } catch (_) {
      return false;
    }
  }

  function rememberDismiss(payload) {
    try {
      sessionStorage.setItem(DISMISS_KEY, dismissSignature(payload));
    } catch (_) { /* ignore */ }
  }

  function ensureOverlay() {
    var el = document.getElementById(OVERLAY_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.className = 'overlay cosmos-time-drift-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'cosmos-time-drift-title');
    el.innerHTML =
      '<div class="modal">'
      + '<h2 id="cosmos-time-drift-title" class="cosmos-time-drift-title">Clock time mismatch</h2>'
      + '<p class="cosmos-time-drift-sub">Order and payment timestamps may be wrong until clocks are aligned.</p>'
      + '<div id="cosmos-time-drift-clocks" class="cosmos-time-drift-clocks"></div>'
      + '<div id="cosmos-time-drift-issues" class="cosmos-time-drift-issues" hidden></div>'
      + '<p class="cosmos-time-drift-fix">Sync this device date/time, the app server, and the SQL host (Windows Time / NTP). Ask your admin to verify SQL Server on the database VPS.</p>'
      + '<div class="cosmos-time-drift-actions">'
      + '<button type="button" class="btn primary" id="cosmos-time-drift-dismiss">Dismiss</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);
    el.querySelector('#cosmos-time-drift-dismiss').addEventListener('click', function () {
      if (_lastPayload) rememberDismiss(_lastPayload);
      el.classList.remove('open');
    });
    return el;
  }

  function renderModal(payload) {
    var overlay = ensureOverlay();
    var clocks = overlay.querySelector('#cosmos-time-drift-clocks');
    var issuesEl = overlay.querySelector('#cosmos-time-drift-issues');
    var snap = payload.snapshot || {};
    var deviceWire = payload.device_ist_wire;

    clocks.innerHTML =
      '<div class="cosmos-time-drift-clock"><div class="cosmos-time-drift-clock-label">This device</div>'
      + '<div class="cosmos-time-drift-clock-value">' + fmtClock(deviceWire) + '</div></div>'
      + '<div class="cosmos-time-drift-clock"><div class="cosmos-time-drift-clock-label">Node server</div>'
      + '<div class="cosmos-time-drift-clock-value">' + fmtClock(snap.server_ist_wire || snap.node_ist_wire) + '</div></div>'
      + '<div class="cosmos-time-drift-clock"><div class="cosmos-time-drift-clock-label">SQL server</div>'
      + '<div class="cosmos-time-drift-clock-value">' + fmtClock(snap.sql_ist_wire) + '</div></div>';

    var issues = payload.issues || [];
    if (issues.length) {
      issuesEl.hidden = false;
      issuesEl.innerHTML = '<strong>Drift detected</strong><ul>'
        + issues.map(function (item) { return '<li>' + item + '</li>'; }).join('')
        + '</ul>';
    } else {
      issuesEl.hidden = true;
      issuesEl.innerHTML = '';
    }

    if (!payload.healthy && !isDismissed(payload)) {
      overlay.classList.add('open');
    }
  }

  function hideModalIfHealthy(payload) {
    if (payload && payload.healthy) {
      var overlay = document.getElementById(OVERLAY_ID);
      if (overlay) overlay.classList.remove('open');
    }
  }

  async function fetchSnapshot(token) {
    var res = await fetch('/api/meta/cosmos-time', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store'
    });
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) {
      var errBody = await res.json().catch(function () { return {}; });
      throw new Error((errBody && errBody.message) || 'Time check failed');
    }
    var body = await res.json();
    return body && body.data ? body.data : null;
  }

  async function runCheck() {
    var token = resolveAuthToken();
    if (!token) return;
    try {
      var snap = await fetchSnapshot(token);
      if (!snap) return;
      var deviceWire = deviceIstWire();
      var evalResult = evaluateHealth(snap, deviceWire);
      var payload = {
        snapshot: snap,
        device_ist_wire: deviceWire,
        skews: evalResult.skews,
        threshold_minutes: evalResult.threshold_minutes,
        healthy: evalResult.healthy,
        issues: evalResult.issues
      };
      _lastPayload = payload;
      hideModalIfHealthy(payload);
      if (!payload.healthy) renderModal(payload);
    } catch (err) {
      if (typeof window.cosmosToastError === 'function') {
        window.cosmosToastError(err.message || 'Clock check failed');
      }
    }
  }

  function startPolling() {
    if (_timer) return;
    void runCheck();
    _timer = window.setInterval(function () { void runCheck(); }, POLL_MS);
  }

  function stopPolling() {
    if (_timer) {
      window.clearInterval(_timer);
      _timer = null;
    }
  }

  window.cosmosTimeMonitor = {
    runCheck: runCheck,
    startPolling: startPolling,
    stopPolling: stopPolling,
    deviceIstWire: deviceIstWire,
    evaluateHealth: evaluateHealth,
    skewMinutes: skewMinutes
  };

  function boot() {
    if (!resolveAuthToken()) return;
    startPolling();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('storage', function (e) {
    if (e.key === 'cosmos_token' || e.key === 'pos_session') boot();
  });
})();
