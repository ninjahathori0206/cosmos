require('dotenv').config()
const bcrypt = require('bcryptjs')
const { getPool, sql } = require('../src/config/db')

function looksLikeBcryptHash(v) {
  return /^\$2[abxy]\$\d{2}\$/.test(String(v || ''))
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12)
  const pool = await getPool()

  const usersResult = await pool.request().query(`
    SELECT user_id, username, password
    FROM dbo.users
    WHERE is_active = 1
  `)

  const users = usersResult.recordset || []
  const targets = users.filter((u) => !looksLikeBcryptHash(u.password))

  // eslint-disable-next-line no-console
  console.log(`[migrate-passwords] active users: ${users.length}`)
  // eslint-disable-next-line no-console
  console.log(`[migrate-passwords] legacy plaintext users: ${targets.length}`)

  if (!targets.length) {
    // eslint-disable-next-line no-console
    console.log('[migrate-passwords] nothing to migrate')
    process.exit(0)
  }

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log('[migrate-passwords] dry-run mode; no updates written')
    targets.forEach((u) => {
      // eslint-disable-next-line no-console
      console.log(` - ${u.user_id} ${u.username}`)
    })
    process.exit(0)
  }

  for (const user of targets) {
    const plain = String(user.password || '')
    if (!plain) {
      // eslint-disable-next-line no-console
      console.log(`[migrate-passwords] skip empty password user_id=${user.user_id}`)
      // eslint-disable-next-line no-continue
      continue
    }
    // eslint-disable-next-line no-await-in-loop
    const hashed = await bcrypt.hash(plain, rounds)
    // eslint-disable-next-line no-await-in-loop
    await pool.request()
      .input('uid', sql.Int, user.user_id)
      .input('pwd', sql.VarChar(200), hashed)
      .query('UPDATE dbo.users SET password = @pwd WHERE user_id = @uid')
    // eslint-disable-next-line no-console
    console.log(`[migrate-passwords] migrated user_id=${user.user_id} username=${user.username}`)
  }

  // eslint-disable-next-line no-console
  console.log('[migrate-passwords] completed successfully')
  process.exit(0)
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[migrate-passwords] failed:', err.message)
  process.exit(1)
})

