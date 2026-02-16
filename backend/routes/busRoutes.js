const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { createBus, getBuses, updateBus, deleteBus } = require('../controllers/busController');

const router = express.Router();

router.use(authMiddleware, roleMiddleware('admin'));

router.post('/', createBus);
router.get('/', getBuses);
router.put('/:id', updateBus);
router.delete('/:id', deleteBus);

module.exports = router;
