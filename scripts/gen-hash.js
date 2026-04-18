/**
 * Legacy helper — Cosmos stores passwords as plain VARCHAR(200) in dbo.users.password.
 * Use Command Unit → Users to set passwords, or seed via sql/seed/01_seed_core.sql.
 */
function main() {
  const password = 'Admin@123';
  // eslint-disable-next-line no-console
  console.log('Plain password (store in dbo.users.password):', password);
  // eslint-disable-next-line no-console
  console.log('Example: UPDATE dbo.users SET password = @pwd WHERE username = @u');
}

main();
