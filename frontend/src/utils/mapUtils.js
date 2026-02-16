import * as turf from '@turf/turf';

const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const lineToGeoJSON = (layer) => {
  if (!layer || typeof layer.toGeoJSON !== 'function') return null;
  const geo = layer.toGeoJSON();
  if (!geo || geo.geometry?.type !== 'LineString') {
    return null;
  }
  return geo.geometry;
};

export const markerToStop = (marker, seq, name = `Stop ${seq + 1}`) => {
  if (!marker) return null;
  const latlng = marker.getLatLng();
  return {
    id: uuid(),
    name,
    lat: Number(latlng.lat.toFixed(6)),
    lng: Number(latlng.lng.toFixed(6)),
    seq: seq ?? 0
  };
};

export const reindexStops = (stops = [], options = {}) => {
  const { sort = true } = options;
  const source = sort
    ? stops
        .slice()
        .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    : stops.slice();
  return source.map((stop, index) => ({ ...stop, seq: index }));
};

export const reorderStopsAlongLine = (lineGeom, stops = []) => {
  if (!lineGeom || !Array.isArray(lineGeom.coordinates) || lineGeom.coordinates.length < 2) {
    return reindexStops(stops);
  }

  try {
    const line = turf.lineString(lineGeom.coordinates);
    const enriched = stops.map((stop) => {
      const point = turf.point([stop.lng, stop.lat]);
      const snapped = turf.nearestPointOnLine(line, point, { units: 'meters' });
      return {
        ...stop,
        _distAlongLine: snapped.properties.location || 0
      };
    });

    return enriched
      .sort((a, b) => a._distAlongLine - b._distAlongLine)
      .map((stop, index) => ({ ...stop, seq: index, _distAlongLine: undefined }));
  } catch (error) {
    console.warn('Failed to reorder stops along line', error);
    return reindexStops(stops);
  }
};

export const haversineDistance = (a, b) => {
  if (!a || !b) return Infinity;
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const aVal = sinLat * sinLat + sinLng * sinLng * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return R * c;
};
