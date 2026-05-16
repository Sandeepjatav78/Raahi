const bcrypt = require('bcryptjs');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Stop = require('../models/Stop');
const Trip = require('../models/Trip');
const StudentAssignment = require('../models/StudentAssignment');
const User = require('../models/User');
const { sendPushNotification } = require('../utils/notificationService');
const { createEventRecord } = require('./eventController');

const EMERGENCY_SEARCH_RADIUS_METERS = Number(process.env.EMERGENCY_SEARCH_RADIUS_METERS) || 5000;

const haversineMeters = (a, b) => {
  if (!a || !b) return Infinity;
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const normalizePhone = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^\d+]/g, '');
  return cleaned || null;
};

const buildPlace = (element, origin) => {
  const tags = element.tags || {};
  const location = element.center || element;
  if (typeof location.lat !== 'number' || typeof location.lon !== 'number') return null;

  const category =
    tags.amenity === 'hospital' ? 'hospital' :
    tags.amenity === 'police' ? 'police' :
    tags.amenity === 'clinic' ? 'clinic' :
    tags.amenity === 'fire_station' ? 'fire_station' :
    tags.emergency === 'ambulance_station' ? 'ambulance_station' :
    'emergency';

  const phone = normalizePhone(tags['contact:phone'] || tags.phone || tags['contact:mobile'] || tags.telephone);

  return {
    id: `${element.type || 'node'}-${element.id}`,
    name: tags.name || tags['operator'] || `${category.replace(/_/g, ' ')} nearby`,
    category,
    phone,
    address: [tags['addr:street'], tags['addr:city'], tags['addr:state']].filter(Boolean).join(', '),
    lat: location.lat,
    lng: location.lon,
    distanceMeters: Math.round(haversineMeters(origin, { lat: location.lat, lng: location.lon }))
  };
};

const fetchNearbyEmergencyServices = async (lat, lng) => {
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node(around:${EMERGENCY_SEARCH_RADIUS_METERS},${lat},${lng})["amenity"~"hospital|police|clinic|fire_station"];
      way(around:${EMERGENCY_SEARCH_RADIUS_METERS},${lat},${lng})["amenity"~"hospital|police|clinic|fire_station"];
      relation(around:${EMERGENCY_SEARCH_RADIUS_METERS},${lat},${lng})["amenity"~"hospital|police|clinic|fire_station"];
      node(around:${EMERGENCY_SEARCH_RADIUS_METERS},${lat},${lng})["emergency"~"ambulance_station|dispatch_center"];
      way(around:${EMERGENCY_SEARCH_RADIUS_METERS},${lat},${lng})["emergency"~"ambulance_station|dispatch_center"];
      relation(around:${EMERGENCY_SEARCH_RADIUS_METERS},${lat},${lng})["emergency"~"ambulance_station|dispatch_center"];
    );
    out center tags;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(overpassQuery)}`
  });

  if (!response.ok) {
    throw new Error(`Overpass request failed (${response.status})`);
  }

  const data = await response.json();
  const origin = { lat: Number(lat), lng: Number(lng) };

  return (Array.isArray(data.elements) ? data.elements : [])
    .map((element) => buildPlace(element, origin))
    .filter(Boolean)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 12);
};

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
    const { username, password, name, phone, photoUrl } = req.body;
    const plainPassword = password || username;
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    
    const driver = await User.create({
      username,
      password: hashedPassword,
      role: 'driver',
      name,
      phone,
      photoUrl: typeof photoUrl === 'string' && photoUrl.trim() ? photoUrl.trim() : null
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
    ['username', 'name', 'phone', 'photoUrl'].forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = typeof req.body[field] === 'string' ? req.body[field].trim() : req.body[field];
      }
    });

    if (req.body.photoUrl !== undefined) {
      updates.photoUrl = req.body.photoUrl ? req.body.photoUrl.trim() : null;
    }

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

const getNearbyEmergencyServices = async (req, res) => {
  const lat = Number(req.query.lat ?? req.body?.lat);
  const lng = Number(req.query.lng ?? req.body?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }

  try {
    const services = await fetchNearbyEmergencyServices(lat, lng);
    res.json({
      origin: { lat, lng },
      services,
      quickContacts: {
        ambulance: { label: 'Ambulance', phone: '108' },
        police: { label: 'Police', phone: '100' }
      }
    });
  } catch (error) {
    console.error('getNearbyEmergencyServices error', error);
    res.status(500).json({
      message: 'Failed to fetch nearby emergency services',
      quickContacts: {
        ambulance: { label: 'Ambulance', phone: '108' },
        police: { label: 'Police', phone: '100' }
      },
      services: []
    });
  }
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
  getDriverAssignedBus,
  getNearbyEmergencyServices
};
