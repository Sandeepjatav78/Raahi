const DEFAULT_SPEED_MPS = 25 / 3.6;
const EARTH_RADIUS_M = 6371000;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

export const distanceMeters = (pointA, pointB) => {
  if (!pointA || !pointB) return null;
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_M * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

export const computeFallbackETA = (busPos, stopPos, speedMps = DEFAULT_SPEED_MPS) => {
  if (!busPos || !stopPos || !speedMps) return null;
  const distance = distanceMeters(busPos, stopPos);
  if (!distance) return null;
  return Math.max((distance / speedMps) * 1000, 0);
};

export const formatETA = (ms) => {
  if (ms == null) return '—';
  const totalSeconds = Math.max(Math.round(ms / 1000), 0);
  if (totalSeconds < 10) return 'Arriving...';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, '0')} sec` : `${seconds} sec`;
};
