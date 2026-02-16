const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { listEvents, listEventsForTrip } = require('../controllers/eventController');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('admin'));

router.get('/', listEvents);
router.get('/:tripId', listEventsForTrip);

module.exports = router;
