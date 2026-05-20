const sql = require('mssql');
const { getPool, executeStoredProcedure } = require('../config/db');

function requiresUnitFromRow(row) {
  return row && (row.requires_unit_barcode === true || row.requires_unit_barcode === 1);
}

/**
 * Map sku_id → requires_unit_barcode for dispatch resolution.
 */
async function getRequiresUnitMapBySkuIds(skuIds) {
  const ids = [...new Set((skuIds || []).map((id) => Number(id)).filter((id) => id > 0))];
  const map = new Map();
  if (!ids.length) return map;

  const pool = await getPool();
  const placeholders = ids.map((_, i) => `@s${i}`).join(',');
  const request = pool.request();
  ids.forEach((id, i) => request.input(`s${i}`, sql.Int, id));

  const result = await request.query(`
    SELECT sk.sku_id,
           CAST(ISNULL(ptc.requires_unit_barcode, 1) AS BIT) AS requires_unit_barcode
    FROM dbo.skus sk
    INNER JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
    LEFT JOIN dbo.pos_product_type_config ptc ON ptc.product_type_key = pm.product_type
    WHERE sk.sku_id IN (${placeholders})
  `);

  (result.recordset || []).forEach((row) => {
    map.set(Number(row.sku_id), requiresUnitFromRow(row));
  });
  return map;
}

async function pickWarehouseUnits(skuId, pickCount, excludeUnitIds) {
  if (pickCount < 1) return [];
  const exclude = (excludeUnitIds || []).map((id) => Number(id)).filter((id) => id > 0);
  const result = await executeStoredProcedure('sp_StockTransfer_PickWarehouseUnits', {
    sku_id:       { type: sql.Int, value: Number(skuId) },
    pick_count:   { type: sql.Int, value: pickCount },
    exclude_json: { type: sql.NVarChar(sql.MAX), value: exclude.length ? JSON.stringify(exclude) : null }
  });
  return (result.recordset || []).map((r) => Number(r.unit_id)).filter((id) => id > 0);
}

/**
 * Resolve { sku_id, qty, unit_ids? } for sp_StockTransferDoc_Dispatch lines_json.
 */
async function resolveDispatchLine(line, requiresMap, options) {
  const opts = options || {};
  const skuId = Number(line.sku_id);
  const qty = Math.max(0, Number(line.qty) || 0);
  if (!skuId || qty < 1) return null;

  const requiresUnit = requiresMap.has(skuId) ? requiresMap.get(skuId) : true;
  const strictUnitOnly = opts.strictUnitOnly === true;

  let unitIds = Array.isArray(line.unit_ids)
    ? line.unit_ids.map((id) => Number(id)).filter((id) => id > 0)
    : [];
  unitIds = [...new Set(unitIds)];

  if (strictUnitOnly || requiresUnit) {
    if (strictUnitOnly) {
      if (unitIds.length !== qty) {
        const err = new Error(
          `Scan exactly ${qty} unit barcode(s) for SKU #${skuId} (scanned ${unitIds.length}). Quantity cannot be set without scans.`
        );
        err.statusCode = 422;
        throw err;
      }
      return { sku_id: skuId, qty, unit_ids: unitIds };
    }

    const gap = qty - unitIds.length;
    if (gap > 0) {
      const picked = await pickWarehouseUnits(skuId, gap, unitIds);
      if (picked.length < gap) {
        const err = new Error(
          `Not enough available unit barcodes at warehouse for SKU #${skuId} (need ${gap} more, found ${picked.length}). Scan units or reduce quantity.`
        );
        err.statusCode = 422;
        throw err;
      }
      unitIds = unitIds.concat(picked);
    }

    if (unitIds.length !== qty) {
      const err = new Error(`Unit count must match quantity for SKU #${skuId}.`);
      err.statusCode = 422;
      throw err;
    }

    return { sku_id: skuId, qty, unit_ids: unitIds };
  }

  return { sku_id: skuId, qty };
}

/**
 * Build lines_json rows from request dispatch + extras (with unit auto-pick).
 */
async function buildDispatchSkuLines(dispatchEntries, extraEntries, reqLineMeta, options) {
  const opts = options || {};
  const skuIds = [
    ...dispatchEntries.map((e) => e.sku_id),
    ...extraEntries.map((e) => e.sku_id)
  ];
  const requiresMap = await getRequiresUnitMapBySkuIds(skuIds);

  reqLineMeta.forEach((l) => {
    if (l.sku_id != null) {
      requiresMap.set(Number(l.sku_id), requiresUnitFromRow(l));
    }
  });

  const merged = new Map();

  async function addEntry(entry) {
    const resolved = await resolveDispatchLine(entry, requiresMap, opts);
    if (!resolved) return;
    const key = resolved.sku_id;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, resolved);
      return;
    }
    existing.qty += resolved.qty;
    if (resolved.unit_ids) {
      existing.unit_ids = (existing.unit_ids || []).concat(resolved.unit_ids);
    }
  }

  for (const e of dispatchEntries) await addEntry(e);
  for (const e of extraEntries) await addEntry(e);

  return [...merged.values()];
}

module.exports = {
  requiresUnitFromRow,
  getRequiresUnitMapBySkuIds,
  pickWarehouseUnits,
  resolveDispatchLine,
  buildDispatchSkuLines
};
