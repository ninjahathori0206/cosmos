'use strict';

const sql = require('mssql');
const { getPool } = require('../config/db');
const { wireDatetimeFromSql } = require('../lib/cosmosIst');
const {
  isAllowedArmyInterviewerRoleKey,
  getArmyInterviewerRoleByKey
} = require('../config/armyInterviewerRoleCatalog');
const {
  isAllowedArmyInterviewModeKey,
  getArmyInterviewModeByKey
} = require('../config/armyInterviewModeCatalog');

let interviewTablesReadyCache = null;

async function isInterviewTablesReady() {
  if (interviewTablesReadyCache !== null) return interviewTablesReadyCache;
  try {
    const pool = await getPool();
    const r = await pool.request().query(
      "SELECT OBJECT_ID(N'dbo.army_interview_templates', N'U') AS oid"
    );
    interviewTablesReadyCache = !!r.recordset[0].oid;
  } catch (_) {
    interviewTablesReadyCache = false;
  }
  return interviewTablesReadyCache;
}

function mapStageRow(row) {
  const role = getArmyInterviewerRoleByKey(row.interviewer_role_key);
  const mode = getArmyInterviewModeByKey(row.mode_key);
  return {
    id: row.template_stage_id,
    sort_order: row.sort_order,
    stage_name: row.stage_name,
    interviewer_role_key: row.interviewer_role_key,
    interviewer_role_label: role ? role.label : row.interviewer_role_key,
    mode_key: row.mode_key,
    mode_label: mode ? mode.label : row.mode_key
  };
}

function mapTemplateRow(row, stages) {
  return {
    id: row.interview_template_id,
    name: row.name,
    description: row.description || '',
    is_active: !!row.is_active,
    stage_count: row.stage_count != null ? row.stage_count : (stages ? stages.length : 0),
    jobs_using_count: row.jobs_using_count != null ? row.jobs_using_count : 0,
    stages_summary: stages && stages.length
      ? stages.map((s) => s.stage_name).join(' → ')
      : (row.stages_summary || ''),
    stages: stages || [],
    created_at: wireDatetimeFromSql(row.created_at),
    updated_at: wireDatetimeFromSql(row.updated_at)
  };
}

function normalizeStages(stages) {
  if (!Array.isArray(stages) || !stages.length) {
    const err = new Error('Add at least one interview stage.');
    err.statusCode = 400;
    throw err;
  }
  if (stages.length > 6) {
    const err = new Error('Maximum 6 stages per template.');
    err.statusCode = 400;
    throw err;
  }
  const names = new Set();
  return stages.map((stage, index) => {
    const stageName = String(stage.stage_name || '').trim();
    const roleKey = String(stage.interviewer_role_key || '').trim().toUpperCase();
    const modeKey = String(stage.mode_key || 'IN_PERSON').trim().toUpperCase();
    if (!stageName) {
      const err = new Error('Each stage needs a name.');
      err.statusCode = 400;
      throw err;
    }
    if (!isAllowedArmyInterviewerRoleKey(roleKey)) {
      const err = new Error('Invalid interviewer role on stage ' + (index + 1) + '.');
      err.statusCode = 400;
      throw err;
    }
    if (!isAllowedArmyInterviewModeKey(modeKey)) {
      const err = new Error('Invalid interview mode on stage ' + (index + 1) + '.');
      err.statusCode = 400;
      throw err;
    }
    const nameKey = stageName.toLowerCase();
    if (names.has(nameKey)) {
      const err = new Error('Duplicate stage name: ' + stageName);
      err.statusCode = 400;
      throw err;
    }
    names.add(nameKey);
    return {
      sort_order: index + 1,
      stage_name: stageName,
      interviewer_role_key: roleKey,
      mode_key: modeKey
    };
  });
}

async function getTemplateStages(poolOrTx, templateId) {
  const req = poolOrTx instanceof sql.Transaction
    ? new sql.Request(poolOrTx)
    : poolOrTx.request();
  const r = await req
    .input('templateId', sql.Int, templateId)
    .query(`
      SELECT template_stage_id, sort_order, stage_name, interviewer_role_key, mode_key
      FROM dbo.army_interview_template_stages
      WHERE interview_template_id = @templateId
      ORDER BY sort_order
    `);
  return r.recordset.map(mapStageRow);
}

async function listInterviewTemplatesAdmin(filters = {}) {
  if (!(await isInterviewTablesReady())) return [];

  const pool = await getPool();
  const req = pool.request();
  const clauses = ['1=1'];
  if (filters.active_only) {
    clauses.push('t.is_active = 1');
  }
  if (filters.q) {
    req.input('q', sql.NVarChar(120), '%' + filters.q + '%');
    clauses.push('(t.name LIKE @q OR t.description LIKE @q)');
  }

  const r = await req.query(`
    SELECT
      t.*,
      (SELECT COUNT(*) FROM dbo.army_interview_template_stages s WHERE s.interview_template_id = t.interview_template_id) AS stage_count,
      (SELECT COUNT(*) FROM dbo.army_job_openings j WHERE j.interview_template_id = t.interview_template_id) AS jobs_using_count
    FROM dbo.army_interview_templates t
    WHERE ${clauses.join(' AND ')}
    ORDER BY t.is_active DESC, t.name
  `);

  const templates = [];
  for (const row of r.recordset) {
    const stages = await getTemplateStages(pool, row.interview_template_id);
    templates.push(mapTemplateRow(row, stages));
  }
  return templates;
}

async function getInterviewTemplateById(templateId) {
  if (!(await isInterviewTablesReady())) {
    const err = new Error('Interview template not found.');
    err.statusCode = 404;
    throw err;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, templateId)
    .query(`
      SELECT
        t.*,
        (SELECT COUNT(*) FROM dbo.army_job_openings j WHERE j.interview_template_id = t.interview_template_id) AS jobs_using_count
      FROM dbo.army_interview_templates t
      WHERE t.interview_template_id = @id
    `);
  if (!r.recordset.length) {
    const err = new Error('Interview template not found.');
    err.statusCode = 404;
    throw err;
  }
  const stages = await getTemplateStages(pool, templateId);
  return mapTemplateRow(r.recordset[0], stages);
}

async function assertTemplateExists(templateId, { activeOnly } = {}) {
  if (!templateId) return null;
  const template = await getInterviewTemplateById(templateId);
  if (activeOnly && !template.is_active) {
    const err = new Error('Interview template is inactive.');
    err.statusCode = 400;
    throw err;
  }
  return template;
}

async function replaceTemplateStages(tx, templateId, stages) {
  await new sql.Request(tx)
    .input('templateId', sql.Int, templateId)
    .query('DELETE FROM dbo.army_interview_template_stages WHERE interview_template_id = @templateId');

  for (const stage of stages) {
    await new sql.Request(tx)
      .input('templateId', sql.Int, templateId)
      .input('sort_order', sql.Int, stage.sort_order)
      .input('stage_name', sql.NVarChar(120), stage.stage_name)
      .input('interviewer_role_key', sql.NVarChar(30), stage.interviewer_role_key)
      .input('mode_key', sql.NVarChar(30), stage.mode_key)
      .query(`
        INSERT INTO dbo.army_interview_template_stages (
          interview_template_id, sort_order, stage_name, interviewer_role_key, mode_key
        ) VALUES (@templateId, @sort_order, @stage_name, @interviewer_role_key, @mode_key)
      `);
  }
}

async function createInterviewTemplate(payload, userId) {
  if (!(await isInterviewTablesReady())) {
    const err = new Error('Interview tables not deployed. Run migration 80.');
    err.statusCode = 503;
    throw err;
  }

  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('Template name is required.');
    err.statusCode = 400;
    throw err;
  }

  const stages = normalizeStages(payload.stages);
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const ins = await new sql.Request(tx)
      .input('name', sql.NVarChar(120), name)
      .input('description', sql.NVarChar(500), payload.description || null)
      .input('is_active', sql.Bit, payload.is_active !== false ? 1 : 0)
      .input('userId', sql.Int, userId || null)
      .query(`
        INSERT INTO dbo.army_interview_templates (name, description, is_active, created_by, created_at, updated_at)
        OUTPUT INSERTED.interview_template_id
        VALUES (@name, @description, @is_active, @userId,
          DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME()))
      `);
    const templateId = ins.recordset[0].interview_template_id;
    await replaceTemplateStages(tx, templateId, stages);
    await tx.commit();
    return getInterviewTemplateById(templateId);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function updateInterviewTemplate(templateId, payload) {
  if (!(await isInterviewTablesReady())) {
    const err = new Error('Interview tables not deployed. Run migration 80.');
    err.statusCode = 503;
    throw err;
  }

  await getInterviewTemplateById(templateId);
  const name = String(payload.name || '').trim();
  if (!name) {
    const err = new Error('Template name is required.');
    err.statusCode = 400;
    throw err;
  }

  const stages = normalizeStages(payload.stages);
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('id', sql.Int, templateId)
      .input('name', sql.NVarChar(120), name)
      .input('description', sql.NVarChar(500), payload.description || null)
      .input('is_active', sql.Bit, payload.is_active !== false ? 1 : 0)
      .query(`
        UPDATE dbo.army_interview_templates SET
          name = @name,
          description = @description,
          is_active = @is_active,
          updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
        WHERE interview_template_id = @id
      `);
    await replaceTemplateStages(tx, templateId, stages);
    await tx.commit();
    return getInterviewTemplateById(templateId);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function setInterviewTemplateActive(templateId, isActive) {
  if (!(await isInterviewTablesReady())) {
    const err = new Error('Interview tables not deployed. Run migration 80.');
    err.statusCode = 503;
    throw err;
  }

  const pool = await getPool();
  const r = await pool.request()
    .input('id', sql.Int, templateId)
    .input('is_active', sql.Bit, isActive ? 1 : 0)
    .query(`
      UPDATE dbo.army_interview_templates SET
        is_active = @is_active,
        updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
      OUTPUT INSERTED.interview_template_id
      WHERE interview_template_id = @id
    `);
  if (!r.recordset.length) {
    const err = new Error('Interview template not found.');
    err.statusCode = 404;
    throw err;
  }
  return getInterviewTemplateById(templateId);
}

async function duplicateInterviewTemplate(templateId, userId) {
  const existing = await getInterviewTemplateById(templateId);
  return createInterviewTemplate({
    name: existing.name + ' (copy)',
    description: existing.description,
    is_active: true,
    stages: existing.stages.map((s) => ({
      stage_name: s.stage_name,
      interviewer_role_key: s.interviewer_role_key,
      mode_key: s.mode_key
    }))
  }, userId);
}

async function seedApplicationInterviewsFromJob(tx, applicationId, jobOpeningId) {
  if (!(await isInterviewTablesReady())) return;

  const jobR = await new sql.Request(tx)
    .input('jobId', sql.Int, jobOpeningId)
    .query(`
      SELECT interview_template_id FROM dbo.army_job_openings WHERE job_opening_id = @jobId
    `);
  if (!jobR.recordset.length || !jobR.recordset[0].interview_template_id) return;

  const templateId = jobR.recordset[0].interview_template_id;
  const stagesR = await new sql.Request(tx)
    .input('templateId', sql.Int, templateId)
    .query(`
      SELECT sort_order, stage_name, interviewer_role_key, mode_key
      FROM dbo.army_interview_template_stages
      WHERE interview_template_id = @templateId
      ORDER BY sort_order
    `);
  for (const stage of stagesR.recordset) {
    await new sql.Request(tx)
      .input('application_id', sql.Int, applicationId)
      .input('sort_order', sql.Int, stage.sort_order)
      .input('stage_name', sql.NVarChar(120), stage.stage_name)
      .input('interviewer_role_key', sql.NVarChar(30), stage.interviewer_role_key)
      .input('mode_key', sql.NVarChar(30), stage.mode_key)
      .query(`
        INSERT INTO dbo.army_application_interviews (
          application_id, sort_order, stage_name, interviewer_role_key, mode_key, status_key,
          created_at, updated_at
        ) VALUES (
          @application_id, @sort_order, @stage_name, @interviewer_role_key, @mode_key, N'PENDING',
          DATEADD(MINUTE, 330, SYSUTCDATETIME()), DATEADD(MINUTE, 330, SYSUTCDATETIME())
        )
      `);
  }
}

module.exports = {
  isInterviewTablesReady,
  listInterviewTemplatesAdmin,
  getInterviewTemplateById,
  assertTemplateExists,
  createInterviewTemplate,
  updateInterviewTemplate,
  setInterviewTemplateActive,
  duplicateInterviewTemplate,
  seedApplicationInterviewsFromJob
};
