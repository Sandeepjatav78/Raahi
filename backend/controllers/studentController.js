const Stop = require('../models/Stop');
const Trip = require('../models/Trip');
const StudentAssignment = require('../models/StudentAssignment');
const { getCachedTripState } = require('../inMemory/activeTrips');
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const Attendance = require('../models/Attendance');

const extractBusCandidatesFromQr = (qrCodeRaw) => {
  if (!qrCodeRaw || typeof qrCodeRaw !== 'string') return [];

  const raw = qrCodeRaw.trim();
  if (!raw) return [];

  const candidates = new Set();
  const add = (value) => {
    if (!value || typeof value !== 'string') return;
    const normalized = value.trim();
    if (normalized) candidates.add(normalized);
  };

  // Legacy values: BUS:<id-or-plate> or direct id/plate.
  add(raw.replace(/^BUS:/i, '').trim());
  add(raw);

  // Structured payload used by admin QR generator.
  if (/^RAAHI\|/i.test(raw)) {
    const parts = raw.split('|').map((part) => part.trim());
    // Expected: RAAHI|<busId>|<routeId>|<numberPlate>
    add(parts[1]);
    add(parts[3]);
  }

  // JSON payload support, e.g. { busId, numberPlate }
  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    try {
      const parsed = JSON.parse(raw);
      add(parsed?.busId);
      add(parsed?.numberPlate);
      add(parsed?.bus?.id);
      add(parsed?.bus?.numberPlate);
    } catch {
      // Ignore malformed JSON and continue with string candidates.
    }
  }

  return Array.from(candidates);
};

const resolveLegacyStopId = async ({ busId, stopSequence }) => {
  if (!busId || stopSequence == null) return null;

  const bus = await Bus.findById(busId).select('route').lean();
  if (!bus?.route) return null;

  const stop = await Stop.findOne({
    route: bus.route,
    sequence: Number(stopSequence)
  }).select('_id');

  return stop?._id || null;
};

const getOrCreateAssignment = async (user) => {
  const userId = user?._id?.toString?.() || user?.id;
  if (!userId) return null;

  let assignment = await StudentAssignment.findOne({ student: userId });
  const legacyBusId = user?.assignedBusId;
  const legacyStopSeq = user?.assignedStopId;

  if (!assignment && legacyBusId) {
    const legacyStopId = await resolveLegacyStopId({ busId: legacyBusId, stopSequence: legacyStopSeq });
    assignment = await StudentAssignment.findOneAndUpdate(
      { student: userId },
      {
        $setOnInsert: {
          student: userId,
          bus: legacyBusId,
          stop: legacyStopId || null
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
    return assignment;
  }

  if (assignment && !assignment.stop && legacyStopSeq != null) {
    const legacyStopId = await resolveLegacyStopId({
      busId: assignment.bus || legacyBusId,
      stopSequence: legacyStopSeq
    });

    if (legacyStopId) {
      assignment.stop = legacyStopId;
      await assignment.save();
    }
  }

  return assignment;
};

// Improved fallback: works with both stopId and sequence number
const fallbackEtaMs = async ({ trip, targetStopId, targetStopSeq }) => {
  if (!trip) return null;

  // Try to get stops from route's embedded stops first (more reliable)
  const route = await Route.findById(trip.route);
  let orderedStops = [];

  if (route?.stops?.length > 0) {
    // Use embedded stops from route (sorted by seq)
    orderedStops = [...route.stops].sort((a, b) => (a.seq || 0) - (b.seq || 0));
  } else {
    // Fallback to physical Stop collection
    orderedStops = await Stop.find({ route: trip.route }).sort({ sequence: 1 });
  }

  if (!orderedStops.length) return null;

  const currentIndex = Math.max(trip.currentStopIndex || 0, 0);

  // Find target stop by sequence (primary) or by _id (fallback)
  let targetIndex = -1;
  if (targetStopSeq != null) {
    targetIndex = orderedStops.findIndex((stop) =>
      String(stop.seq ?? stop.sequence) === String(targetStopSeq)
    );
  }
  if (targetIndex === -1 && targetStopId) {
    targetIndex = orderedStops.findIndex((stop) =>
      String(stop._id) === String(targetStopId)
    );
  }

  if (targetIndex === -1 || targetIndex <= currentIndex) {
    return null;
  }

  let etaMs = 0;
  for (let idx = currentIndex; idx < targetIndex; idx += 1) {
    const stop = orderedStops[idx];
    const minutes = stop?.averageTravelMinutes || Number(process.env.DEFAULT_ETA_MINUTES) || 2;
    etaMs += minutes * 60 * 1000;
  }
  return etaMs;
};

const StopEvent = require('../models/StopEvent'); // Required

const getAssignment = async (req, res) => {
  const assignment = await getOrCreateAssignment(req.user);

  if (!assignment) {
    return res.json(null);
  }

  const hydratedAssignment = await StudentAssignment.findById(assignment._id)
    .populate('bus', 'name numberPlate lastKnownLocation')
    .populate('stop');

  // Fetch recent events for the active trip of this bus
  let recentEvents = [];
  const activeTrip = await Trip.findOne({ bus: hydratedAssignment.bus?._id, status: 'ONGOING' });

  if (activeTrip) {
    recentEvents = await StopEvent.find({ trip: activeTrip._id })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
  }

  const response = hydratedAssignment.toObject();
  response.recentEvents = recentEvents;

  res.json(response);
};

const getEta = async (req, res) => {
  const assignmentDoc = await getOrCreateAssignment(req.user);
  const assignment = assignmentDoc
    ? await StudentAssignment.findById(assignmentDoc._id)
    .populate('stop')
    .populate('bus')
    : null;

  if (!assignment) {
    return res.status(404).json({ message: 'No assignment found' });
  }

  const trip = await Trip.findOne({ bus: assignment.bus._id, status: 'ONGOING' }).populate('route');
  if (!trip) {
    return res.json({ etaMs: null, source: 'no-trip' });
  }

  const targetStopId = assignment.stop?._id?.toString();
  // Get sequence from both possible field names
  const targetStopSeq = assignment.stop?.sequence ?? assignment.stop?.seq;
  const targetStopSeqStr = targetStopSeq != null ? String(targetStopSeq) : null;

  const activeState = getCachedTripState(trip._id);

  // Try to find ETA in cache - check by sequence FIRST (our primary key now)
  let liveEta = null;

  if (activeState?.etaCache) {
    // Priority 1: Match by sequence (our standardized key)
    if (targetStopSeqStr && typeof activeState.etaCache[targetStopSeqStr] === 'number') {
      liveEta = activeState.etaCache[targetStopSeqStr];
    }
    // Priority 2: Match by MongoDB _id (legacy support)
    if (typeof liveEta !== 'number' && targetStopId && typeof activeState.etaCache[targetStopId] === 'number') {
      liveEta = activeState.etaCache[targetStopId];
    }
    // Priority 3: Search through all entries for a match
    if (typeof liveEta !== 'number') {
      const cacheEntries = Object.entries(activeState.etaCache);
      for (const [key, value] of cacheEntries) {
        if (typeof value === 'number' && (key === targetStopSeqStr || key === targetStopId)) {
          liveEta = value;
          break;
        }
      }
    }
  }

  if (typeof liveEta === 'number') {
    return res.json({
      etaMs: Math.max(0, Math.round(liveEta)),
      etaMinutes: Math.ceil(liveEta / 60000),
      source: 'live'
    });
  }

  // Fallback calculation with both ID and sequence
  const fallbackMs = await fallbackEtaMs({ trip, targetStopId, targetStopSeq });
  return res.json({
    etaMs: fallbackMs,
    etaMinutes: fallbackMs ? Math.ceil(fallbackMs / 60000) : null,
    source: 'fallback'
  });
};

const registerNotificationToken = async (req, res) => {
  const { token } = req.body;
  const assignmentDoc = await getOrCreateAssignment(req.user);
  if (!assignmentDoc) {
    return res.status(404).json({ message: 'No assignment found' });
  }
  const assignment = await StudentAssignment.findByIdAndUpdate(
    assignmentDoc._id,
    { notificationToken: token },
    { new: true }
  );
  res.json(assignment);
};

const getLiveTrip = async (req, res) => {
  const assignment = await getOrCreateAssignment(req.user);
  if (!assignment) {
    return res.json(null); // No assignment yet — not an error
  }

  const trip = await Trip.findOne({ bus: assignment.bus, status: 'ONGOING' })
    .populate('bus', 'name lastKnownLocation')
    .populate('driver', 'name phone')
    .populate('route'); // This fetches the full route with stops array

  if (!trip) {
    return res.json(null);
  }

  const response = trip.toObject();
  const stops = response.route?.stops || [];
  const idx = response.currentStopIndex || 0;

  response.currentStop = stops[idx] || null;
  response.nextStop = stops[idx + 1] || null;
  response.progress = {
    totalStops: stops.length,
    completedStops: idx,
    percentage: stops.length ? Math.round((idx / stops.length) * 100) : 0
  };

  res.json(response);
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { enabled, proximityMinutes, proximityMeters, arrivalAlert } = req.body;

    let assignment = await StudentAssignment.findOne({ student: userId });
    if (!assignment) {
      return res.status(400).json({ message: 'No bus assignment yet. Please select a bus in your profile first.' });
    }

    // Initialize preferences if not exists
    if (!assignment.notificationPreferences) {
      assignment.notificationPreferences = {};
    }

    // Update only provided fields
    if (typeof enabled === 'boolean') {
      assignment.notificationPreferences.enabled = enabled;
    }
    if (typeof proximityMinutes === 'number' && proximityMinutes >= 1 && proximityMinutes <= 30) {
      assignment.notificationPreferences.proximityMinutes = proximityMinutes;
    }
    if (typeof proximityMeters === 'number' && proximityMeters >= 100 && proximityMeters <= 2000) {
      assignment.notificationPreferences.proximityMeters = proximityMeters;
    }
    if (typeof arrivalAlert === 'boolean') {
      assignment.notificationPreferences.arrivalAlert = arrivalAlert;
    }

    await assignment.save();

    res.json({
      message: 'Preferences updated',
      preferences: assignment.notificationPreferences
    });
  } catch (error) {
    console.error('updateNotificationPreferences error:', error);
    res.status(500).json({ message: 'Failed to update preferences', error: error.message });
  }
};

// Get current notification preferences
const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const assignment = await StudentAssignment.findOne({ student: userId });

    // Return defaults when no assignment exists yet (new students)
    const prefs = assignment?.notificationPreferences || {
      enabled: true,
      proximityMinutes: 5,
      proximityMeters: 500,
      arrivalAlert: true
    };

    res.json(prefs);
  } catch (error) {
    console.error('getNotificationPreferences error:', error);
    res.status(500).json({ message: 'Failed to get preferences', error: error.message });
  }
};

// Update student's own assignment (bus/stop)

const updateMyAssignment = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { busId, stopSeq } = req.body;

    if (!busId) {
      return res.status(400).json({ message: 'Bus is required' });
    }

    // Get bus with route info
    const bus = await Bus.findById(busId).populate('route');
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    // Find or create assignment
    let assignment = await StudentAssignment.findOne({ student: userId });

    if (!assignment) {
      // Create new assignment
      assignment = new StudentAssignment({
        student: userId,
        bus: busId,
        stop: null
      });
    } else {
      assignment.bus = busId;
    }

    // Set stop by sequence if provided - must look up from Stop collection
    if (stopSeq != null && bus.route) {
      // Look up the actual Stop document from the Stop collection
      const stopDoc = await Stop.findOne({
        route: bus.route._id,
        sequence: stopSeq
      });
      if (stopDoc) {
        assignment.stop = stopDoc._id;
      } else {
        // Fallback: try to match by name in route's embedded stops
        const embeddedStop = bus.route.stops?.find(s => s.seq === stopSeq);
        if (embeddedStop) {
          // Create a Stop document if it doesn't exist
          const newStop = await Stop.findOneAndUpdate(
            { route: bus.route._id, sequence: stopSeq },
            {
              route: bus.route._id,
              name: embeddedStop.name,
              latitude: embeddedStop.lat,
              longitude: embeddedStop.lng,
              sequence: stopSeq,
              averageTravelMinutes: 2
            },
            { upsert: true, new: true }
          );
          assignment.stop = newStop._id;
        }
      }
    }

    await assignment.save();

    // Populate for response
    await assignment.populate('bus', 'name numberPlate');
    await assignment.populate('stop');

    res.json({
      message: 'Assignment updated',
      assignment: {
        bus: assignment.bus,
        stop: assignment.stop
      }
    });
  } catch (error) {
    console.error('updateMyAssignment error:', error);
    res.status(500).json({ message: 'Failed to update assignment', error: error.message });
  }
};

// Get buses with routes for student selection
const getBusesWithRoutes = async (req, res) => {
  try {
    const buses = await Bus.find()
      .populate({
        path: 'route',
        select: 'name stops',
        populate: { path: 'stops', select: 'name seq sequence' }
      })
      .select('name numberPlate route');

    // Format response with stops
    const result = buses.map(bus => ({
      _id: bus._id,
      name: bus.name,
      numberPlate: bus.numberPlate,
      route: bus.route ? {
        _id: bus.route._id,
        name: bus.route.name,
        stops: (bus.route.stops || []).map(s => ({
          _id: s._id,
          name: s.name,
          seq: s.seq ?? s.sequence
        })).sort((a, b) => a.seq - b.seq)
      } : null
    }));

    res.json(result);
  } catch (error) {
    console.error('getBusesWithRoutes error:', error);
    res.status(500).json({ message: 'Failed to get buses', error: error.message });
  }
};

const getLiveBusesForStudents = async (req, res) => {
  try {
    const [buses, assignment] = await Promise.all([
      Bus.find({ isActive: true })
        .populate('route', 'name')
        .populate('driver', 'name username')
        .select('name numberPlate route driver lastKnownLocation isActive')
        .lean(),
      getOrCreateAssignment(req.user)
    ]);

    const busIds = buses.map((bus) => bus._id);
    const activeTrips = await Trip.find({ status: 'ONGOING', bus: { $in: busIds } })
      .populate('route', 'name')
      .select('_id bus route lastLocation')
      .lean();

    const tripMap = new Map(activeTrips.map((trip) => [String(trip.bus), trip]));
    const assignedBusId = assignment?.bus ? String(assignment.bus) : null;

    const result = buses
      .map((bus) => {
        const activeTrip = tripMap.get(String(bus._id));
        const effectiveLocation = activeTrip?.lastLocation || bus.lastKnownLocation || null;
        return {
          _id: bus._id,
          name: bus.name,
          numberPlate: bus.numberPlate,
          routeName: bus.route?.name || activeTrip?.route?.name || 'Unassigned route',
          driverName: bus.driver?.name || bus.driver?.username || 'No driver',
          lastKnownLocation: effectiveLocation,
          isLive: Boolean(activeTrip),
          tripId: activeTrip?._id || null,
          isAssignedToMe: assignedBusId ? assignedBusId === String(bus._id) : false
        };
      })
      .sort((a, b) => {
        if (a.isAssignedToMe && !b.isAssignedToMe) return -1;
        if (!a.isAssignedToMe && b.isAssignedToMe) return 1;
        if (a.isLive && !b.isLive) return -1;
        if (!a.isLive && b.isLive) return 1;
        return a.name.localeCompare(b.name);
      });

    res.json(result);
  } catch (error) {
    console.error('getLiveBusesForStudents error:', error);
    res.status(500).json({ message: 'Failed to fetch live buses', error: error.message });
  }
};

const markAttendanceByQr = async (req, res) => {
  try {
    const qrCodeRaw = typeof req.body?.qrCode === 'string' ? req.body.qrCode.trim() : '';
    if (!qrCodeRaw) {
      return res.status(400).json({ message: 'QR code is required' });
    }

    const qrCandidates = extractBusCandidatesFromQr(qrCodeRaw);
    const assignmentDoc = await getOrCreateAssignment(req.user);
    const assignment = assignmentDoc
      ? await StudentAssignment.findById(assignmentDoc._id).populate('bus', 'name numberPlate')
      : null;

    if (!assignment?.bus) {
      return res.status(400).json({ message: 'No bus assignment found for student' });
    }

    const assignedBusId = String(assignment.bus._id);
    const assignedPlate = assignment.bus.numberPlate?.toUpperCase();
    const isMatchedToAssignedBus = qrCandidates.some((candidate) => {
      const normalizedCandidate = candidate.trim();
      return (
        normalizedCandidate === assignedBusId ||
        normalizedCandidate.toUpperCase() === assignedPlate
      );
    });

    if (!isMatchedToAssignedBus) {
      return res.status(400).json({
        message: 'Scanned QR does not match your assigned bus',
        assignedBus: {
          id: assignment.bus._id,
          name: assignment.bus.name,
          numberPlate: assignment.bus.numberPlate
        }
      });
    }

    const activeTrip = await Trip.findOne({ bus: assignment.bus._id, status: 'ONGOING' }).select('_id');
    const attendanceDate = new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOneAndUpdate(
      {
        student: req.user._id,
        bus: assignment.bus._id,
        attendanceDate
      },
      {
        $set: {
          qrCode: qrCodeRaw,
          trip: activeTrip?._id || null,
          scannedAt: new Date(),
          status: 'present'
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );

    res.json({
      message: 'Attendance marked successfully',
      attendance,
      bus: {
        _id: assignment.bus._id,
        name: assignment.bus.name,
        numberPlate: assignment.bus.numberPlate
      }
    });
  } catch (error) {
    console.error('markAttendanceByQr error:', error);
    res.status(500).json({ message: 'Failed to mark attendance', error: error.message });
  }
};

module.exports = {
  getAssignment,
  getEta,
  registerNotificationToken,
  getLiveTrip,
  updateNotificationPreferences,
  getNotificationPreferences,
  updateMyAssignment,
  getBusesWithRoutes,
  getLiveBusesForStudents,
  markAttendanceByQr
};
