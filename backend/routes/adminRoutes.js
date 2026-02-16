const express = require('express');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
  assignStudent,
  getAssignments,
  updateAssignment,
  deleteAssignment,
  getActiveTrips,
  getEventHistory,
  getDashboardStats,
  fixStudentData,
  clearEvents
} = require('../controllers/adminController');
const {
  createDriverAccount,
  getDrivers,
  updateDriverAccount,
  deleteDriverAccount
} = require('../controllers/driverController');
const {
  listStudents,
  createStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/studentAdminController');

const router = express.Router();

// Rate limit for CSV export to prevent abuse
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 export requests per window
  message: { message: 'Too many export requests, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/fix-data', fixStudentData);
// Export route before auth middleware - handles its own token auth for browser downloads
// Rate limited to prevent abuse
router.get('/export-trips', exportLimiter, require('../controllers/adminController').exportTripsCSV);

router.use(authMiddleware, roleMiddleware('admin'));

router.get('/dashboard', getDashboardStats);
router.post('/assignments', assignStudent);
router.get('/assignments', getAssignments);
router.put('/assignments/:id', updateAssignment);
router.delete('/assignments/:id', deleteAssignment);
router.get('/trips', getActiveTrips);
router.get('/live-buses', require('../controllers/adminController').getLiveBusPositions);
router.get('/analytics', require('../controllers/adminController').getTripAnalytics);
router.get('/events', getEventHistory);
router.delete('/events', clearEvents);
router.post('/drivers', createDriverAccount);
router.get('/drivers', getDrivers);
router.put('/drivers/:id', updateDriverAccount);
router.delete('/drivers/:id', deleteDriverAccount);
router.get('/students', listStudents);
router.post('/students', createStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);

module.exports = router;
