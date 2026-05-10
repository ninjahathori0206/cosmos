/**
 * Hard-delete a Foundry purchase pipeline row (header → items → colours) and any
 * SKUs stamped with that header_id, plus rows in other tables that FK dbo.skus.
 *
 * Usage: node scripts/delete_purchase_header.js <header_id>
 *
 * Requires .env DB_* (same as app). Intended for dev / cleanup — not exposed via HTTP.
 */

require('dotenv').config();
const sql = require('mssql');
const { getPool } = require('../src/config/db');

const headerId = parseInt(process.argv[2], 10);
if (!Number.isInteger(headerId) || headerId < 1) {
  console.error('Usage: node scripts/delete_purchase_header.js <header_id>');
  process.exit(1);
}

function sqlIntCsv(ids) {
  return ids.filter((n) => Number.isFinite(n)).map((n) => String(Math.trunc(Number(n)))).join(',');
}

async function main() {
  const pool = await getPool();
  const tx = pool.transaction();
  await tx.begin();
  try {
    const chk = await tx.request().input('hid', sql.Int, headerId)
      .query('SELECT TOP 1 header_id FROM dbo.purchase_headers WHERE header_id = @hid');
    if (!chk.recordset.length) {
      console.log(`[noop] dbo.purchase_headers has no header_id=${headerId}`);
      await tx.commit();
      return;
    }

    const skuRs = await tx.request().input('hid', sql.Int, headerId)
      .query('SELECT sku_id FROM dbo.skus WHERE header_id = @hid');
    const skuIds = skuRs.recordset.map((r) => r.sku_id);

    await tx.request().input('hid', sql.Int, headerId).query(`
      UPDATE pic
      SET pic.linked_sku_id = NULL
      FROM dbo.purchase_item_colours pic
      INNER JOIN dbo.skus sk ON sk.sku_id = pic.linked_sku_id
      WHERE sk.header_id = @hid
    `);

    await tx.request().input('hid', sql.Int, headerId).query(`
      DELETE FROM dbo.purchase_restock_events WHERE header_id = @hid
    `);

    try {
      await tx.request().input('hid', sql.Int, headerId).query(`
        DELETE FROM dbo.payment_allocations WHERE header_id = @hid
      `);
    } catch (e) {
      if (!String(e.message || '').includes('Invalid object name')) throw e;
    }

    if (skuIds.length) {
      const inClause = sqlIntCsv(skuIds);
      const fkRs = await tx.request().query(`
        SELECT DISTINCT
          OBJECT_SCHEMA_NAME(f.parent_object_id) AS sch,
          OBJECT_NAME(f.parent_object_id) AS tbl,
          COL_NAME(fc.parent_object_id, fc.parent_column_id) AS col
        FROM sys.foreign_keys f
        INNER JOIN sys.foreign_key_columns fc ON f.object_id = fc.constraint_object_id
        WHERE OBJECT_NAME(f.referenced_object_id) = 'skus'
          AND OBJECT_SCHEMA_NAME(f.referenced_object_id) = 'dbo'
      `);

      for (const row of fkRs.recordset) {
        if (row.tbl === 'purchase_item_colours') continue;
        const qq = `DELETE FROM [${row.sch}].[${row.tbl}] WHERE [${row.col}] IN (${inClause})`;
        await tx.request().query(qq);
      }

      await tx.request().input('hid', sql.Int, headerId).query(`
        DELETE FROM dbo.skus WHERE header_id = @hid
      `);
    }

    await tx.request().input('hid', sql.Int, headerId).query(`
      DELETE pic
      FROM dbo.purchase_item_colours pic
      INNER JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      WHERE pi.header_id = @hid
    `);

    await tx.request().input('hid', sql.Int, headerId).query(`
      DELETE FROM dbo.purchase_items WHERE header_id = @hid
    `);

    await tx.request().input('hid', sql.Int, headerId).query(`
      DELETE FROM dbo.purchase_headers WHERE header_id = @hid
    `);

    await tx.commit();
    console.log(`[ok] Deleted purchase header_id=${headerId} (removed ${skuIds.length} SKU row(s)).`);
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fail]', err && err.message ? err.message : err);
    process.exit(1);
  });
