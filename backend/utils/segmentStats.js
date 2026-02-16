const Route = require('../models/Route');
const { DEFAULT_SEG_SEC, SEG_ALPHA } = require('../config/constants');

const ensureSegStatsShape = (routeDoc, { persist = false } = {}) => {
  if (!routeDoc) return [];
  const segments = Math.max((routeDoc.stops?.length || 0) - 1, 0);
  routeDoc.segStats = Array.isArray(routeDoc.segStats) ? [...routeDoc.segStats] : [];
  let touched = false;
  for (let idx = 0; idx < segments; idx += 1) {
    if (!routeDoc.segStats[idx]) {
      routeDoc.segStats[idx] = { avgSec: DEFAULT_SEG_SEC, samples: 1 };
      touched = true;
    }
    if (typeof routeDoc.segStats[idx].avgSec !== 'number') {
      routeDoc.segStats[idx].avgSec = DEFAULT_SEG_SEC;
      touched = true;
    }
    if (typeof routeDoc.segStats[idx].samples !== 'number') {
      routeDoc.segStats[idx].samples = 1;
      touched = true;
    }
  }
  if (routeDoc.segStats.length > segments) {
    routeDoc.segStats = routeDoc.segStats.slice(0, segments);
    touched = true;
  }
  if (touched && persist && typeof routeDoc.markModified === 'function') {
    routeDoc.markModified('segStats');
    return routeDoc.save();
  }
  return routeDoc.segStats;
};

const updateSegmentStats = async (routeId, segIdx, observedSec) => {
  if (!routeId || segIdx < 0 || !Number.isFinite(observedSec)) {
    return null;
  }
  const route = await Route.findById(routeId);
  if (!route) return null;
  ensureSegStatsShape(route);
  const segment = route.segStats[segIdx] || { avgSec: observedSec, samples: 0 };
  const previousAvg = typeof segment.avgSec === 'number' ? segment.avgSec : observedSec;
  const nextAvg = SEG_ALPHA * observedSec + (1 - SEG_ALPHA) * previousAvg;
  segment.avgSec = nextAvg;
  segment.samples = (segment.samples || 0) + 1;
  route.segStats[segIdx] = segment;
  route.markModified('segStats');
  await route.save();
  return segment;
};

module.exports = {
  updateSegmentStats,
  ensureSegStatsShape
};
