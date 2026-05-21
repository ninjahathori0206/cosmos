/**
 * Smoke test: DISPATCHED payload with extra_lines[].unit_ids must pass Joi (not "is not allowed").
 * Run: node scripts/verify-transfer-dispatch-schema.js
 */
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

const payload = {
  status: 'DISPATCHED',
  lines: [{ line_id: 1, dispatched_qty: 2, unit_ids: [101, 102] }],
  extra_lines: [{ sku_id: 9, qty: 24, unit_ids: [47, 37, 52] }],
  notes: null
};

const { error } = schema.validate(payload);
if (error) {
  console.error('FAIL:', error.details[0].message);
  process.exit(1);
}
console.log('OK: extra_lines[0].unit_ids accepted by dispatch status schema');
