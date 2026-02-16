const Trip = require('../models/Trip');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const { STALE_TRIP_HOURS } = require('../config/constants');

const startTrip = async (req, res) => {
  try {
    const driverId = req.user._id;
    const { busId } = req.body;
    if (!busId) {
      return res.status(400).json({ message: 'busId is required' });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }
    if (bus.driver && bus.driver.toString() !== driverId.toString()) {
      return res.status(403).json({ message: 'You are not assigned to this bus' });
    }
    if (!bus.route) {
      return res.status(400).json({ message: 'Bus has no route assigned' });
    }

    const route = await Route.findById(bus.route);
    if (!route || route.stops.length === 0) {
      return res.status(400).json({ message: 'Route is missing stops' });
    }

    const existingTrip = await Trip.findOne({ bus: bus._id, status: 'ONGOING' });
    if (existingTrip) {
      return res.json(existingTrip);
    }

    const trip = await Trip.create({
      bus: bus._id,
      driver: driverId,
      route: route._id,
      status: 'ONGOING',
      currentStopIndex: 0,
      startedAt: new Date()
    });

    // Notify listeners that a bus has started a trip
    const io = req.app.get('io');
    if (io) {
      io.emit('bus:trip_started', {
        busId: bus._id.toString(),
        tripId: trip._id.toString(),
        message: 'Trip Started'
      });
    }

    res.status(201).json(trip);
  } catch (error) {
    console.error('startTrip error', error);
    res.status(500).json({ message: 'Failed to start trip', error: error.message });
  }
};

const advanceToNextStop = async (tripId) => {
  const trip = await Trip.findById(tripId);
  if (!trip) {
    return null;
  }
  trip.currentStopIndex += 1;
  await trip.save();
  return trip;
};

// Auto-end stale trips (configurable via STALE_TRIP_HOURS env var, defaults to 12 hours)

const getActiveTrip = async (req, res) => {
  try {
    const trip = await Trip.findOne({ driver: req.user._id, status: 'ONGOING' })
      .populate('bus')
      .populate({ path: 'route', populate: { path: 'stops' } });

    if (!trip) {
      // Return 200 with null to avoid console 404 errors on frontend
      return res.json(null);
    }

    // Check if trip is stale (older than 12 hours)
    const tripAge = Date.now() - new Date(trip.startedAt || trip.createdAt).getTime();
    const maxAge = STALE_TRIP_HOURS * 60 * 60 * 1000;
    
    if (tripAge > maxAge) {
      // Auto-end stale trip
      trip.status = 'COMPLETED';
      trip.endedAt = new Date();
      await trip.save();
      console.log(`[Auto-End] Stale trip ${trip._id} ended (${Math.round(tripAge / 3600000)}h old)`);
      return res.json(null);
    }

    res.json(trip);
  } catch (error) {
    console.error('getActiveTrip error', error);
    res.status(500).json({ message: 'Failed to fetch active trip', error: error.message });
  }
};

const deleteDailyHistory = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const result = await Trip.deleteMany({
      driver: req.user._id,
      status: 'COMPLETED',
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    // Also reset any ONGOING trip to initial state for re-testing
    const activeTrip = await Trip.findOne({ driver: req.user._id, status: 'ONGOING' });
    if (activeTrip) {
      activeTrip.currentStopIndex = 0;
      activeTrip.locations = []; // Clear breadcrumbs
      activeTrip.lastLocation = undefined;
      await activeTrip.save();

      // Clear related stop events for the active trip
      const StopEvent = require('../models/StopEvent');
      await StopEvent.deleteMany({ trip: activeTrip._id });

      // Clear in-memory cache
      const { activeTrips } = require('../inMemory/activeTrips');
      activeTrips.delete(activeTrip._id.toString());
    }

    res.json({ message: `Deleted ${result.deletedCount} completed trips. Active trip reset.` });
  } catch (error) {
    console.error('deleteDailyHistory error', error);
    res.status(500).json({ message: 'Failed to reset history', error: error.message });
  }
};

const endTrip = async (req, res) => {
  try {
    const tripId = req.params.tripId || req.body.tripId;
    if (!tripId) {
      return res.status(400).json({ message: 'tripId is required' });
    }
    const trip = await Trip.findById(tripId);

    if (!trip) {
      return res.status(404).json({ message: 'Trip not found' });
    }

    if (trip.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized. You are not the driver of this trip.' });
    }

    trip.status = 'COMPLETED';
    trip.endedAt = new Date();
    await trip.save();

    // Clear from in-memory cache if it exists (for location tracking)
    try {
      const { activeTrips } = require('../inMemory/activeTrips');
      activeTrips.delete(trip._id.toString());
    } catch (e) {
      // ignore
    }

    res.json({ message: 'Trip ended successfully', trip });
  } catch (error) {
    console.error('endTrip error', error);
    res.status(500).json({ message: 'Failed to end trip', error: error.message });
  }
};

module.exports = { startTrip, advanceToNextStop, getActiveTrip, deleteDailyHistory, endTrip };
