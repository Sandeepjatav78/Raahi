// Validate required environment variables
const requiredEnvVars = ['JWT_SECRET'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

if (missingVars.length > 0 && process.env.NODE_ENV === 'production') {
  console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

const DEFAULT_STALE_TRIP_HOURS = 12;

module.exports = {
  RADIUS_METERS: 75,           // Realistic stop detection radius (~75 meters)
  SUSTAIN_TIME_MS: 3000,       // 3 seconds dwell time to confirm arrival
  LEAVE_RADIUS_METERS: 80,
  MIN_UPDATE_INTERVAL_MS: 1000,
  ETA_ALPHA: 0.25,
  SEG_ALPHA: 0.15,
  MIN_SPEED_MPS: 0.8,
  ASSUMED_SPEED_MPS: 5, // ~18 km/h - conservative for stopped/traffic scenarios
  DEFAULT_SEG_SEC: 120,
  ETA_EMIT_DELTA_MS: 5000,
  DEFAULT_STALE_TRIP_HOURS,
  STALE_TRIP_HOURS: parseInt(process.env.STALE_TRIP_HOURS || String(DEFAULT_STALE_TRIP_HOURS), 10),
  // In development, use fallback. In production, require env var (validated above)
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'trackmate_dev_secret_change_in_prod' : ''),
  OSRM_BASE_URL: process.env.OSRM_BASE_URL || 'http://router.project-osrm.org',
  OSRM_CACHE_TTL_MS: 15000, // 15 seconds for responsive ETAs
  // VAPID keys - generate with: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || '',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || ''
};
