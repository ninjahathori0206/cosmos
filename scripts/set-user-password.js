/**
 * Set password for a Cosmos user (bcrypt, same rounds as src/api/users.js).
 * Usage: node scripts/set-user-password.js <usernameOrNameFragment> <newPassword>
 * Example: node scripts/set-user-password.js Kamal "Admin@123"
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const sql = require('mssql')

const BCRYPT_ROUNDS = 12

const config = {
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
  if (!needle || !plain) {
    console.error('Usage: node scripts/set-user-password.js <usernameOrNameFragment> <newPassword>')
    process.exit(1)
  }

  const pool = await sql.connect(config)
  try {
    const find = await pool.request()
      .input('n', sql.VarChar(100), needle.trim())
      .query(`
        SELECT user_id, username, full_name, role_key, is_active
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
      console.error('Multiple matches; use exact username. Found:')
      rows.forEach((r) => console.error(`  ${r.user_id}  ${r.username}  ${r.full_name}`))
      process.exit(1)
    }

    const user = rows[0]
    const hash = await bcrypt.hash(plain, BCRYPT_ROUNDS)
    await pool.request()
      .input('uid', sql.Int, user.user_id)
      .input('pwd', sql.VarChar(200), hash)
      .query('UPDATE dbo.users SET password_hash = @pwd, updated_at = DATEADD(MINUTE, 330, SYSUTCDATETIME()) WHERE user_id = @uid')

    console.log('Password updated for:', user.username, '(' + user.full_name + ')', 'user_id=', user.user_id)
  } finally {
    await pool.close()
  }
}

run().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
