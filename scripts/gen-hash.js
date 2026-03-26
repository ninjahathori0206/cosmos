const bcrypt = require('bcryptjs');

async function main() {
  const password = 'Admin@123';
  const hash = await bcrypt.hash(password, 10);
  // eslint-disable-next-line no-console
  console.log('Password:', password);
  // eslint-disable-next-line no-console
  console.log('Hash:', hash);
}

main();

