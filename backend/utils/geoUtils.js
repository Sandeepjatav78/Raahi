let turf;
try {
  // eslint-disable-next-line global-require
  turf = require('@turf/turf');
} catch (error) {
  turf = null;
}

const toRad = (value) => (value * Math.PI) / 180;

const normalizePoint = (pointOrLat, lng) => {
  if (typeof pointOrLat === 'number' && typeof lng === 'number') {
    return { lat: pointOrLat, lng };
  }
  if (!pointOrLat) return null;
  if (typeof pointOrLat.lat === 'number' && typeof pointOrLat.lng === 'number') {
    return { lat: pointOrLat.lat, lng: pointOrLat.lng };
  }
  if (typeof pointOrLat.latitude === 'number' && typeof pointOrLat.longitude === 'number') {
    return { lat: pointOrLat.latitude, lng: pointOrLat.longitude };
  }
  return null;
};

const distanceMeters = (pointA, pointB) => {
  const from = normalizePoint(pointA);
  const to = normalizePoint(pointB);
  if (!from || !to) return Infinity;
  const R = 6371000; // meters
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const buildLineString = (geojson) => {
  if (!geojson) return null;
  if (geojson.type === 'LineString') {
    return geojson;
  }
  if (Array.isArray(geojson.coordinates)) {
    return { type: 'LineString', coordinates: geojson.coordinates };
  }
  if (Array.isArray(geojson)) {
    return { type: 'LineString', coordinates: geojson };
  }
  return null;
};

const projectPointOnLineAndRemainingDistance = (geojson, point, targetPoint) => {
  const normalizedPoint = normalizePoint(point);
  const normalizedTarget = targetPoint ? normalizePoint(targetPoint) : null;
  if (!normalizedPoint) {
    return { remainingMeters: Infinity, snappedPoint: null };
  }
  const line = buildLineString(geojson);
  if (!line) {
    const fallbackTarget = normalizedTarget || normalizedPoint;
    return {
      remainingMeters: distanceMeters(normalizedPoint, fallbackTarget),
      snappedPoint: normalizedPoint
    };
  }

  if (!turf) {
    const fallbackTarget = normalizedTarget || {
      lat: line.coordinates[line.coordinates.length - 1][1],
      lng: line.coordinates[line.coordinates.length - 1][0]
    };
    return {
      remainingMeters: distanceMeters(normalizedPoint, fallbackTarget),
      snappedPoint: normalizedPoint
    };
  }

  const lineFeature = turf.lineString(line.coordinates);
  const pointFeature = turf.point([normalizedPoint.lng, normalizedPoint.lat]);
  const snapped = turf.nearestPointOnLine(lineFeature, pointFeature, { units: 'meters' });
  const snappedPoint = {
    lat: snapped.geometry.coordinates[1],
    lng: snapped.geometry.coordinates[0]
  };
  const destination = normalizedTarget
    ? turf.point([normalizedTarget.lng, normalizedTarget.lat])
    : turf.point(line.coordinates[line.coordinates.length - 1]);
  const sliced = turf.lineSlice(snapped, destination, lineFeature);
  const remainingMeters = Math.max(turf.length(sliced, { units: 'kilometers' }) * 1000, 0);

  return { remainingMeters, snappedPoint };
};

module.exports = {
  distanceMeters,
  projectPointOnLineAndRemainingDistance
};
