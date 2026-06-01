require('dotenv').config();
const { applyReadingPowerToPurchaseColours } = require('../src/api/purchases');

// Can't import - function not exported. Test inline via require hack - skip

const sql = require('mssql');
const { getPool } = require('../src/config/db');
const { isValidReadingPower } = require('../src/config/readingPowersCatalog');

async function applyReadingPowerToPurchaseColours(headerId, requestItems) {
  const hasAny = (requestItems || []).some((it) =>
    (it.colours || []).some((c) => c.reading_power && String(c.reading_power).trim())
  );
  if (!hasAny) return { updated: 0 };

  const pool = await getPool();
  const dbItemsRes = await pool.request()
    .input('hid', sql.Int, Number(headerId))
    .query(`SELECT item_id FROM dbo.purchase_items WHERE header_id = @hid ORDER BY item_id`);
  const dbItems = dbItemsRes.recordset || [];

  const dbColoursRes = await pool.request()
    .input('hid', sql.Int, Number(headerId))
    .query(`
      SELECT pic.colour_id, pic.item_id, pic.colour_name, pic.quantity
      FROM dbo.purchase_item_colours pic
      JOIN dbo.purchase_items pi ON pi.item_id = pic.item_id
      WHERE pi.header_id = @hid ORDER BY pic.item_id, pic.colour_id`);
  const allDbColours = dbColoursRes.recordset || [];
  const usedColourIds = new Set();
  let updated = 0;

  for (let itemIdx = 0; itemIdx < (requestItems || []).length; itemIdx++) {
    const item = requestItems[itemIdx];
    const dbItem = dbItems[itemIdx];
    if (!dbItem) continue;
    const dbColours = allDbColours.filter((r) => r.item_id === dbItem.item_id && !usedColourIds.has(r.colour_id));
    for (let i = 0; i < (item.colours || []).length; i++) {
      const pc = item.colours[i];
      const rp = pc.reading_power != null ? String(pc.reading_power).trim() : '';
      if (!rp || !isValidReadingPower(rp)) continue;
      let dbRow = dbColours[i] || dbColours.find((r) => !usedColourIds.has(r.colour_id));
      if (!dbRow) continue;
      usedColourIds.add(dbRow.colour_id);
      await pool.request().input('cid', sql.Int, dbRow.colour_id).input('rp', sql.VarChar(10), rp)
        .query(`UPDATE dbo.purchase_item_colours SET reading_power = @rp WHERE colour_id = @cid`);
      updated++;
    }
  }
  return { updated };
}

(async () => {
  const payload = [{
    product_master_id: 65,
    colours: [
      { colour_name: 'Standard', colour_code: 'STD', quantity: 1, reading_power: '+1.50' },
      { colour_name: 'Standard', colour_code: 'STD', quantity: 1, reading_power: '+2.00' },
      { colour_name: 'Standard', colour_code: 'STD', quantity: 1, reading_power: '+2.50' },
      { colour_name: 'Standard', colour_code: 'STD', quantity: 1, reading_power: '+3.00' },
      { colour_name: 'Standard', colour_code: 'STD', quantity: 1, reading_power: '+3.50' }
    ]
  }];
  const r = await applyReadingPowerToPurchaseColours(5, payload);
  console.log('updated', r.updated);
  const check = await (await getPool()).request().query(`
    SELECT colour_id, reading_power FROM purchase_item_colours WHERE item_id=14 ORDER BY colour_id`);
  console.log(check.recordset);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
