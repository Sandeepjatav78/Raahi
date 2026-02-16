const Bus = require('../models/Bus');
const User = require('../models/User');
const Trip = require('../models/Trip');

const assignDriverMeta = async (driverId, busId) => {
  if (!driverId) return;
  await User.findByIdAndUpdate(driverId, {
    assignedBusId: busId,
    'driverMeta.bus': busId
  });
};

const clearDriverMeta = async (driverId) => {
  if (!driverId) return;
  await User.findByIdAndUpdate(driverId, {
    assignedBusId: null,
    $unset: { 'driverMeta.bus': '' }
  });
};

// Admin: create a bus and optionally assign a driver + route
const createBus = async (req, res) => {
  try {
    const bus = await Bus.create(req.body);

    if (bus.driver) {
      await assignDriverMeta(bus.driver, bus._id);
    }

    res.status(201).json(bus);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getBuses = async (_req, res) => {
  try {
    const buses = await Bus.find()
      .populate('driver', 'username name')
      .populate('route', 'name stops');
    res.json(buses);
  } catch (error) {
    console.error('getBuses error:', error);
    res.status(500).json({ message: 'Failed to fetch buses', error: error.message });
  }
};

const updateBus = async (req, res) => {
  try {
    const previous = await Bus.findById(req.params.id);
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    if (previous?.driver && (!bus.driver || previous.driver.toString() !== bus.driver.toString())) {
      await clearDriverMeta(previous.driver);
    }

    if (bus.driver) {
      await assignDriverMeta(bus.driver, bus._id);
    }

    res.json(bus);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteBus = async (req, res) => {
  try {
    // Check for active trips before deletion
    const activeTrip = await Trip.findOne({ bus: req.params.id, status: 'ONGOING' });
    if (activeTrip) {
      return res.status(400).json({ 
        message: 'Cannot delete bus with an active trip. End the trip first.' 
      });
    }

    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }
    
    if (bus.driver) {
      await clearDriverMeta(bus.driver);
    }
    res.json({ message: 'Bus removed' });
  } catch (error) {
    console.error('deleteBus error:', error);
    res.status(500).json({ message: 'Failed to delete bus', error: error.message });
  }
};

module.exports = { createBus, getBuses, updateBus, deleteBus };
