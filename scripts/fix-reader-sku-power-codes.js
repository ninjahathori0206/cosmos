/**
 * Backfill skus.reading_power from purchase_item_colours and rebuild sku_code / pid / barcode
 * for Readers where power exists on the colour row but SKU codes lack the power segment.
 * Usage: node scripts/fix-reader-sku-power-codes.js [--sku-id=18]
 */
require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
};

function powerPrefix(readingPower) {
  if (!readingPower) return '';
  return 'P' + String(readingPower).replace(/\+/g, '').replace(/\./g, '');
}

function buildSkuCode(brandPfx, collPfx, modelPfx, colPfx, readingPower) {
  const pp = powerPrefix(readingPower);
  return [brandPfx, collPfx, modelPfx, colPfx].join('-') + (pp ? '-' + pp : '');
}

async function main() {
  const skuFilter = process.argv.find((a) => a.startsWith('--sku-id='));
  const onlySkuId = skuFilter ? Number(skuFilter.split('=')[1]) : null;

  const pool = await sql.connect(config);
  try {
    const req = pool.request();
    let where = `WHERE UPPER(pi.category) = 'READERS'
      AND NULLIF(LTRIM(RTRIM(pic.reading_power)), '') IS NOT NULL`;
    if (onlySkuId) {
      req.input('sid', sql.Int, onlySkuId);
      where += ' AND sk.sku_id = @sid';
    }

    const rows = await req.query(`
      SELECT
        sk.sku_id,
        sk.sku_code,
        sk.barcode,
        sk.pid,
        sk.header_id,
        sk.reading_power AS sku_power,
        pic.reading_power AS pic_power,
        pic.colour_code,
        UPPER(LEFT(COALESCE(NULLIF(LTRIM(RTRIM(hb.brand_code)), ''), NULLIF(LTRIM(RTRIM(hb.brand_name)), ''), NULLIF(LTRIM(RTRIM(pm.source_brand)), ''), 'GEN'), 3)) AS brand_pfx,
        UPPER(LEFT(REPLACE(ISNULL(pm.ew_collection, 'XX'), ' ', ''), 4)) AS coll_pfx,
        UPPER(LEFT(REPLACE(REPLACE(COALESCE(NULLIF(LTRIM(RTRIM(pm.source_model_number)), ''), NULLIF(LTRIM(RTRIM(pm.style_model)), ''), 'UNK'), '-', ''), ' ', ''), 8)) AS model_pfx,
        UPPER(LEFT(REPLACE(ISNULL(pic.colour_code, '00'), ' ', ''), 3)) AS col_pfx
      FROM dbo.skus sk
      JOIN dbo.purchase_item_colours pic ON pic.colour_id = sk.item_colour_id
      JOIN dbo.purchase_items pi ON pi.item_id = sk.item_id
      JOIN dbo.product_master pm ON pm.product_id = sk.product_master_id
      LEFT JOIN dbo.home_brands hb ON hb.brand_id = pm.home_brand_id
      ${where}
    `);

    let fixed = 0;
    for (const row of rows.recordset || []) {
      const rp = String(row.pic_power).trim();
      const pp = powerPrefix(rp);
      const expectedCode = buildSkuCode(row.brand_pfx, row.coll_pfx, row.model_pfx, row.col_pfx, rp);
      if (row.sku_code === expectedCode && row.sku_power === rp) {
        console.log('skip sku', row.sku_id, row.sku_code, '(already correct)');
        continue;
      }

      const pidBase = expectedCode + '-P' + row.header_id;
      let pid = pidBase;
      let suffix = 1;
      while (true) {
        const clash = await pool.request()
          .input('pid', sql.VarChar(120), pid)
          .input('sid', sql.Int, row.sku_id)
          .query('SELECT 1 FROM dbo.skus WHERE pid = @pid AND sku_id <> @sid');
        if (!clash.recordset.length) break;
        pid = pidBase + '-' + suffix;
        suffix++;
      }

      await pool.request()
        .input('sid', sql.Int, row.sku_id)
        .input('code', sql.VarChar(100), expectedCode)
        .input('pid', sql.VarChar(120), pid)
        .input('bc', sql.VarChar(100), pid)
        .input('rp', sql.VarChar(10), rp)
        .query(`
          UPDATE dbo.skus
          SET sku_code = @code, pid = @pid, barcode = @bc, reading_power = @rp,
              updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME())
          WHERE sku_id = @sid
        `);

      console.log('fixed sku', row.sku_id, row.sku_code, '->', expectedCode, '| barcode', pid, '| power', rp);
      fixed++;
    }

    console.log('[fix-reader-sku] done, updated', fixed, 'row(s)');
    if (!fixed && !(rows.recordset || []).length) {
      console.log('[fix-reader-sku] no rows with reading_power on purchase_item_colours — set power on colour row first.');
    }
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error('[fix-reader-sku] FAILED:', err.message);
  process.exit(1);
});
