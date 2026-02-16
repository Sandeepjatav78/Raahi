const jwt = require('jsonwebtoken');
const StopEvent = require('../models/StopEvent');
const Bus = require('../models/Bus');
const { distanceMeters } = require('../utils/geoUtils');
const { advanceToNextStop } = require('./tripController');
const {
  computeRawEtas,
  smoothEtas,
  etasToArrayOrShape
} = require('../utils/etaCalculator');
const { updateSegmentStats } = require('../utils/segmentStats');
const { getActiveTripState, resetInsideWindow } = require('../inMemory/activeTrips');
const logger = require('../utils/logger');
const {
  JWT_SECRET,
  RADIUS_METERS,
  SUSTAIN_TIME_MS,
  LEAVE_RADIUS_METERS,
  MIN_UPDATE_INTERVAL_MS,
  ETA_EMIT_DELTA_MS,
  MIN_SPEED_MPS,
  ASSUMED_SPEED_MPS
} = require('../config/constants');

const driverThrottle = new Map();

// Cleanup old entries from driverThrottle every 5 minutes to prevent memory leak
const THROTTLE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const THROTTLE_EXPIRY_MS = 10 * 60 * 1000; // Remove entries older than 10 minutes

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of driverThrottle.entries()) {
    if (now - timestamp > THROTTLE_EXPIRY_MS) {
      driverThrottle.delete(key);
    }
  }
}, THROTTLE_CLEANUP_INTERVAL_MS);

/**
 * Persist a stop event to the database
 */
const persistStopEvent = async ({ tripId, stopIndex, stopName, status, location, source }) =>
  StopEvent.create({
    trip: tripId,
    stopIndex,
    stopName,
    status,
    location,
    source
  });

const updateBusLocation = async (busId, coords) => {
  await Bus.findByIdAndUpdate(busId, {
    lastKnownLocation: { ...coords, updatedAt: new Date() }
  });
};

// Maximum number of location breadcrumbs to keep per trip
const MAX_LOCATION_HISTORY = 1000;

const pushLocationUpdate = async (tripId, { lat, lng, speed, heading, timestamp }) => {
  const Trip = require('../models/Trip');
  await Trip.findByIdAndUpdate(tripId, {
    $push: {
      locations: {
        $each: [{
          lat,
          lng,
          speed: speed || 0,
          heading: heading || 0,
          timestamp: timestamp || new Date()
        }],
        $slice: -MAX_LOCATION_HISTORY // Keep only the last N entries
      }
    },
    $set: {
      lastLocation: { lat, lng, updatedAt: new Date() }
    }
  });
};

const shouldEmitEta = (prevCache = {}, smoothed = {}, thresholdMs, force) => {
  if (force) return true;
  return Object.entries(smoothed).some(([stopId, etaMs]) => {
    const previous = prevCache[stopId];
    if (typeof previous !== 'number') return true;
    return Math.abs(previous - etaMs) > thresholdMs;
  });
};

const emitEtaUpdateIfNeeded = (io, tripId, state, rawEtas, { force = false } = {}) => {
  if (!rawEtas || !Object.keys(rawEtas).length) {
    return false;
  }

  const { prevCache, smoothed } = smoothEtas(state, rawEtas);
  const willEmit = shouldEmitEta(prevCache, smoothed, ETA_EMIT_DELTA_MS, force);
  state.etaCache = { ...prevCache, ...smoothed };
  if (!willEmit) {
    return false;
  }
  state.lastEmitTime = Date.now();
  const payload = etasToArrayOrShape(state.etaCache);
  io.to(`trip_${tripId}`).emit('trip:eta_update', {
    tripId,
    etas: payload.array,
    etasMap: payload.map
  });
  return true;
};

const computeSpeedMps = (state, position, providedSpeed, now) => {
  if (typeof providedSpeed === 'number' && providedSpeed > 0) {
    return providedSpeed;
  }
  const lastPosition = state.lastPosition;
  if (lastPosition?.timestamp) {
    const distance = distanceMeters(lastPosition, position);
    const deltaSeconds = (now - lastPosition.timestamp) / 1000;
    if (deltaSeconds > 0) {
      const inferred = distance / deltaSeconds;
      if (inferred >= MIN_SPEED_MPS) {
        return inferred;
      }
    }
  }
  return ASSUMED_SPEED_MPS;
};

const handleDriverLocationUpdate = async (io, socket, payload) => {
  if (!socket.user) {
    socket.emit('auth:error', { message: 'Socket not authenticated' });
    return;
  }

  const { driverId, tripId, busId, lat, lng, timestamp, speed } = payload || {};
  if (!tripId || typeof lat !== 'number' || typeof lng !== 'number') {
    return;
  }

  const driverKey = driverId || socket.user.id;
  const now = Date.now();
  const lastPing = driverThrottle.get(driverKey) || 0;
  if (now - lastPing < MIN_UPDATE_INTERVAL_MS) {
    return;
  }
  driverThrottle.set(driverKey, now);

  const state = await getActiveTripState(tripId);
  if (!state) {
    socket.emit('trip:error', { message: 'Trip not found for tracking' });
    return;
  }

  const room = `trip_${tripId}`;
  socket.join(room);

  // Update Bus Model (Overwrite)
  try {
    await updateBusLocation(state.trip.bus, { lat, lng });
  } catch (err) {
    logger.error('Bus Update Error:', err.message);
  }

  // Persist Breadcrumb (History)
  try {
    await pushLocationUpdate(tripId, { lat, lng, speed, heading: payload?.heading, timestamp: now });
  } catch (err) {
    logger.error('Breadcrumb Error:', err.message);
  }

  let forceEtaEmit = !Object.keys(state.etaCache || {}).length;

  // Look ahead up to 5 stops to handle simulation jumps or GPS drift
  const LOOK_AHEAD = 5;
  let detectedStop = null;
  let detectedIndex = -1;

  for (let i = 0; i < LOOK_AHEAD; i++) {
    const idx = state.currentStopIndex + i;
    if (idx >= state.routeStops.length) break;

    const candidateStop = state.routeStops[idx];
    const dist = distanceMeters({ lat, lng }, { lat: candidateStop.lat, lng: candidateStop.lng });

    if (dist <= RADIUS_METERS) {
      detectedStop = candidateStop;
      detectedIndex = idx;
      break;
    }
  }

  if (detectedStop && detectedIndex > state.currentStopIndex) {
    logger.debug(`[Jump Detected] Fast-forwarding from Stop ${state.currentStopIndex} to ${detectedIndex}`);
    state.currentStopIndex = detectedIndex;
    resetInsideWindow(state, detectedIndex);
  }

  const nextStop = state.routeStops[state.currentStopIndex];
  if (nextStop) {
    const distance = distanceMeters({ lat, lng }, { lat: nextStop.lat, lng: nextStop.lng });

    if (distance <= RADIUS_METERS) {
      state.insideWindow.timestamps.push(now);
      state.insideWindow.timestamps = state.insideWindow.timestamps.filter(
        (ts) => now - ts <= SUSTAIN_TIME_MS
      );

      if (!state.insideWindow.arrivedMarked) {
        const firstTs = state.insideWindow.timestamps[0];
        // If simulated (force: true) or sustained duration met
        if (payload.force || (firstTs && now - firstTs >= SUSTAIN_TIME_MS)) {
          console.log(`[ARRIVED] ${nextStop.name}`);
          state.insideWindow.arrivedMarked = true;
          let arrivalTs = Date.now(); // Default to now

          try {
            const event = await persistStopEvent({
              tripId,
              stopIndex: nextStop.seq,
              stopName: nextStop.name,
              status: 'ARRIVED',
              location: { lat, lng },
              source: 'auto'
            });
            arrivalTs = new Date(event.timestamp).getTime();
            state.arrivalLog[nextStop.seq] = arrivalTs;
            io.to(room).emit('trip:stop_arrived', {
              tripId,
              stopIndex: event.stopIndex,
              stopName: event.stopName,
              timestamp: event.timestamp
            });

            // CRITICAL FIX: Persist the new stop index to DB so clients fetching /trip get the live state
            const Trip = require('../models/Trip');
            await Trip.findByIdAndUpdate(tripId, { currentStopIndex: state.currentStopIndex });

            // Send "Bus Arrived" Push to ALL students on this bus
            // Fire and forget (async)
            (async () => {
              try {
                const StudentAssignment = require('../models/StudentAssignment');
                const { sendPush } = require('./notificationController');

                // Find ALL students on this bus with notification preferences enabled
                const assignments = await StudentAssignment.find({
                  bus: state.trip.bus,
                  'notificationPreferences.enabled': true,
                  'notificationPreferences.arrivalAlert': true
                })
                  .populate('student')
                  .populate('stop', 'sequence name');

                const studentsWithPush = assignments.filter(a => a.student?.pushSubscription);

                console.log(`[Push] Sending arrival notification for stop "${nextStop.name}" to ${studentsWithPush.length} students`);

                for (const assignment of studentsWithPush) {
                  const stu = assignment.student;
                  const studentStopName = assignment.stop?.name || 'your stop';
                  
                  // Customize message based on whether this is their stop
                  const isTheirStop = assignment.stop?.sequence === nextStop.seq;
                  const notifBody = isTheirStop
                    ? `🎯 Bus has arrived at ${event.stopName} - YOUR STOP!`
                    : `Bus has arrived at ${event.stopName}`;
                  
                  await sendPush(stu, {
                    title: isTheirStop ? '🚍 YOUR BUS IS HERE!' : '🚍 Bus Stop Update',
                    body: notifBody,
                    url: '/student',
                    tag: 'stop-arrival',
                    requireInteraction: isTheirStop // Keep notification visible for their stop
                  });
                }
              } catch (pushErr) {
                console.error('Arrival Push Error:', pushErr.message);
              }
            })();

          } catch (evtErr) {
            console.error('Persist Arrived Error:', evtErr.message);
          }

          const previousArrival = typeof nextStop.seq === 'number' ? state.arrivalLog[nextStop.seq - 1] : null;
          if (
            typeof nextStop.seq === 'number' &&
            nextStop.seq > 0 &&
            typeof previousArrival === 'number' &&
            arrivalTs > previousArrival
          ) {
            const observedSec = (arrivalTs - previousArrival) / 1000;
            const updatedSegment = await updateSegmentStats(state.route._id, nextStop.seq - 1, observedSec);
            if (updatedSegment) {
              state.route.segStats = state.route.segStats || [];
              state.route.segStats[nextStop.seq - 1] = updatedSegment;
            }
            forceEtaEmit = true;
          } else {
            forceEtaEmit = true;
          }
        }
      }
    } else {
      state.insideWindow.timestamps = [];
      if (
        state.insideWindow.arrivedMarked &&
        !state.insideWindow.leftMarked &&
        distance >= LEAVE_RADIUS_METERS
      ) {
        state.insideWindow.leftMarked = true;
        const event = await persistStopEvent({
          tripId,
          stopIndex: nextStop.seq,
          stopName: nextStop.name,
          status: 'LEFT',
          location: { lat, lng },
          source: 'auto'
        });
        io.to(room).emit('trip:stop_left', {
          tripId,
          stopIndex: event.stopIndex,
          stopName: event.stopName,
          timestamp: event.timestamp
        });
        
        // Send "Bus Left" notification to ALL students on this bus
        (async () => {
          try {
            const StudentAssignment = require('../models/StudentAssignment');
            const { sendPush } = require('./notificationController');

            const assignments = await StudentAssignment.find({
              bus: state.trip.bus,
              'notificationPreferences.enabled': true
            })
              .populate('student')
              .populate('stop', 'sequence');

            const studentsWithPush = assignments.filter(a => a.student?.pushSubscription);

            console.log(`[Push] Sending departure notification for stop "${nextStop.name}" to ${studentsWithPush.length} students`);

            for (const assignment of studentsWithPush) {
              const stu = assignment.student;
              
              await sendPush(stu, {
                title: '🚍 Bus Departed',
                body: `Bus has left ${event.stopName}`,
                url: '/student',
                tag: 'stop-departure'
              });
            }
          } catch (pushErr) {
            console.error('Departure Push Error:', pushErr.message);
          }
        })();
        
        const updatedTrip = await advanceToNextStop(tripId);
        if (updatedTrip) {
          state.trip = updatedTrip;
          state.currentStopIndex = updatedTrip.currentStopIndex;
        } else {
          state.currentStopIndex += 1;
        }
        resetInsideWindow(state, state.currentStopIndex);
        forceEtaEmit = true;
      }
    }
  }

  const speedMps = computeSpeedMps(state, { lat, lng }, speed, now);
  state.lastPosition = { lat, lng, timestamp: now };

  // 1. IMMEDIATE ECHO: Update UI before doing heavy math/DB
  io.to(room).emit('trip:location_update', {
    tripId,
    busId: busId || state.trip.bus,
    lat,
    lng,
    speed: speedMps, // Add speed (m/s)
    timestamp: timestamp || now
  });

  // 2. Heavy Validations (Stop Logic, ETAs, Push)
  // These can run asynchronously or after the echo
  const rawEtas = await computeRawEtas(state, { lat, lng }, speedMps);
  emitEtaUpdateIfNeeded(io, tripId, state, rawEtas, { force: forceEtaEmit });

  // --- Push Notification Logic (Throttled) ---
  // Check every 15 seconds or so per trip to save DB calls?
  // Or check every time but optimize the DB query.
  // We'll check every time for now, assuming low scale.

  if (!state.notifiedStudents) {
    state.notifiedStudents = new Set();
  }

  const checkPush = async () => {
    try {
      const { sendPush } = require('./notificationController');
      const StudentAssignment = require('../models/StudentAssignment');

      // Find students via StudentAssignment with their stop coordinates
      const assignments = await StudentAssignment.find({
        bus: state.trip.bus
      })
        .populate('student', 'pushSubscription stopCoordinates name')
        .populate('stop', 'latitude longitude name sequence');

      for (const assignment of assignments) {
        const student = assignment.student;
        if (!student || !student.pushSubscription) continue;

        if (state.notifiedStudents.has(student._id.toString())) continue;

        // Try to get stop coordinates from multiple sources
        let stopCoords = null;

        // Priority 1: Student's custom stopCoordinates (if set)
        if (student.stopCoordinates?.lat && student.stopCoordinates?.lng) {
          stopCoords = student.stopCoordinates;
        }
        // Priority 2: Assigned stop's coordinates from Stop collection
        else if (assignment.stop?.latitude && assignment.stop?.longitude) {
          stopCoords = { lat: assignment.stop.latitude, lng: assignment.stop.longitude };
        }
        // Priority 3: Try to find in route's embedded stops by matching sequence
        else if (assignment.stop?.sequence != null && state.routeStops?.length) {
          const matchingRouteStop = state.routeStops.find(
            s => (s.seq ?? s.sequence) === assignment.stop.sequence
          );
          if (matchingRouteStop?.lat && matchingRouteStop?.lng) {
            stopCoords = { lat: matchingRouteStop.lat, lng: matchingRouteStop.lng };
          }
        }

        if (!stopCoords) continue;

        // Get student's notification preferences
        const prefs = assignment.notificationPreferences || {};
        if (prefs.enabled === false) continue; // Notifications disabled

        // Check if already sent proximity alert for this trip
        if (prefs.lastProximityAlertTrip?.toString() === tripId.toString()) continue;

        const dist = distanceMeters({ lat, lng }, stopCoords);

        // Calculate ETA
        const currentSpeed = speedMps > 1 ? speedMps : ASSUMED_SPEED_MPS;
        const etaSeconds = dist / currentSpeed;
        const etaMinutes = Math.ceil(etaSeconds / 60);

        // Get thresholds (use defaults if not set)
        const thresholdMeters = prefs.proximityMeters || 500;
        const thresholdMinutes = prefs.proximityMinutes || 5;

        // Trigger if within EITHER meters OR minutes threshold
        const withinMeters = dist <= thresholdMeters;
        const withinMinutes = etaMinutes <= thresholdMinutes;

        if (withinMeters || withinMinutes) {
          console.log(`[Proximity] Alert to ${student.name}: ${etaMinutes} min (${Math.round(dist)}m)`);

          await sendPush(student, {
            title: `Bus Arriving Soon!`,
            body: `Bus is ${etaMinutes} min away (${Math.round(dist)}m). Get ready!`,
            url: '/student',
            tag: 'proximity-alert',
            icon: '/markers/bus.png'
          });

          // Mark as notified for this trip
          state.notifiedStudents.add(student._id.toString());

          // Update assignment to prevent duplicate alerts this trip
          await StudentAssignment.updateOne(
            { _id: assignment._id },
            { 'notificationPreferences.lastProximityAlertTrip': tripId }
          );
        }
      }
    } catch (err) {
      console.error('Push Check Error:', err.message);
    }
  };

  // Fire and forget, don't await
  checkPush();
};

const handleManualEvent = async (io, socket, payload) => {
  if (!socket.user) {
    return;
  }
  const { tripId, stopIndex, status, lat, lng } = payload || {};
  if (!tripId || typeof stopIndex !== 'number' || !status) {
    return;
  }

  const state = await getActiveTripState(tripId);
  if (!state) {
    return;
  }
  const matchingStop = state.routeStops.find((stop) => stop.seq === stopIndex);
  if (!matchingStop) {
    return;
  }

  const event = await persistStopEvent({
    tripId,
    stopIndex,
    stopName: matchingStop.name,
    status,
    location: { lat, lng },
    source: 'manual'
  });

  if (status === 'ARRIVED') {
    state.currentStopIndex = state.routeStops.findIndex((stop) => stop.seq === stopIndex);
    state.arrivalLog[stopIndex] = new Date(event.timestamp).getTime();
    state.insideWindow = {
      stopIndex,
      timestamps: [],
      arrivedMarked: true,
      leftMarked: false
    };
  } else if (status === 'LEFT') {
    state.insideWindow.leftMarked = true;
    const updatedTrip = await advanceToNextStop(tripId);
    state.trip = updatedTrip || state.trip;
    state.currentStopIndex = updatedTrip?.currentStopIndex || state.currentStopIndex + 1;
    resetInsideWindow(state);
  }

  const room = `trip_${tripId}`;
  io.to(room).emit(
    status === 'ARRIVED' ? 'trip:stop_arrived' : 'trip:stop_left',
    {
      tripId,
      stopIndex: event.stopIndex,
      stopName: event.stopName,
      timestamp: event.timestamp,
      manual: true
    }
  );
};

const registerLocationHandlers = (io) => {
  io.on('connection', (socket) => {
    const authTimeout = setTimeout(() => {
      if (!socket.user) {
        socket.disconnect(true);
      }
    }, 5000);

    const joinedTrips = new Set();

    const subscribeToTrip = (tripId, source = 'student:subscribe') => {
      const normalized = tripId ? tripId.toString() : null;
      if (!normalized) return;
      const room = `trip_${normalized}`;
      socket.join(room);
      joinedTrips.add(normalized);
      socket.emit('trip:subscribed', { tripId: normalized, source });
    };

    const unsubscribeFromTrip = (tripId) => {
      const normalized = tripId ? tripId.toString() : null;
      if (!normalized) return;
      const room = `trip_${normalized}`;
      socket.leave(room);
      joinedTrips.delete(normalized);
      socket.emit('trip:unsubscribed', { tripId: normalized });
    };

    socket.on('auth:token', ({ token }) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        socket.emit('auth:ready');
      } catch (error) {
        socket.emit('auth:error', { message: 'Invalid token' });
        socket.disconnect(true);
      }
    });

    socket.on('student:subscribe', async ({ tripId } = {}) => {
      if (!socket.user) {
        socket.emit('trip:subscription_error', { message: 'Authenticate before subscribing.' });
        return;
      }
      if (!tripId) {
        socket.emit('trip:subscription_error', { message: 'tripId is required.' });
        return;
      }

      // Validate student is assigned to this trip's bus
      try {
        const Trip = require('../models/Trip');
        const StudentAssignment = require('../models/StudentAssignment');

        const trip = await Trip.findById(tripId, 'bus').lean();
        if (!trip) {
          socket.emit('trip:subscription_error', { message: 'Trip not found.' });
          return;
        }

        // Only validate for students (drivers and admins can subscribe freely)
        if (socket.user.role === 'student') {
          const assignment = await StudentAssignment.findOne({
            student: socket.user.id,
            bus: trip.bus
          }).lean();

          if (!assignment) {
            socket.emit('trip:subscription_error', { message: 'Not authorized for this trip.' });
            return;
          }
        }

        subscribeToTrip(tripId);
      } catch (err) {
        console.error('[Socket] Subscription validation error:', err.message);
        // Fail open for now - allow subscription if validation errors
        subscribeToTrip(tripId);
      }
    });

    socket.on('student:unsubscribe', ({ tripId } = {}) => {
      if (!tripId) return;
      unsubscribeFromTrip(tripId);
    });

    socket.on('join', ({ room, tripId } = {}) => {
      const resolvedTripId = tripId || (typeof room === 'string' && room.startsWith('trip_') ? room.slice(5) : null);
      const targetRoom = room || (resolvedTripId ? `trip_${resolvedTripId}` : null);
      if (!targetRoom) {
        socket.emit('trip:subscription_error', { message: 'Room or tripId is required.' });
        return;
      }
      socket.join(targetRoom);
      if (resolvedTripId) {
        joinedTrips.add(resolvedTripId);
        socket.emit('trip:subscribed', { tripId: resolvedTripId, source: 'legacy:join' });
      }
    });

    socket.on('admin:join', () => {
      if (socket.user && socket.user.role === 'admin') {
        socket.join('admin_room');
        socket.emit('admin:joined');
      }
    });

    socket.on('driver:location_update', (payload) =>
      handleDriverLocationUpdate(io, socket, payload)
    );
    socket.on('driver:manual_event', (payload) => handleManualEvent(io, socket, payload));

    socket.on('driver:sos', async ({ tripId, location, message } = {}) => {
      if (!socket.user || !tripId) return;
      const sosMessage = message || 'Bus Breakdown';
      console.log(`[SOS] Received from Driver ${socket.user.id} for Trip ${tripId}: ${sosMessage}`);

      try {
        // Persist SOS event
        await StopEvent.create({
          trip: tripId,
          stopIndex: -1, // Special index for SOS
          stopName: 'EMERGENCY ALERT',
          status: 'SOS',
          message: sosMessage,
          location: location || null,
          source: 'manual',
          timestamp: Date.now()
        });

        // Broadcast
        const alertPayload = {
          tripId,
          message: `EMERGENCY ALERT: ${sosMessage}`,
          location: location || null,
          timestamp: Date.now()
        };
        io.to(`trip_${tripId}`).emit('trip:sos', alertPayload);
        io.to('admin_room').emit('trip:sos', alertPayload);

        // Notify
        const { sendSOSNotification } = require('../utils/notificationService');
        sendSOSNotification({ tripId, message: sosMessage, location });

      } catch (err) {
        console.error('Failed to process SOS event:', err);
      }
    });

    socket.on('disconnect', () => {
      clearTimeout(authTimeout);
    });
  });

  // --- HEARTBEAT ETA RECALCULATION ---
  // Recalculate ETAs every 30 seconds for all active trips, even if no GPS update received
  // This ensures students see updated ETAs based on time passing
  const ETA_HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

  setInterval(async () => {
    try {
      const { activeTrips } = require('../inMemory/activeTrips');
      const now = Date.now();

      for (const [tripId, state] of activeTrips.entries()) {
        // Skip if no last position (trip just started, no GPS yet)
        if (!state.lastPosition) continue;

        // Skip if we received a GPS update recently (within 15 seconds)
        const lastUpdate = state.lastPosition.timestamp || 0;
        if (now - lastUpdate < 15000) continue;

        // Recalculate ETAs based on last known position
        const { lat, lng } = state.lastPosition;

        // Use a conservative speed since bus might be stationary
        const rawEtas = await computeRawEtas(state, { lat, lng }, ASSUMED_SPEED_MPS);

        if (Object.keys(rawEtas).length > 0) {
          // Emit updated ETAs to all subscribers
          emitEtaUpdateIfNeeded(io, tripId, state, rawEtas, { force: false });
        }
      }
    } catch (err) {
      console.error('[ETA Heartbeat] Error:', err.message);
    }
  }, ETA_HEARTBEAT_INTERVAL_MS);
};

module.exports = { registerLocationHandlers };
