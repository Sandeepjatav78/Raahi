const StopEvent = require('../models/StopEvent');

const createEventRecord = async ({ trip, stop, stopIndex, stopName, status, etaMinutes, location, source = 'manual' }) => {
  // Ensure required fields are provided
  const resolvedStopIndex = stopIndex ?? (stop?.sequence ?? stop?.seq ?? 0);
  const resolvedStopName = stopName ?? stop?.name ?? `Stop ${resolvedStopIndex}`;
  
  return StopEvent.create({ 
    trip, 
    stop: stop?._id || stop,
    stopIndex: resolvedStopIndex,
    stopName: resolvedStopName,
    status, 
    etaMinutes,
    location,
    source
  });
};

const listEvents = async (_req, res) => {
  const events = await StopEvent.find()
    .sort({ timestamp: -1 })
    .limit(100)
    .populate('trip', 'bus driver')
    .populate('stop', 'name sequence');
  res.json(events);
};

const listEventsForTrip = async (req, res) => {
  const { tripId } = req.params;
  const events = await StopEvent.find({ trip: tripId })
    .sort({ timestamp: -1 })
    .populate('stop', 'name sequence');
  res.json(events);
};

module.exports = {
  createEventRecord,
  listEvents,
  listEventsForTrip
};
