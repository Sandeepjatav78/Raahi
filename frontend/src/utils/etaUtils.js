const EARTH_RADIUS_M = 6371000;
const DEFAULT_SPEED_MPS = 25 / 3.6; // 25 km/h converted to meters per second

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const haversineDistance = (pointA, pointB) => {
  if (!pointA || !pointB) return null;
  const lat1 = toRadians(pointA.lat);
  const lat2 = toRadians(pointB.lat);
  const deltaLat = toRadians(pointB.lat - pointA.lat);
  const deltaLng = toRadians(pointB.lng - pointA.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
};

export const computeFallbackETA = (busPos, stopPos, speedMps = DEFAULT_SPEED_MPS) => {
  if (!busPos || !stopPos || !speedMps) return null;
  const distance = haversineDistance(busPos, stopPos);
  if (!distance) return null;
  const etaSeconds = distance / speedMps;
  return Math.max(etaSeconds * 1000, 0);
};

export const formatETA = (ms) => {
  if (ms == null) return '—';
  const totalSeconds = Math.max(Math.round(ms / 1000), 0);
  
  // If less than 10 seconds, show "Arriving..."
  if (totalSeconds < 10) {
    return 'Arriving...';
  }
  
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes} min ${seconds.toString().padStart(2, '0')} sec`;
  }
  return `${seconds} sec`;
};

export default {
  computeFallbackETA,
  formatETA
};
