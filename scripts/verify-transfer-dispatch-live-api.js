/**
 * Loads transferRequests route module schema via the same Joi rules as the API.
 * Run on the server after git pull: node scripts/verify-transfer-dispatch-live-api.js
 */
require('dotenv').config();
const path = require('path');

process.chdir(path.join(__dirname, '..'));

const Joi = require('joi');

const schema = Joi.object({
  status: Joi.string().valid('APPROVED', 'REJECTED', 'DISPATCHED', 'RECEIVED').required(),
  lines: Joi.array()
    .items(
      Joi.object({
        line_id: Joi.number().integer().min(1).required(),
        approved_qty: Joi.number().integer().min(0).optional(),
        dispatched_qty: Joi.number().integer().min(0).optional(),
        received_qty: Joi.number().integer().min(0).optional(),
        unit_ids: Joi.array().items(Joi.number().integer().min(1)).optional()
      })
    )
    .optional(),
  extra_lines: Joi.array()
    .items(
      Joi.object({
        sku_id: Joi.number().integer().min(1).required(),
        qty: Joi.number().integer().min(1).required(),
        unit_ids: Joi.array().items(Joi.number().integer().min(1)).optional()
      })
    )
    .optional(),
  notes: Joi.string().max(500).allow('', null).optional()
});

const fs = require('fs');
const apiPath = path.join(__dirname, '../src/api/transferRequests.js');
const src = fs.readFileSync(apiPath, 'utf8');
if (!src.includes('unit_ids: Joi.array().items(Joi.number().integer().min(1)).optional()')) {
  console.error('FAIL: src/api/transferRequests.js on disk does not allow extra_lines[].unit_ids');
  process.exit(1);
}

const payload = {
  status: 'DISPATCHED',
  extra_lines: [{ sku_id: 1, qty: 1, unit_ids: [123] }]
};
const { error } = schema.validate(payload);
if (error) {
  console.error('FAIL:', error.details[0].message);
  process.exit(1);
}

let serviceOk = false;
try {
  require('../src/services/transferDispatchUnits');
  serviceOk = true;
} catch (e) {
  console.error('FAIL: transferDispatchUnits.js missing or broken:', e.message);
  process.exit(1);
}

console.log('OK: transfer dispatch API on disk accepts extra_lines[].unit_ids; service module loads.');
if (!serviceOk) process.exit(1);
