const express = require('express');
const { login, getProfile, updateProfile, registerStudent, forgotPassword } = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { sanitizeInput } = require('../middleware/validateMiddleware');

const router = express.Router();

router.post('/login', sanitizeInput, login);
router.post('/register', sanitizeInput, registerStudent);
router.post('/forgot-password', sanitizeInput, forgotPassword);
router.get('/me', authMiddleware, getProfile);
router.put('/profile', authMiddleware, sanitizeInput, updateProfile);

module.exports = router;

