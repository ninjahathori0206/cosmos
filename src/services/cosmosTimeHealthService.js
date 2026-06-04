'use strict';

const sql = require('mssql');
const { getPool } = require('../config/db');
const { sqlNow, wallClockIso } = require('../lib/cosmosIst');
const { readSetting } = require('./procurementService');

const THRESHOLD_KEY = 'cosmos_time_drift_threshold_minutes';
const DEFAULT_THRESHOLD_MINUTES = 5;

const WIRE_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

/** Naive IST wire string → UTC epoch ms (IST = UTC+330 min). */
function wireIstToUtcMs(wire) {
  const m = String(wire || '').trim().match(WIRE_RE);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
    - 330 * 60 * 1000;
}

/** Signed skew in whole minutes: a minus b (positive = a ahead of b). */
function skewMinutesBetween(aWire, bWire) {
  const a = wireIstToUtcMs(aWire);
  const b = wireIstToUtcMs(bWire);
  if (a == null || b == null) return null;
  return Math.round((a - b) / 60000);
}

function formatSkewIssue(labelA, labelB, skewMinAB) {
  if (skewMinAB == null || skewMinAB === 0) return null;
  const abs = Math.abs(skewMinAB);
  if (skewMinAB > 0) return labelA + ' is ' + abs + ' min ahead of ' + labelB + '.';
  return labelB + ' is ' + abs + ' min ahead of ' + labelA + '.';
}

async function getThresholdMinutes(pool) {
  const raw = await readSetting(pool, THRESHOLD_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_THRESHOLD_MINUTES;
  return Math.min(60, Math.max(1, Math.round(n)));
}

async function setThresholdMinutes(pool, minutes) {
  const n = Math.min(60, Math.max(1, Math.round(Number(minutes))));
  await pool.request()
    .input('setting_key', sql.NVarChar(100), THRESHOLD_KEY)
    .input('setting_value', sql.NVarChar(400), String(n))
    .input('setting_group', sql.NVarChar(50), 'system')
    .input('description', sql.NVarChar(500), 'Max allowed clock drift (minutes) before Cosmos shows a global alert.')
    .query(`
      MERGE dbo.app_settings AS tgt
      USING (SELECT @setting_key AS setting_key) AS src
      ON tgt.setting_key = src.setting_key
      WHEN MATCHED THEN
        UPDATE SET
          setting_value = @setting_value,
          setting_group = @setting_group,
          description = @description,
          updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_group, description)
        VALUES (@setting_key, @setting_value, @setting_group, @description);
    `);
  return n;
}

/**
 * Server-side time snapshot (Node + SQL IST clocks).
 * @param {{ pool?: import('mssql').ConnectionPool }} [options]
 */
async function getCosmosTimeSnapshot(options) {
  const pool = (options && options.pool) || await getPool();
  const thresholdMinutes = await getThresholdMinutes(pool);
  const nodeIstWire = wallClockIso();
  const nodeUtcIso = new Date().toISOString();
  const capturedAt = nodeUtcIso;

  const r = await pool.request().query(`
    SELECT
      CONVERT(VARCHAR(19), SYSUTCDATETIME(), 126) AS sql_utc_wire,
      CONVERT(VARCHAR(19), ${sqlNow()}, 126) AS sql_ist_wire
  `);
  const row = (r.recordset && r.recordset[0]) || {};
  const sqlIstWire = String(row.sql_ist_wire || '');
  const sqlUtcWire = String(row.sql_utc_wire || '');

  const skewNodeSqlMinutes = skewMinutesBetween(nodeIstWire, sqlIstWire);
  const skewNodeSqlSeconds = skewNodeSqlMinutes != null ? skewNodeSqlMinutes * 60 : null;

  const issues = [];
  if (skewNodeSqlMinutes != null && Math.abs(skewNodeSqlMinutes) > thresholdMinutes) {
    issues.push(formatSkewIssue('Node server', 'SQL server', skewNodeSqlMinutes));
  }

  const healthyServer = issues.length === 0;

  return {
    node_ist_wire: nodeIstWire,
    node_utc_iso: nodeUtcIso,
    server_ist_wire: nodeIstWire,
    server_generated_at: capturedAt,
    sql_ist_wire: sqlIstWire,
    sql_utc_wire: sqlUtcWire,
    skew_node_sql_minutes: skewNodeSqlMinutes,
    skew_node_sql_seconds: skewNodeSqlSeconds,
    threshold_minutes: thresholdMinutes,
    healthy_server: healthyServer,
    issues_server: issues.filter(Boolean),
    healthy: healthyServer,
    issues: issues.filter(Boolean)
  };
}

/**
 * Merge device IST wire with server snapshot for full health evaluation.
 * @param {object} snapshot from getCosmosTimeSnapshot
 * @param {string|null} deviceIstWire YYYY-MM-DDTHH:mm:ss
 */
function evaluateCosmosTimeHealth(snapshot, deviceIstWire) {
  const threshold = Number(snapshot.threshold_minutes) || DEFAULT_THRESHOLD_MINUTES;
  const issues = (snapshot.issues_server || []).slice();
  const skews = {
    device_server_minutes: null,
    device_sql_minutes: null,
    node_sql_minutes: snapshot.skew_node_sql_minutes
  };

  if (deviceIstWire) {
    skews.device_server_minutes = skewMinutesBetween(deviceIstWire, snapshot.server_ist_wire);
    skews.device_sql_minutes = skewMinutesBetween(deviceIstWire, snapshot.sql_ist_wire);

    if (skews.device_server_minutes != null && Math.abs(skews.device_server_minutes) > threshold) {
      issues.push(formatSkewIssue('This device', 'server', skews.device_server_minutes));
    }
    if (skews.device_sql_minutes != null && Math.abs(skews.device_sql_minutes) > threshold) {
      issues.push(formatSkewIssue('This device', 'SQL server', skews.device_sql_minutes));
    }
  }

  const uniqueIssues = issues.filter(Boolean).filter(function (item, idx, arr) {
    return arr.indexOf(item) === idx;
  });

  return {
    device_ist_wire: deviceIstWire || null,
    skews: skews,
    threshold_minutes: threshold,
    healthy: uniqueIssues.length === 0,
    issues: uniqueIssues
  };
}

module.exports = {
  THRESHOLD_KEY,
  DEFAULT_THRESHOLD_MINUTES,
  skewMinutesBetween,
  getThresholdMinutes,
  setThresholdMinutes,
  getCosmosTimeSnapshot,
  evaluateCosmosTimeHealth
};
