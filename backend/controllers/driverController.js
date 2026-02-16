const bcrypt = require('bcryptjs');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const Trip = require('../models/Trip');
const StudentAssignment = require('../models/StudentAssignment');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/notificationService');
const { createEventRecord } = require('./eventController');

const computeSnapshotEtaMinutes = ({ orderedStops = [], currentIndex = 0, targetStopId, defaultMinutes = Number(process.env.DEFAULT_ETA_MINUTES) || 2 }) => {
  if (!orderedStops.length || !targetStopId) {
    return defaultMinutes;
  }
  const normalizedIndex = Math.max(currentIndex, 0);
  const targetIndex = orderedStops.findIndex((stop) => stop._id.toString() === targetStopId.toString());
  if (targetIndex === -1) {
    return defaultMinutes;
  }
  let eta = 0;
  for (let idx = normalizedIndex; idx < targetIndex; idx += 1) {
    const stop = orderedStops[idx];
    const minutes = stop?.averageTravelMinutes || defaultMinutes;
    eta += minutes;
  }
  return eta || defaultMinutes;
};

// Admin: create driver accounts quickly (password defaults to username when missing)
const createDriverAccount = async (req, res) => {
  try {
    const { username, password, name, phone } = req.body;
    const plainPassword = password || username;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    const driver = await User.create({
      username,
      password: hashedPassword,
      role: 'driver',
      name,
      phone
    });
    res.status(201).json(driver);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getDrivers = async (_req, res) => {
  const drivers = await User.find({ role: 'driver' }).select('-password');
  res.json(drivers);
};

const updateDriverAccount = async (req, res) => {
  try {
    const updates = {};
    ['username', 'name', 'phone'].forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    });

    if (req.body.password) {
      updates.password = await bcrypt.hash(req.body.password.trim(), 10);
    }

    const driver = await User.findOneAndUpdate({ _id: req.params.id, role: 'driver' }, updates, {
      new: true,
      runValidators: true
    }).select('-password');

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.json(driver);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteDriverAccount = async (req, res) => {
  const driver = await User.findOneAndDelete({ _id: req.params.id, role: 'driver' });
  if (!driver) {
    return res.status(404).json({ message: 'Driver not found' });
  }

  await Bus.updateMany({ driver: driver._id }, { driver: null });
  res.json({ message: 'Driver removed' });
};

// Driver: start a trip for their assigned bus
const startTrip = async (req, res) => {
  const { busId } = req.body;
  const bus = await Bus.findById(busId);

  if (!bus) {
    return res.status(404).json({ message: 'Bus not found' });
  }

  if (bus.driver && bus.driver.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You are not assigned to this bus' });
  }

  if (!bus.route) {
    return res.status(400).json({ message: 'Bus is missing a route assignment' });
  }

  const activeTrip = await Trip.findOne({ bus: busId, status: 'ONGOING' });
  if (activeTrip) {
    return res.status(200).json(activeTrip);
  }

  const trip = await Trip.create({
    bus: busId,
    driver: req.user._id,
    route: bus.route,
    status: 'ONGOING',
    startedAt: new Date(),
    currentStopIndex: 0
  });

  res.status(201).json(trip);
};

// Driver: share GPS updates periodically
const shareLocation = async (req, res) => {
  const { tripId, lat, lng } = req.body;
  const trip = await Trip.findById(tripId);

  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }

  if (trip.driver.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You are not the driver of this trip' });
  }

  const timestamp = new Date();
  trip.lastLocation = { lat, lng, updatedAt: timestamp };
  await trip.save();

  await Bus.findByIdAndUpdate(trip.bus, {
    lastKnownLocation: { lat, lng, updatedAt: timestamp }
  });

  const io = req.app.get('io');
  const payload = { busId: trip.bus, lat, lng, timestamp };
  if (io) {
    io.to(`bus_${trip.bus}`).emit('driver:location_update', payload);
    io.emit('admin:trip_updates', { tripId: trip._id, ...payload });
  }

  res.json({ message: 'Location updated' });
};

// Driver: mark ARRIVED/LEFT events
const recordStopEvent = async (req, res) => {
  const { tripId, stopId, status } = req.body;
  const trip = await Trip.findById(tripId).populate('route');
  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }
  if (trip.driver.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You are not the driver of this trip' });
  }

  const stop = await Stop.findById(stopId);
  if (!stop) {
    return res.status(404).json({ message: 'Stop not found' });
  }

  const orderedStops = await Stop.find({ route: trip.route }).sort({ sequence: 1 });
  const stopIndex = orderedStops.findIndex((item) => item._id.toString() === stopId);

  trip.currentStopIndex = stopIndex === -1 ? trip.currentStopIndex : stopIndex;
  if (status === 'LEFT' && stopIndex !== -1) {
    trip.currentStopIndex = stopIndex + 1;
  }
  await trip.save();

  const etaMinutes = computeSnapshotEtaMinutes({
    orderedStops,
    currentIndex: trip.currentStopIndex,
    targetStopId: stopId
  });

  const event = await createEventRecord({
    trip: tripId,
    stop: stopId,
    status,
    etaMinutes
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`bus_${trip.bus}`).emit('driver:event_update', {
      tripId,
      stopId,
      status,
      etaMinutes,
      timestamp: event.timestamp
    });
    io.emit('admin:trip_updates', {
      tripId,
      stopId,
      status,
      etaMinutes,
      timestamp: event.timestamp
    });
  }

  if (status === 'LEFT') {
    await sendPushNotification({
      busId: trip.bus,
      title: 'Stop update',
      body: `${stop.name} has been left`
    });
  }

  res.status(201).json(event);
};

const endTrip = async (req, res) => {
  const { tripId } = req.body;
  const trip = await Trip.findById(tripId);
  if (!trip) {
    return res.status(404).json({ message: 'Trip not found' });
  }
  if (trip.driver.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'You are not the driver of this trip' });
  }
  trip.status = 'COMPLETED';
  trip.endedAt = new Date();
  await trip.save();

  const io = req.app.get('io');
  if (io) {
    io.emit('admin:trip_updates', { tripId: trip._id, status: 'COMPLETED' });
  }

  res.json({ message: 'Trip completed' });
};

const markApproaching = async (req, res) => {
  const { busId } = req.body;
  await sendPushNotification({
    busId,
    title: 'Bus approaching',
    body: 'Your driver marked the stop as approaching'
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`bus_${busId}`).emit('driver:event_update', {
      busId,
      status: 'APPROACHING',
      timestamp: new Date()
    });
  }

  res.json({ message: 'Approaching notification sent' });
};

const getDriverActiveTrip = async (req, res) => {
  const trip = await Trip.findOne({ driver: req.user._id, status: 'ONGOING' })
    .populate('bus')
    .populate({ path: 'route', populate: { path: 'stops' } });
  res.json(trip);
};

const getDriverAssignedBus = async (req, res) => {
  const driver = await User.findById(req.user._id).populate({
    path: 'driverMeta.bus',
    populate: [{ path: 'route' }]
  });
  res.json(driver?.driverMeta?.bus || null);
};

module.exports = {
  createDriverAccount,
  getDrivers,
  updateDriverAccount,
  deleteDriverAccount,
  startTrip,
  shareLocation,
  recordStopEvent,
  endTrip,
  markApproaching,
  getDriverActiveTrip,
  getDriverAssignedBus
};
