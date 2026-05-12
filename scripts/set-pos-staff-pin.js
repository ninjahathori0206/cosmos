/**
 * Set Store OS POS staff PIN (4 digits, bcrypt — same as src/api/pos.js).
 * Usage: node scripts/set-pos-staff-pin.js <usernameOrNameFragment> <4digitPIN>
 * Example: node scripts/set-pos-staff-pin.js Kamaran 1234
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const sql = require('mssql')

const BCRYPT_ROUNDS = 12

const poolConfig = {
  server: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 1433),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true }
}

async function run() {
  const needle = process.argv[2]
  const plain = process.argv[3]
  if (!needle || plain == null) {
    console.error('Usage: node scripts/set-pos-staff-pin.js <usernameOrNameFragment> <4digitPIN>')
    process.exit(1)
  }
  if (!/^\d{4}$/.test(String(plain).trim())) {
    console.error('PIN must be exactly 4 digits.')
    process.exit(1)
  }

  const pin = String(plain).trim()
  const pool = await sql.connect(poolConfig)
  try {
    const find = await pool.request()
      .input('n', sql.VarChar(100), needle.trim())
      .query(`
        SELECT user_id, username, full_name, role_key, store_id, is_active
        FROM dbo.users
        WHERE LOWER(username) = LOWER(@n)
           OR LOWER(full_name) LIKE N'%' + LOWER(@n) + N'%'
        ORDER BY user_id
      `)

    const rows = find.recordset || []
    if (rows.length === 0) {
      console.error('No user matched:', needle)
      process.exit(1)
    }
    if (rows.length > 1) {
      console.error('Multiple matches; refine the name fragment or use exact username:')
      rows.forEach((r) =>
        console.error(`  ${r.user_id}\t${r.username}\t${r.full_name}\tstore=${r.store_id}\tactive=${r.is_active}`)
      )
      process.exit(1)
    }

    const user = rows[0]
    if (!user.is_active) {
      console.error('User is inactive:', user.full_name)
      process.exit(1)
    }

    const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS)
    const upd = await pool.request()
      .input('user_id', sql.Int, user.user_id)
      .input('pin_hash', sql.VarChar(200), hash)
      .execute('sp_POS_SetUserPin')

    const out = upd.recordset && upd.recordset[0]
    const n = Number((out && out.rows_updated) || 0)
    if (!n) {
      console.error('sp_POS_SetUserPin updated no rows (user missing or inactive).')
      process.exit(1)
    }

    console.log(
      'POS PIN set for:',
      user.full_name,
      '(' + user.username + ')',
      'user_id=',
      user.user_id,
      'store_id=',
      user.store_id
    )
  } finally {
    await pool.close()
  }
}

run().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
