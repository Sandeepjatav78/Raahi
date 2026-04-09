const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const seed = async () => {
  await connectDB();

  const adminUsername = (process.env.ADMIN_USERNAME || '').trim();
  const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
  const adminName = (process.env.ADMIN_NAME || 'Raahi Admin').trim();
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!adminUsername || !adminPassword) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in backend/.env before running seed.');
  }

  const escapedUsername = adminUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const setOnInsert = {
    username: adminUsername,
    password: hashedPassword,
    role: 'admin',
    name: adminName,
    firstLogin: true
  };

  if (adminEmail) {
    setOnInsert.email = adminEmail;
  }

  const result = await User.updateOne(
    { username: { $regex: new RegExp(`^${escapedUsername}$`, 'i') } },
    {
      $setOnInsert: setOnInsert
    },
    { upsert: true }
  );

  if (result.upsertedCount > 0) {
    console.log(`✅ Admin account seeded (${adminUsername} / from env password). Change the password after first login.`);
  } else {
    console.log(`ℹ️  Admin account (${adminUsername}) already exists — skipping.`);
  }
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
