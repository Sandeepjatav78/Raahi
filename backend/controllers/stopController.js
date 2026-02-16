const Stop = require('../models/Stop');
const Route = require('../models/Route');
const StudentAssignment = require('../models/StudentAssignment');

const normalizeRouteStop = (stop, index) => ({
  name: stop.name?.trim() || `Stop ${index + 1}`,
  latitude: Number(stop.lat ?? stop.latitude),
  longitude: Number(stop.lng ?? stop.longitude),
  sequence: Number.isFinite(stop.seq ?? stop.sequence) ? stop.seq ?? stop.sequence : index,
  averageTravelMinutes: Number.isFinite(stop.averageTravelMinutes) ? stop.averageTravelMinutes : 2
});

const refreshRouteStops = async (routeId) => {
  const stops = await Stop.find({ route: routeId }).sort({ sequence: 1 });
  await Route.findByIdAndUpdate(routeId, {
    stops: stops.map((stop, index) => ({
      name: stop.name,
      lat: stop.latitude,
      lng: stop.longitude,
      seq: Number.isFinite(stop.sequence) ? stop.sequence : index
    }))
  });
};

const ensureStopsExistForRoute = async (routeId) => {
  const existingStops = await Stop.find({ route: routeId }).sort({ sequence: 1 });
  if (existingStops.length) {
    return existingStops;
  }

  const route = await Route.findById(routeId);
  if (!route || !Array.isArray(route.stops) || route.stops.length === 0) {
    return [];
  }

  const docs = route.stops
    .map((stop, index) => ({
      route: routeId,
      ...normalizeRouteStop(stop, index)
    }))
    .filter((stop) => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude));

  if (!docs.length) {
    return [];
  }

  await Stop.insertMany(docs);
  return Stop.find({ route: routeId }).sort({ sequence: 1 });
};

const createStop = async (req, res) => {
  try {
    const stop = await Stop.create(req.body);
    await refreshRouteStops(stop.route);
    res.status(201).json(stop);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getStopsByRoute = async (req, res) => {
  const stops = await ensureStopsExistForRoute(req.params.routeId);
  res.json(stops);
};

const updateStop = async (req, res) => {
  try {
    const stop = await Stop.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!stop) {
      return res.status(404).json({ message: 'Stop not found' });
    }

    await refreshRouteStops(stop.route);
    res.json(stop);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteStop = async (req, res) => {
  const stop = await Stop.findByIdAndDelete(req.params.id);
  if (!stop) {
    return res.status(404).json({ message: 'Stop not found' });
  }

  await refreshRouteStops(stop.route);
  await StudentAssignment.deleteMany({ stop: stop._id });
  res.json({ message: 'Stop removed' });
};

module.exports = { createStop, getStopsByRoute, updateStop, deleteStop };
