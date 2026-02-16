const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
  startTrip,
  shareLocation,
  recordStopEvent,
  endTrip,
  markApproaching,
  getDriverActiveTrip,
  getDriverAssignedBus
} = require('../controllers/driverController');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('driver'));

router.get('/bus', getDriverAssignedBus);
router.get('/trip', getDriverActiveTrip);
router.post('/trips/start', startTrip);
router.post('/trips/location', shareLocation);
router.post('/trips/event', recordStopEvent);
router.post('/trips/end', endTrip);
router.post('/approaching', markApproaching);

module.exports = router;
