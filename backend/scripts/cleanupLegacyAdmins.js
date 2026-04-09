const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = require('../config/db');
const User = require('../models/User');

const LEGACY_USERNAMES = ['ad1', 'suchi'];

const cleanupLegacyAdmins = async () => {
  await connectDB();

  const activeAdminUsername = (process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const toDelete = LEGACY_USERNAMES.filter((u) => u.toLowerCase() !== activeAdminUsername);

  if (toDelete.length === 0) {
    console.log('No legacy admin usernames to delete after excluding ADMIN_USERNAME.');
    return;
  }

  const escaped = toDelete.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const usernameRegex = new RegExp(`^(${escaped.join('|')})$`, 'i');

  const existing = await User.find({
    role: 'admin',
    username: { $regex: usernameRegex }
  }).select('username role');

  if (existing.length === 0) {
    console.log('No legacy hardcoded admin users found.');
    return;
  }

  const result = await User.deleteMany({
    role: 'admin',
    username: { $regex: usernameRegex }
  });

  console.log(`Deleted ${result.deletedCount} legacy admin user(s): ${existing.map((u) => u.username).join(', ')}`);
};

cleanupLegacyAdmins()
  .then(() => {
    console.log('Legacy admin cleanup completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Legacy admin cleanup failed:', error);
    process.exit(1);
  });
