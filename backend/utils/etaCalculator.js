
const {
  MIN_SPEED_MPS,
  ASSUMED_SPEED_MPS,
  DEFAULT_SEG_SEC,
  ETA_ALPHA,
  OSRM_BASE_URL,
  OSRM_CACHE_TTL_MS
} = require('../config/constants');
const { distanceMeters, projectPointOnLineAndRemainingDistance } = require('./geoUtils');
const logger = require('./logger');

/**
 * Resolve a consistent stop ID for ETA tracking
 * Priority: seq > sequence > stopRef > _id > id
 * @param {Object} stop - Stop object
 * @returns {string|null} Resolved stop ID
 */
const resolveStopId = (stop) => {
  if (!stop) return null;
  // PRIORITY: Use seq/sequence as primary key for consistent frontend/backend matching
  if (typeof stop.seq === 'number') return String(stop.seq);
  if (typeof stop.sequence === 'number') return String(stop.sequence);
  // Fallback to MongoDB IDs if seq not available
  if (stop.stopRef) return stop.stopRef.toString();
  if (stop._id) return stop._id.toString();
  if (stop.id) return stop.id.toString();
  return null;
};

/**
 * Calculate remaining distance from current position to a stop
 * @param {Object} routeDoc - Route document with geojson
 * @param {Object} position - Current position {lat, lng}
 * @param {Object} stop - Target stop {lat, lng}
 * @returns {number} Distance in meters
 */
const remainingDistanceToStop = (routeDoc, position, stop) => {
  if (!position || !stop) return Infinity;
  const geojson = routeDoc?.geojson;
  if (geojson) {
    const result = projectPointOnLineAndRemainingDistance(geojson, position, stop);
    if (Number.isFinite(result?.remainingMeters)) {
      return result.remainingMeters;
    }
  }
  return distanceMeters(position, stop);
};

// --- OSRM Helpers ---

const buildOsrmUrl = (coords) => {
  // Coords: [[lng, lat], [lng, lat], ...]
  if (coords.length < 2) return null;
  const points = coords.map(([lng, lat]) => `${lng},${lat}`).join(';');
  return `${OSRM_BASE_URL}/route/v1/driving/${points}?overview=false`;
};

/**
 * Fetch driving durations from OSRM routing service
 * @param {Array} stops - Array of stops with lat/lng
 * @param {Object} currentPos - Current position {lat, lng}
 * @returns {Promise<Array|null>} Array of leg durations in seconds, or null on failure
 */
const fetchOsrmDurations = async (stops, currentPos) => {
  try {
    const coords = [[currentPos.lng, currentPos.lat]];
    stops.forEach(s => coords.push([s.lng, s.lat]));

    const url = buildOsrmUrl(coords);
    if (!url) return null;

    logger.debug('[OSRM] Fetching route durations');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    try {
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        logger.warn(`OSRM Error: ${resp.statusText}`);
        return null;
      }
      const data = await resp.json();
      if (!data.routes || !data.routes.length) return null;

      return data.routes[0].legs.map(leg => leg.duration);
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        logger.debug('OSRM request timed out, using linear estimates');
      } else {
        logger.warn('OSRM Fetch Failed:', fetchErr.message);
      }
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    logger.error('OSRM Setup Failed:', err.message);
    return null;
  }
};

const computeRawEtas = async (state, position, speedMps = 0) => {
  if (!state?.routeStops?.length || !state.trip) {
    return {};
  }
  const orderedStops = state.routeStops;
  const trip = state.trip;
  const segStats = Array.isArray(state.route?.segStats) ? state.route.segStats : [];
  const upcomingIndex = Math.min(Math.max(trip.currentStopIndex || 0, 0), orderedStops.length - 1);
  const nextStop = orderedStops[upcomingIndex];
  if (!nextStop) {
    return {};
  }

  const rawEtas = {};
  const now = Date.now();
  
  // Use a more conservative speed when stationary or slow
  const velocity = speedMps >= MIN_SPEED_MPS ? speedMps : ASSUMED_SPEED_MPS;

  // Check/Refresh OSRM Cache - now includes CURRENT POSITION -> all remaining stops
  let osrmCache = state.osrmCache;
  const cacheValid = osrmCache && 
    (now - osrmCache.timestamp <= OSRM_CACHE_TTL_MS) && 
    osrmCache.startIndex === upcomingIndex;

  if (!cacheValid) {
    // Reset cache and query OSRM for: CurrentPosition -> NextStop -> Stop+1 -> ...
    state.osrmCache = { timestamp: now, durations: [], firstSegmentDuration: null, startIndex: upcomingIndex };
    
    const remainingStops = orderedStops.slice(upcomingIndex);
    if (remainingStops.length > 0) {
      // Query OSRM: Current Position -> All Remaining Stops (includes first segment!)
      const durations = await fetchOsrmDurations(remainingStops, position);
      
      if (durations && durations.length > 0) {
        // durations[0] = CurrentPos -> NextStop (first segment, road distance!)
        // durations[1] = NextStop -> Stop+1, etc.
        state.osrmCache.firstSegmentDuration = durations[0]; // seconds
        state.osrmCache.durations = durations.slice(1); // remaining segments
        state.osrmCache.startIndex = upcomingIndex;
      }
    }
  }

  // 1. Calculate ETA to NEXT stop
  // Always compute real distance first - more accurate when close to stop
  const distToNext = remainingDistanceToStop(state.route, position, nextStop) || 0;
  
  let nextEtaMs;
  
  // If within 100m of stop, use real-time distance calculation (not cached OSRM)
  if (distToNext < 100) {
    nextEtaMs = (distToNext / velocity) * 1000;
  } else if (typeof state.osrmCache.firstSegmentDuration === 'number') {
    // Use OSRM road distance for first segment when far from stop
    nextEtaMs = state.osrmCache.firstSegmentDuration * 1000;
  } else {
    // Fallback: Use route projection or haversine
    nextEtaMs = (distToNext / velocity) * 1000;
  }
  
  // Ensure ETA doesn't go negative
  nextEtaMs = Math.max(0, nextEtaMs);

  const nextStopId = resolveStopId(nextStop);
  rawEtas[nextStopId] = nextEtaMs;

  // 2. Calculate ETAs for subsequent stops
  const subsequentStops = orderedStops.slice(upcomingIndex); // [NextStop, Next+1, ...]
  const useOsrm = state.osrmCache?.durations?.length > 0 && state.osrmCache.startIndex === upcomingIndex;

  let cumulativeMs = nextEtaMs;

  for (let i = 0; i < subsequentStops.length - 1; i++) {
    const targetS = subsequentStops[i + 1];
    let segmentDurationMs;

    if (useOsrm && typeof state.osrmCache.durations[i] === 'number') {
      // OSRM segment duration (already in seconds, convert to ms)
      segmentDurationMs = state.osrmCache.durations[i] * 1000;
    } else {
      // Fallback to historical stats or default
      const originalIdx = upcomingIndex + i;
      const segment = segStats[originalIdx] || {};
      const avgSec = typeof segment.avgSec === 'number' ? segment.avgSec : DEFAULT_SEG_SEC;
      segmentDurationMs = avgSec * 1000;
    }

    cumulativeMs += segmentDurationMs;
    const stopId = resolveStopId(targetS);
    rawEtas[stopId] = cumulativeMs;
  }

  return rawEtas;
};

const smoothEtas = (state, rawEtas = {}) => {
  const previousCache = state.etaCache || {};
  const smoothed = {};
  Object.entries(rawEtas).forEach(([stopId, etaMs]) => {
    const previous = previousCache[stopId];
    if (typeof previous === 'number') {
      smoothed[stopId] = previous + ETA_ALPHA * (etaMs - previous);
    } else {
      smoothed[stopId] = etaMs;
    }
  });
  return { prevCache: previousCache, smoothed };
};

const etasToArrayOrShape = (etaMap = {}) => {
  const entries = Object.entries(etaMap).map(([stopId, etaMs]) => ({
    stopId,
    etaMs: Math.max(0, Math.round(etaMs))
  }));
  const etasMap = entries.reduce((acc, entry) => {
    acc[entry.stopId] = entry.etaMs;
    return acc;
  }, {});
  return { array: entries, map: etasMap };
};

module.exports = {
  computeRawEtas,
  smoothEtas,
  etasToArrayOrShape,
  resolveStopId
};
