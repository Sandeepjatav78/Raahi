const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { JWT_SECRET } = require('../config/constants');
const { sendWelcomeEmail } = require('../utils/emailService');

const SALT_ROUNDS = 10;

const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      role: user.role,
      username: user.username
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );

const serializeUser = (user) => ({
  id: user._id,
  username: user.username,
  role: user.role,
  name: user.name,
  email: user.email,
  phone: user.phone,
  firstLogin: user.firstLogin,
  assignedBusId: user.assignedBusId,
  assignedStopId: user.assignedStopId
});

// Hash a password
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

// Verify password against hash
const verifyPassword = async (password, hash) => {
  // Handle legacy plain-text passwords (migrate on successful login)
  if (!hash.startsWith('$2')) {
    return password === hash;
  }
  return bcrypt.compare(password, hash);
};

// Secure login with bcrypt password verification
const login = async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password.trim() : '';

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    // Case-insensitive lookup — students use roll numbers, admin/drivers use usernames
    let user = await User.findOne({
      username: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    // SECURITY: Auto-creation of default admin is disabled for security.
    // To create the default admin account, run: npm run seed
    // This prevents unauthorized admin account creation in production.

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Migrate legacy plain-text password to bcrypt hash on successful login
    if (!user.password.startsWith('$2')) {
      user.password = await hashPassword(password);
      await user.save();
    }

    const token = signToken(user);
    res.json({
      token,
      user: serializeUser(user),
      firstLogin: user.firstLogin // Flag to redirect to password change
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};

const getProfile = (req, res) => {
  res.json(serializeUser(req.user));
};

// Ensures there is at least one admin as per spec
// This function is now only called during server startup, not on login attempts
const ensureDefaultAccounts = async () => {
  const admin = await User.findOne({ username: 'ad1' });
  if (!admin) {
    const hashedPassword = await hashPassword('ad1');
    await User.create({ username: 'ad1', password: hashedPassword, role: 'admin', name: 'TrackMate Admin' });
    console.log('⚠️  Seeded default admin account (ad1/ad1) - CHANGE THIS PASSWORD IN PRODUCTION!');
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, email, password, currentPassword } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (email) user.email = email.trim().toLowerCase();

    // Password change requires current password verification
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }

      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      user.password = await hashPassword(password.trim());
      user.firstLogin = false; // Mark as no longer first login after password change
    }

    await user.save();
    res.json(serializeUser(user));
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// Register student account (students only - no admin/driver self-registration)
const registerUser = async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toUpperCase() : '';
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!username) {
      return res.status(400).json({ message: 'Roll number is required' });
    }
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (!name) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    // Check if username already exists (case-insensitive — roll numbers may vary in case)
    const existingUser = await User.findOne({
      username: { $regex: new RegExp(`^${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });
    if (existingUser) {
      return res.status(409).json({ message: 'Roll number already registered' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Password is auto-set to the roll number (username)
    const hashedPassword = await hashPassword(username);
    const user = await User.create({
      username,
      password: hashedPassword,
      role: 'student',
      name,
      email,
      firstLogin: true // Force password change on first login
    });

    // Send welcome email with credentials asynchronously
    sendWelcomeEmail({
      email: user.email,
      fullName: user.name,
      username: user.username,
      busNumber: 'Not assigned yet',
      routeName: 'Not assigned yet',
      stopName: 'Not assigned yet'
    }).catch(err => console.error('Welcome email failed:', err.message));

    // Do NOT auto-login — user must check email and log in manually
    res.status(201).json({
      message: 'Account created successfully. Check your email for login credentials.'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
};

// Forgot password — reset to roll number and email it
const forgotPassword = async (req, res) => {
  try {
    const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim() : '';

    if (!identifier) {
      return res.status(400).json({ message: 'Roll number or email is required' });
    }

    // Look up by username (roll number, case-insensitive) or email (already lowercase in DB)
    const user = await User.findOne({
      $or: [
        { username: { $regex: new RegExp(`^${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { email: identifier.toLowerCase() }
      ]
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.email) {
      return res.status(400).json({ message: 'No email associated with this account. Contact admin.' });
    }

    // Reset password to the username (roll number)
    user.password = await hashPassword(user.username);
    user.firstLogin = true; // Force password change on next login
    await user.save();

    // Send password reset email
    const { sendPasswordResetEmail } = require('../utils/emailService');
    sendPasswordResetEmail({
      email: user.email,
      fullName: user.name || user.username,
      username: user.username
    }).catch(err => console.error('Password reset email failed:', err.message));

    res.json({ message: 'Password reset successful. Check your email for login credentials.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

module.exports = { login, getProfile, updateProfile, ensureDefaultAccounts, hashPassword, registerStudent: registerUser, forgotPassword };


