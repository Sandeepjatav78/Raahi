const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const resetAdminFromEnv = async () => {
  await connectDB();

  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = (process.env.ADMIN_PASSWORD || '').trim();
  const name = (process.env.ADMIN_NAME || 'Raahi Admin').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (!username || !password) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required in backend/.env');
  }

  const hashed = await bcrypt.hash(password, 10);
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const update = {
    username,
    password: hashed,
    role: 'admin',
    name,
    firstLogin: true
  };

  if (email) {
    update.email = email;
  }

  const result = await User.updateOne(
    { username: { $regex: new RegExp(`^${escaped}$`, 'i') } },
    { $set: update },
    { upsert: true }
  );

  console.log('Admin synced from env:', {
    username,
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount
  });
};

resetAdminFromEnv()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exit(1);
  });
