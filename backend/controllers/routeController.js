const Route = require('../models/Route');
const Bus = require('../models/Bus');
const Stop = require('../models/Stop');
const StudentAssignment = require('../models/StudentAssignment');
const { DEFAULT_SEG_SEC } = require('../config/constants');

const normalizeStopsPayload = (stops = []) =>
  stops
    .map((stop, index) => ({
      name: stop.name?.trim() || `Stop ${index + 1}`,
      lat: Number(stop.lat ?? stop.latitude),
      lng: Number(stop.lng ?? stop.longitude),
      seq: stop.seq ?? stop.sequence ?? index
    }))
    .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
    .sort((a, b) => a.seq - b.seq);

const buildStopDocument = (routeId, stop, index) => ({
  route: routeId,
  name: stop.name,
  latitude: stop.lat,
  longitude: stop.lng,
  sequence: Number.isFinite(stop.seq) ? stop.seq : index,
  averageTravelMinutes: Number.isFinite(stop.averageTravelMinutes) ? stop.averageTravelMinutes : 2
});

const syncStopsForRoute = async (routeId, stops) => {
  if (!Array.isArray(stops) || stops.length === 0) {
    return;
  }

  const existingStops = await Stop.find({ route: routeId }).sort({ sequence: 1 });
  if (!existingStops.length) {
    await Stop.insertMany(stops.map((stop, index) => buildStopDocument(routeId, stop, index)));
    return;
  }

  const existingBySequence = new Map(existingStops.map((stop) => [stop.sequence, stop]));
  for (let index = 0; index < stops.length; index += 1) {
    const stop = stops[index];
    const sequence = Number.isFinite(stop.seq) ? stop.seq : index;
    const payload = buildStopDocument(routeId, stop, sequence);
    const existing = existingBySequence.get(sequence);
    if (existing) {
      existingBySequence.delete(sequence);
      await Stop.findByIdAndUpdate(existing._id, payload, { runValidators: true });
    } else {
      await Stop.create(payload);
    }
  }

  if (existingBySequence.size) {
    const removedStops = Array.from(existingBySequence.values());
    const removedIds = removedStops.map((stop) => stop._id);
    await StudentAssignment.deleteMany({ stop: { $in: removedIds } });
    await Stop.deleteMany({ _id: { $in: removedIds } });
  }
};

const buildSegStats = (stops = []) =>
  Array(Math.max(stops.length - 1, 0))
    .fill(null)
    .map(() => ({ avgSec: DEFAULT_SEG_SEC, samples: 1 }));

const createRoute = async (req, res) => {
  try {
    const { name, geojson, stops } = req.body;
    if (!name || !Array.isArray(stops) || stops.length === 0) {
      return res.status(400).json({ message: 'Route name and at least one stop are required' });
    }

    const normalizedStops = normalizeStopsPayload(stops);

    const route = await Route.create({
      name,
      geojson: geojson || null,
      stops: normalizedStops,
      segStats: buildSegStats(normalizedStops)
    });

    await syncStopsForRoute(route._id, normalizedStops);

    res.status(201).json(route);
  } catch (error) {
    console.error('createRoute error', error);
    res.status(500).json({ message: 'Failed to create route', error: error.message });
  }
};

const getRoutes = async (_req, res) => {
  const routes = await Route.find().sort({ createdAt: -1 });
  res.json(routes);
};

const updateRoute = async (req, res) => {
  try {
    const route = await Route.findById(req.params.id);
    if (!route) {
      return res.status(404).json({ message: 'Route not found' });
    }

    if (req.body.name !== undefined) {
      route.name = req.body.name.trim();
    }

    if (req.body.geojson !== undefined) {
      route.geojson = req.body.geojson;
    }

    if (Array.isArray(req.body.stops)) {
      const normalizedStops = normalizeStopsPayload(req.body.stops);
      route.stops = normalizedStops;
      const segments = Math.max(normalizedStops.length - 1, 0);
      const nextSegStats = [];
      for (let idx = 0; idx < segments; idx += 1) {
        nextSegStats[idx] = route.segStats?.[idx] || { avgSec: DEFAULT_SEG_SEC, samples: 1 };
      }
      route.segStats = nextSegStats;
      await syncStopsForRoute(route._id, normalizedStops);
    }

    await route.save();
    res.json(route);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteRoute = async (req, res) => {
  const route = await Route.findByIdAndDelete(req.params.id);
  if (!route) {
    return res.status(404).json({ message: 'Route not found' });
  }

  const routeStops = await Stop.find({ route: route._id }, '_id');
  if (routeStops.length) {
    const stopIds = routeStops.map((stop) => stop._id);
    await StudentAssignment.deleteMany({ stop: { $in: stopIds } });
    await Stop.deleteMany({ _id: { $in: stopIds } });
  }
  await Bus.updateMany({ route: route._id }, { route: null });

  res.json({ message: 'Route removed' });
};

module.exports = { createRoute, getRoutes, updateRoute, deleteRoute };
