import bcrypt from 'bcrypt';

async function hashPassword(plainPassword) {
  const saltRounds = 10;
  const hashed = await bcrypt.hash(plainPassword, saltRounds);
  return hashed;
}

const passwordToHash = process.argv[2];

if (!passwordToHash) {
  console.error('Please provide a password as a command line argument');
  process.exit(1);
}

hashPassword(passwordToHash)
  .then((hashed) => {
    console.log('Hashed password:', hashed);
  })
  .catch((err) => {
    console.error('Error hashing password:', err);
  });