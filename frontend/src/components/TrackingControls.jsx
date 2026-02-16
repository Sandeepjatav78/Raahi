const statusBadgeClass = (isActive) =>
  `px-2 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-200'}`;

const TrackingControls = ({
  isTracking,
  connectionStatus,
  permissionStatus,
  bufferSize,
  lastPosition,
  pingsSent,
  onStartTrip,
  onEndTrip,
  onStartTracking,
  onStopTracking,
  tripId,
  warnings = []
}) => (
  <section className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/80 to-slate-950/60 p-4 shadow-xl shadow-black/40">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-xl font-semibold text-white">Driver Controls</h2>
        <p className="text-xs text-slate-300">Keep this tab active while tracking. Browsers pause GPS in the background.</p>
      </div>
    </header>

    {warnings.length > 0 && (
      <ul className="space-y-1 text-sm text-amber-200">
        {warnings.map((warn) => (
          <li key={warn} className="rounded border border-amber-200 bg-amber-50 px-2 py-1">
            {warn}
          </li>
        ))}
      </ul>
    )}

    <div className="grid gap-3 sm:grid-cols-2">
      {!tripId ? (
        <button
          type="button"
          onClick={onStartTrip}
          className="col-span-2 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-500 px-4 py-4 text-xl font-bold text-white shadow-lg shadow-emerald-500/30 transition hover:scale-[1.02]"
        >
          ▶ Start Trip
        </button>
      ) : (
        <button
          type="button"
          onClick={onEndTrip}
          className="col-span-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-4 py-4 text-xl font-bold text-white shadow-lg shadow-rose-500/30 transition hover:scale-[1.02]"
        >
          ⏹ End Trip
        </button>
      )}
    </div>

    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
        <p className="flex items-center justify-between">
          Socket
          <span className={statusBadgeClass(connectionStatus === 'connected')}>{connectionStatus}</span>
        </p>
        <p className="flex items-center justify-between">
          GPS Permission
          <span className={statusBadgeClass(permissionStatus === 'granted')}>{permissionStatus}</span>
        </p>
        <p className="flex items-center justify-between">
          Tracking
          <span className={statusBadgeClass(isTracking)}>{isTracking ? 'active' : 'stopped'}</span>
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
        <p className="flex items-center justify-between">
          Buffered points
          <span className="font-semibold text-slate-800">{bufferSize}</span>
        </p>
        <p className="flex items-center justify-between">
          Pings sent
          <span className="font-semibold text-slate-800">{pingsSent}</span>
        </p>
        <p className="text-xs text-slate-400">Buffered updates auto-flush once the network reconnects.</p>
      </div>
    </div>

    <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-200">
      <p className="text-sm font-semibold text-white">Last sent location</p>
      {lastPosition ? (
        <ul className="mt-1 space-y-1">
          <li>
            lat/lng: {lastPosition.lat}, {lastPosition.lng}
          </li>
          <li>accuracy: {lastPosition.accuracy ?? 'n/a'} m</li>
          <li>speed: {lastPosition.speed ?? 'n/a'} m/s</li>
          <li>heading: {lastPosition.heading ?? 'n/a'}</li>
          <li>timestamp: {new Date(lastPosition.timestamp).toLocaleTimeString()}</li>
        </ul>
      ) : (
        <p className="mt-1 text-slate-400">No location sent yet.</p>
      )}
    </div>
  </section>
);

export default TrackingControls;
