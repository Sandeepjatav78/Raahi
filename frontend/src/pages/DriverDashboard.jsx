import { useEffect, useMemo, useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { refreshSocketAuth, useSocket } from '../hooks/useSocket';
import useGeolocation from '../hooks/useGeolocation';
import DriverMap from '../components/DriverMap';
import { ELURU_SIM_PATH } from '../constants/geo';
import {
  Play, Square, MapPin, Wifi, WifiOff, Navigation,
  AlertTriangle, Radio, Users, Gauge, Trash2,
  Send, RotateCcw, Terminal, ChevronDown,
  Zap, Satellite, Activity
} from 'lucide-react';

const SIM_PATH = ELURU_SIM_PATH;

const MapClickSimulator = ({ onLocationUpdate }) => {
  useMapEvents({ click(e) { onLocationUpdate(e.latlng); } });
  return null;
};

// ===== SUB-COMPONENTS (dd-* classes) =====

const StatusDot = ({ active }) => (
  <span className={`dd-status-dot ${active ? 'dd-status-dot-live' : ''}`} />
);

// ===== MAIN COMPONENT =====

const DriverDashboard = () => {
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [showSosModal, setShowSosModal] = useState(false);
  const [sosMessage, setSosMessage] = useState('Bus Breakdown');
  const [visitorCount, setVisitorCount] = useState(0);
  const [isSimulationMode, setIsSimulationMode] = useState(false);
  const [simulatedPosition, setSimulatedPosition] = useState(null);
  const [debugLog, setDebugLog] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator?.onLine ?? true);
  const [showDebug, setShowDebug] = useState(false);

  const addLog = (message) => {
    setDebugLog(prev => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 20));
  };

  const { socket, isConnected, emitLocation } = useSocket(
    useMemo(() => ({
      'trip:stop_arrived': (p) => addLog(`✅ ARRIVED: Stop ${p.stopIndex ?? ''}`),
      'trip:stop_left': (p) => addLog(`🚌 LEFT: Stop ${p.stopIndex ?? ''}`),
      'trip:location_update': () => addLog('📍 Location synced'),
      'stats:live_visitors': setVisitorCount
    }), [])
  );

  const { isTracking, permissionStatus, lastPosition, error: geoError, pingsSent, startTracking, stopTracking } =
    useGeolocation({
      onPosition: (position) => {
        if (isSimulationMode || !trip) return;

        const payload = {
          driverId: user?.id || user?._id,
          tripId: trip._id || trip.id,
          busId: trip?.bus?._id || trip?.bus?.id || trip?.bus || user?.assignedBusId,
          lat: position.lat,
          lng: position.lng,
          accuracy: position.accuracy,
          speed: position.speed,
          heading: position.heading,
          timestamp: position.timestamp
        };

        const sent = emitLocation(payload);
        addLog(sent ? `📡 Sent: ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}` : '📦 Buffered (offline)');
        setStatusMessage(sent ? 'Broadcasting location...' : 'Offline - buffering');
      }
    });

  // Online/Offline handlers
  useEffect(() => {
    const handleOnline = () => { setIsOnline(true); refreshSocketAuth(); addLog('🌐 Online'); };
    const handleOffline = () => { setIsOnline(false); addLog('📴 Offline'); };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch active trip
  useEffect(() => {
    const fetchTrip = async () => {
      try {
        const { data } = await api.get('/trips/active');
        if (data?._id) setTrip(data);
      } catch { }
    };
    fetchTrip();
  }, []);

  const handleStartTrip = async () => {
    if (!user?.assignedBusId) {
      setStatusMessage('No bus assigned. Contact admin.');
      return;
    }
    try {
      const { data } = await api.post('/trips/start', { busId: user.assignedBusId });
      setTrip(data);
      refreshSocketAuth();

      // Only start GPS tracking if NOT in simulation mode
      if (!isSimulationMode) {
        startTracking();
        setStatusMessage('Trip started! Broadcasting GPS location.');
      } else {
        setStatusMessage('Trip started! Tap map to teleport bus.');
      }
      addLog(`🚀 Trip started: ${data._id}`);
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Failed to start');
    }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    stopTracking();
    try {
      await api.post(`/trips/${trip._id || trip.id}/end`).catch(() =>
        api.post('/trips/end', { tripId: trip._id || trip.id })
      );
      setTrip(null);
      setStatusMessage('Trip ended.');
      addLog('🏁 Trip ended');
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Failed to end trip');
    }
  };

  const handleManualLocation = (latlng) => {
    if (!trip) return setStatusMessage('Start a trip first');
    if (!isSimulationMode) return setStatusMessage('Enable simulation mode to teleport');

    const payload = {
      driverId: user?.id,
      tripId: trip._id || trip.id,
      busId: trip?.bus?._id || trip?.bus,
      lat: latlng.lat,
      lng: latlng.lng,
      accuracy: 5,
      speed: 12,
      heading: 0,
      timestamp: Date.now(),
      force: true
    };

    emitLocation(payload);

    // Update local simulated position for UI
    setSimulatedPosition({
      lat: latlng.lat,
      lng: latlng.lng,
      speed: 12,
      timestamp: Date.now()
    });

    setStatusMessage(`Teleported to ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
    addLog(`🎯 Teleport: ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}`);
  };

  const handleSos = () => {
    if (!trip) return;
    socket.emit('driver:sos', {
      tripId: trip._id || trip.id,
      location: lastPosition ? { lat: lastPosition.lat, lng: lastPosition.lng } : null,
      message: sosMessage.trim() || 'Bus Breakdown'
    });
    addLog(`🚨 SOS: ${sosMessage}`);
    setShowSosModal(false);
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear today's completed trips?")) return;
    try {
      const { data } = await api.delete('/trips/history/today');
      addLog(data.message);
    } catch { }
  };

  const handleClearTrip = async () => {
    if (!confirm("Clear today's trip and start fresh? This will end any active trip.")) return;
    try {
      // First stop tracking if active
      stopTracking();

      // End active trip if exists
      if (trip) {
        await api.post(`/trips/${trip._id || trip.id}/end`).catch(() =>
          api.post('/trips/end', { tripId: trip._id || trip.id })
        );
      }

      // Clear today's history
      await api.delete('/trips/history/today').catch(() => { });

      // Reset local state
      setTrip(null);
      setStatusMessage('Trip cleared. Ready to start fresh!');
      addLog('🧹 Trip cleared - ready for fresh start');
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Failed to clear trip');
    }
  };

  return (
    <main className="dd-page">
      <div className="dd-container">
        {/* ===== HEADER ===== */}
        <header className="dd-header">
          <div className="dd-header-left">
            <div className="dd-header-avatar">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <p className="dd-header-label">Driver Control Panel</p>
              <h1 className="dd-header-name">{user?.name || user?.username}</h1>
            </div>
          </div>
          <div className="dd-header-right">
            <span className={`dd-live-badge ${isConnected ? 'dd-live-badge-on' : ''}`}>
              <StatusDot active={isConnected} />
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </span>
            <span className="dd-visitors-badge">
              <Users className="w-3.5 h-3.5" />
              {visitorCount}
            </span>
          </div>
        </header>

        {/* ===== DESKTOP GRID ===== */}
        <div className="dd-grid">
          {/* LEFT COLUMN — Controls */}
          <div className="dd-col-left">
            {/* Trip Control Panel */}
            <section className="dd-card dd-card-animate">
              <div className="dd-trip-hero">
                <div className={`dd-trip-icon-ring ${trip ? 'dd-trip-icon-ring-active' : ''}`}>
                  {trip ? (
                    <Radio className="w-8 h-8 dd-trip-icon-pulse" />
                  ) : (
                    <Navigation className="w-8 h-8 dd-trip-icon-idle" />
                  )}
                </div>
                <h2 className="dd-trip-title">{trip ? 'Trip Active' : 'Ready to Start'}</h2>
                <p className="dd-trip-subtitle">
                  {trip ? `Broadcasting to ${visitorCount} student${visitorCount !== 1 ? 's' : ''}` : 'Start a trip to begin live tracking'}
                </p>
              </div>

              {/* Trip Actions */}
              <div className="dd-trip-actions">
                {!trip ? (
                  <button
                    onClick={handleStartTrip}
                    disabled={!user?.assignedBusId}
                    className="dd-btn dd-btn-start"
                  >
                    <Play className="w-5 h-5" />
                    Start Trip
                  </button>
                ) : (
                  <div className="dd-trip-actions-split">
                    <button onClick={handleEndTrip} className="dd-btn dd-btn-end">
                      <Square className="w-5 h-5" />
                      End Trip
                    </button>
                    <button
                      onClick={() => { setSosMessage('Bus Breakdown'); setShowSosModal(true); }}
                      className="dd-btn dd-btn-sos"
                    >
                      <AlertTriangle className="w-5 h-5" />
                      SOS
                    </button>
                  </div>
                )}
              </div>

              {/* Clear Trip */}
              <button onClick={handleClearTrip} className="dd-btn-clear">
                <RotateCcw className="w-4 h-4" />
                Clear Today's Trip
              </button>

              {/* Status Message */}
              {statusMessage && (
                <p className="dd-status-msg">
                  {statusMessage}
                  {!isOnline && <span className="dd-status-offline">(offline)</span>}
                </p>
              )}
            </section>

            {/* System Status Grid */}
            <section className="dd-card dd-card-animate">
              <h3 className="dd-section-title">
                <Activity className="w-4 h-4" />
                System Status
              </h3>
              <div className="dd-stats-grid">
                <div className="dd-stat">
                  <div className={`dd-stat-icon ${isConnected ? 'dd-stat-icon-on' : ''}`}>
                    {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  </div>
                  <div>
                    <span className="dd-stat-label">Socket</span>
                    <span className={`dd-stat-value ${isConnected ? 'dd-stat-value-on' : ''}`}>
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                <div className="dd-stat">
                  <div className={`dd-stat-icon ${!isSimulationMode && permissionStatus === 'granted' ? 'dd-stat-icon-on' : ''}`}>
                    <Satellite className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="dd-stat-label">GPS Mode</span>
                    <span className="dd-stat-value">{isSimulationMode ? 'Simulation' : 'Live GPS'}</span>
                  </div>
                </div>

                <div className="dd-stat">
                  <div className="dd-stat-icon dd-stat-icon-on">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="dd-stat-label">Pings Sent</span>
                    <span className="dd-stat-value">{pingsSent}</span>
                  </div>
                </div>

                <div className="dd-stat">
                  <div className="dd-stat-icon">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="dd-stat-label">Speed</span>
                    <span className="dd-stat-value">
                      {(() => {
                        const pos = isSimulationMode ? simulatedPosition : lastPosition;
                        return pos?.speed ? `${Math.round(pos.speed * 3.6)} km/h` : '0 km/h';
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Simulation Toggle */}
            <section className="dd-card dd-card-animate">
              <div className="dd-sim-header">
                <div>
                  <h3 className="dd-sim-title">Simulation Mode</h3>
                  <p className="dd-sim-subtitle">
                    {isSimulationMode ? 'GPS disabled — Tap map to teleport' : 'GPS active — Real-time location'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newSimMode = !isSimulationMode;
                    setIsSimulationMode(newSimMode);
                    if (newSimMode) {
                      stopTracking();
                      setStatusMessage('Simulation mode ON. GPS disabled. Tap map to teleport.');
                      addLog('🎮 Simulation mode ON - GPS disabled');
                    } else {
                      if (trip) {
                        startTracking();
                        setStatusMessage('Simulation mode OFF. GPS tracking enabled.');
                      }
                      addLog('📍 Simulation mode OFF - GPS enabled');
                    }
                  }}
                  className={`dd-toggle ${isSimulationMode ? 'dd-toggle-on' : ''}`}
                >
                  <span className="dd-toggle-thumb" />
                </button>
              </div>

              <div className={`dd-sim-indicator ${isSimulationMode ? 'dd-sim-indicator-sim' : 'dd-sim-indicator-gps'}`}>
                {isSimulationMode ? (
                  <><Zap className="w-3.5 h-3.5" /> Manual teleport active — GPS is disabled</>
                ) : (
                  <><Satellite className="w-3.5 h-3.5" /> GPS tracking active — Real-time location</>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN — Map + Debug */}
          <div className="dd-col-right">
            {/* Map Panel — DriverMap renders its own card + header */}
            <div className="dd-card-animate">
              <DriverMap
                lastPosition={isSimulationMode ? simulatedPosition : lastPosition}
                busId={trip?.bus?._id || trip?.bus}
                route={trip?.route}
              >
                {isSimulationMode && <MapClickSimulator onLocationUpdate={handleManualLocation} />}
              </DriverMap>
            </div>

            {/* Debug Log */}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="dd-debug-toggle"
            >
              <Terminal className="w-4 h-4" />
              {showDebug ? 'Hide' : 'Show'} Debug Log ({debugLog.length})
              <ChevronDown className={`w-4 h-4 dd-debug-chevron ${showDebug ? 'dd-debug-chevron-open' : ''}`} />
            </button>

            {showDebug && (
              <section className="dd-card dd-card-animate">
                <div className="dd-debug-header">
                  <h3 className="dd-section-title">
                    <Terminal className="w-4 h-4" /> Debug Log
                  </h3>
                  <button onClick={handleClearHistory} className="dd-debug-clear">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <pre className="dd-debug-log">
                  {debugLog.length ? debugLog.join('\n') : 'No events yet...'}
                </pre>
              </section>
            )}
          </div>
        </div>

        {/* GPS Error */}
        {geoError && (
          <div className="dd-card dd-gps-error">
            <AlertTriangle className="w-4 h-4" />
            GPS Error: {geoError}
          </div>
        )}
      </div>

      {/* ===== SOS MODAL ===== */}
      {showSosModal && (
        <div className="dd-modal-overlay">
          <div className="dd-modal">
            <div className="dd-modal-icon-wrap">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="dd-modal-title">Emergency Broadcast</h2>
            <p className="dd-modal-subtitle">Alert all students and admins</p>

            <input
              type="text"
              value={sosMessage}
              onChange={(e) => setSosMessage(e.target.value)}
              placeholder="Describe emergency..."
              className="dd-modal-input"
              autoFocus
            />

            <div className="dd-sos-tags">
              {['Bus Breakdown', 'Flat Tyre', 'Medical Emergency', 'Accident'].map(opt => (
                <button
                  key={opt}
                  onClick={() => setSosMessage(opt)}
                  className="dd-sos-tag"
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="dd-modal-actions">
              <button onClick={() => setShowSosModal(false)} className="dd-btn dd-btn-ghost">
                Cancel
              </button>
              <button onClick={handleSos} className="dd-btn dd-btn-broadcast">
                BROADCAST
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default DriverDashboard;
