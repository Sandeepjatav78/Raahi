const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { createStop, getStopsByRoute, updateStop, deleteStop } = require('../controllers/stopController');

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware('admin'), createStop);
router.get('/:routeId', authMiddleware, roleMiddleware('admin', 'driver', 'student'), getStopsByRoute);
router.put('/:id', authMiddleware, roleMiddleware('admin'), updateStop);
router.delete('/:id', authMiddleware, roleMiddleware('admin'), deleteStop);

module.exports = router;
