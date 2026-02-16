const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { startTrip, getActiveTrip, deleteDailyHistory, endTrip } = require('../controllers/tripController');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('driver'));

router.post('/start', startTrip);
router.get('/active', getActiveTrip);
router.delete('/history/today', deleteDailyHistory);
router.post('/:tripId/end', endTrip);
router.post('/end', endTrip); // Fallback for legacy calls if any

module.exports = router;
