import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import { refreshSocketAuth, useSocket } from '../hooks/useSocket';
import { ELURU_SIM_PATH } from '../constants/geo';

const DEFAULT_COORDS = ELURU_SIM_PATH.map((point) => `${point.lat},${point.lng}`).join('\n');

const parseCoordinates = (text) =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lat, lng] = line.split(',').map((value) => Number(value.trim()));
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    })
    .filter(Boolean);

const DriverSimulator = () => {
  const { user } = useAuth();
  const [driverId, setDriverId] = useState(user?.id || user?._id || '');
  const [busId, setBusId] = useState(user?.assignedBusId || '');
  const [tripId, setTripId] = useState('');
  const [coordsText, setCoordsText] = useState(DEFAULT_COORDS);
  const [intervalMs, setIntervalMs] = useState(3000);
  const [status, setStatus] = useState('');
  const [log, setLog] = useState([]);
  const [serverEvents, setServerEvents] = useState([]);
  const [isSimRunning, setIsSimRunning] = useState(false);
  const timerRef = useRef(null);
  const pointerRef = useRef(0);

  const coordsList = useMemo(() => parseCoordinates(coordsText), [coordsText]);

  const appendLog = useCallback((message) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${message}`, ...prev].slice(0, 40));
  }, []);

  const appendEvent = useCallback((label, payload) => {
    setServerEvents((prev) => [
      `${new Date().toLocaleTimeString()} ${label}: ${JSON.stringify(payload)}`,
      ...prev
    ].slice(0, 40));
  }, []);

  const handlers = useMemo(
    () => ({
      'trip:location_update': (data) => appendEvent('trip:location_update', data),
      'trip:stop_arrived': (data) => appendEvent('trip:stop_arrived', data),
      'trip:stop_left': (data) => appendEvent('trip:stop_left', data),
      'trip:eta_update': (data) => appendEvent('trip:eta_update', data)
    }),
    [appendEvent]
  );

  const { socket, isConnected } = useSocket(handlers);

  const cleanupTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSimRunning(false);
  }, []);

  useEffect(() => () => cleanupTimer(), [cleanupTimer]);

  const sendDriverPing = useCallback(
    (coord) => {
      if (!socket) {
        setStatus('Socket not ready. Connect first.');
        return;
      }
      if (!tripId) {
        setStatus('Provide a tripId or start a trip.');
        return;
      }
      if (!busId) {
        setStatus('Bus ID is required to send updates.');
        return;
      }

      const payload = {
        driverId: driverId || user?.id,
        tripId,
        busId,
        lat: coord.lat,
        lng: coord.lng,
        timestamp: Date.now()
      };

      socket.emit('driver:location_update', payload);
      appendLog(`Sent driver:location_update ${coord.lat},${coord.lng}`);
    },
    [appendLog, busId, driverId, socket, tripId, user?.id]
  );

  const handleSendSingle = () => {
    if (!coordsList.length) {
      setStatus('Add at least one coordinate (lat,lng) line.');
      return;
    }
    const coord = coordsList[pointerRef.current % coordsList.length];
    pointerRef.current += 1;
    sendDriverPing(coord);
  };

  const handleStartSimulation = () => {
    if (!coordsList.length) {
      setStatus('Provide coordinates before starting simulation.');
      return;
    }
    if (!tripId) {
      setStatus('Start a trip or provide an existing tripId.');
      return;
    }
    cleanupTimer();
    pointerRef.current = 0;
    const delay = Number(intervalMs) || 3000;
    setIsSimRunning(true);
    appendLog(`Simulation started (${coordsList.length} points @ ${delay}ms).`);

    timerRef.current = setInterval(() => {
      if (pointerRef.current >= coordsList.length) {
        appendLog('Simulation completed path.');
        cleanupTimer();
        return;
      }
      sendDriverPing(coordsList[pointerRef.current]);
      pointerRef.current += 1;
    }, delay);
  };

  const handleStopSimulation = () => {
    appendLog('Simulation stopped.');
    cleanupTimer();
  };

  const handleStartTrip = async () => {
    if (!busId) {
      setStatus('Enter a busId (ObjectId) before starting a trip.');
      return;
    }
    try {
      setStatus('Starting trip...');
      const { data } = await api.post('/trips/start', { busId });
      const createdTripId = data._id || data.id || data.tripId;
      setTripId(createdTripId);
      setStatus(`Trip ready: ${createdTripId}`);
      appendLog(`Trip started (${createdTripId}).`);
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to start trip.';
      setStatus(message);
      appendLog(message);
    }
  };

  const handleConnectSocket = () => {
    refreshSocketAuth();
    setStatus('Requested socket authentication.');
    appendLog('Triggered socket auth refresh.');
  };

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 text-slate-100">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Driver Simulator</h1>
        <p className="text-sm text-slate-500">
          Use this panel to emit driver socket events without GPS hardware.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-700">Trip Context</h2>
          <label className="block text-sm font-medium text-slate-600">
            Driver ID
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              placeholder="Mongo ObjectId"
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Bus ID
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              placeholder="Bus ObjectId"
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Trip ID
            <input
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              placeholder="Auto-filled after starting a trip"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStartTrip}
              className="rounded bg-brand px-4 py-2 text-white"
            >
              Start Trip (POST /api/trips/start)
            </button>
            <button
              type="button"
              onClick={handleConnectSocket}
              className="rounded border border-slate-300 px-4 py-2 text-sm"
            >
              {isConnected ? 'Re-auth Socket' : 'Connect Socket'}
            </button>
          </div>
          <p className="text-sm text-slate-500">
            Socket status: {isConnected ? 'Connected' : 'Disconnected'}
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-700">Coordinate Stream</h2>
          <label className="block text-sm font-medium text-slate-600">
            Coordinates (lat,lng per line)
            <textarea
              className="mt-1 h-40 w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              value={coordsText}
              onChange={(e) => setCoordsText(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-slate-600">
            Interval (ms)
            <input
              type="number"
              min={500}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              value={intervalMs}
              onChange={(e) => setIntervalMs(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSendSingle}
              className="rounded border border-slate-300 px-4 py-2"
            >
              Send Single Location
            </button>
            <button
              type="button"
              onClick={handleStartSimulation}
              className="rounded bg-emerald-600 px-4 py-2 text-white"
              disabled={isSimRunning}
            >
              {isSimRunning ? 'Simulation Running' : 'Start Simulation'}
            </button>
            <button
              type="button"
              onClick={handleStopSimulation}
              className="rounded bg-slate-600 px-4 py-2 text-white"
            >
              Stop Simulation
            </button>
          </div>
        </div>
      </div>

      {status && <div className="rounded border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">{status}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <h3 className="mb-2 text-lg font-semibold text-slate-100">Sent Payloads</h3>
          <pre className="h-64 overflow-y-auto rounded bg-slate-900 p-3 text-xs text-lime-300">
            {log.length ? log.join('\n') : 'No payloads sent yet.'}
          </pre>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <h3 className="mb-2 text-lg font-semibold text-slate-100">Server Events</h3>
          <pre className="h-64 overflow-y-auto rounded bg-slate-900 p-3 text-xs text-cyan-200">
            {serverEvents.length ? serverEvents.join('\n') : 'Listening for trip:location_update / stop events...'}
          </pre>
        </div>
      </div>
    </section>
  );
};

export default DriverSimulator;
