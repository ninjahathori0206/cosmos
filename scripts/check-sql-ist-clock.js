require('dotenv').config()
process.env.TZ = 'Asia/Kolkata'
const sql = require('mssql')
const { getPool } = require('../src/config/db')
const { sqlNow, todayYmd, wallClockIso } = require('../src/lib/cosmosIst')

async function main() {
  const pool = await getPool()

  const r = await pool.request().query(`
    SELECT
      SYSUTCDATETIME() AS sys_utc,
      GETUTCDATE() AS get_utc,
      GETDATE() AS getdate_local,
      ${sqlNow()} AS cosmos_ist_sql,
      CONVERT(VARCHAR(19), ${sqlNow()}, 126) AS cosmos_ist_wire,
      CONVERT(VARCHAR(10), ${sqlNow()}, 23) AS cosmos_ist_date,
      DATEADD(MINUTE, 330, SYSUTCDATETIME()) AS manual_ist
  `)

  const row = r.recordset[0]
  const nodeUtc = new Date().toISOString()
  const nodeIstYmd = todayYmd()
  const nodeIstWall = wallClockIso()

  console.log('=== Node (Asia/Kolkata) ===')
  console.log('UTC now (ISO):     ', nodeUtc)
  console.log('IST todayYmd:      ', nodeIstYmd)
  console.log('IST wallClockIso:  ', nodeIstWall)

  console.log('\n=== SQL Server ===')
  console.log('SYSUTCDATETIME():  ', row.sys_utc)
  console.log('GETUTCDATE():    ', row.get_utc)
  console.log('GETDATE():       ', row.getdate_local)
  console.log('DATEADD+330:     ', row.cosmos_ist_sql)
  console.log('IST wire (126):  ', row.cosmos_ist_wire)
  console.log('IST date:        ', row.cosmos_ist_date)

  const sqlUtc = row.sys_utc instanceof Date ? row.sys_utc : new Date(row.sys_utc)
  const nodeUtcMs = Date.now()
  const sqlUtcMs = sqlUtc.getTime()
  const skewMin = Math.round((sqlUtcMs - nodeUtcMs) / 60000)

  console.log('\n=== Skew analysis ===')
  console.log('SQL SYSUTC vs Node UTC (minutes):', skewMin)

  const sqlIstWire = String(row.cosmos_ist_wire)
  const nodeDate = nodeIstWall.slice(0, 10)
  const sqlDate = sqlIstWire.slice(0, 10)
  console.log('Node IST date:   ', nodeDate)
  console.log('SQL IST date:    ', sqlDate)
  console.log('Date match:      ', nodeDate === sqlDate ? 'YES' : 'NO — SQL date is wrong')

  if (nodeDate !== sqlDate) {
    console.log('\n⚠ SQL DATEADD(330, SYSUTCDATETIME()) is on the wrong calendar day for India.')
    console.log('  POS writes via Node wallClockIso() are correct; SQL-only defaults/SPs may still drift.')
  }

  const r2 = await pool.request().query(`
    SELECT
      CONVERT(VARCHAR(19), GETDATE(), 126) AS getdate_ist_wire,
      CONVERT(VARCHAR(19), DATEADD(MINUTE, 330, SYSUTCDATETIME()), 126) AS dateadd_ist_wire,
      CONVERT(VARCHAR(19), SYSUTCDATETIME(), 126) AS sysutc_wire
  `)
  console.log('\n=== SQL wire strings (server-side CONVERT) ===')
  console.log('GETDATE() wire:              ', r2.recordset[0].getdate_ist_wire, '← matches India wall clock if host TZ=IST')
  console.log('DATEADD(330,SYSUTC) wire:    ', r2.recordset[0].dateadd_ist_wire, '← canonical formula on this host')
  console.log('SYSUTCDATETIME() wire:       ', r2.recordset[0].sysutc_wire)

  const getdateOk = r2.recordset[0].getdate_ist_wire.slice(0, 10) === nodeDate
  console.log('\nGETDATE() date matches Node IST today:', getdateOk ? 'YES — use GETDATE() in SQL on this host' : 'NO')

  await pool.close()
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
