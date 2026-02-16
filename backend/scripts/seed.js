const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const seed = async () => {
  await connectDB();

  const existing = await User.findOne({ username: 'ad1' });
  if (existing) {
    console.log('ℹ️  Admin account (ad1) already exists — skipping.');
    return;
  }

  const hashedPassword = await bcrypt.hash('ad1', 10);
  await User.create({
    username: 'ad1',
    password: hashedPassword,
    role: 'admin',
    name: 'TrackMate Admin',
    email: 'sai254026@gmail.com',
    firstLogin: true
  });

  console.log('✅ Admin account seeded (ad1 / ad1). Change the password after first login.');
};

seed()
  .then(() => {
    console.log('Seeding completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
