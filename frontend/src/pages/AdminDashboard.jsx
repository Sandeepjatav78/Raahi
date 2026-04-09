import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { API_BASE_URL } from '../constants/api';
import { useSocket } from '../hooks/useSocket';
import {
  Bus, Users, UserCheck, Navigation, Clock, MapPin,
  AlertTriangle, RefreshCw, Trash2, ChevronRight, Activity, Octagon, Map, Download
} from 'lucide-react';
import AdminMap from '../components/AdminMap';
import TrackMateLoader from '../components/TrackMateLoader';

// ===== COMPONENTS =====

const StatCard = ({ icon: Icon, label, value, detail, color = 'indigo' }) => {
  const colors = {
    indigo: 'bg-indigo-500/15 text-indigo-300',
    emerald: 'bg-emerald-500/15 text-emerald-300',
    sky: 'bg-sky-500/15 text-sky-300',
    purple: 'bg-purple-500/15 text-purple-300',
  };

  return (
    <div className="card p-5 border border-white/10 shadow-sm hover:shadow-lg transition-all">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-300 truncate">{label}</p>
          {detail && <p className="text-xs text-slate-500 mt-1">{detail}</p>}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-3xl font-semibold text-white">{value ?? '—'}</p>
    </div>
  );
};

const TripCard = ({ trip }) => (
  <div className="p-4 rounded-3xl border border-white/10 bg-slate-900/60 hover:bg-slate-900/80 transition">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-3xl bg-emerald-500/15 flex items-center justify-center">
        <Bus className="w-5 h-5 text-emerald-300" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{trip.bus?.name || 'Unknown Bus'}</p>
        <p className="text-sm text-slate-400">Driver: {trip.driver?.name || trip.driver?.username || 'Unknown'}</p>
        <p className="text-xs text-slate-500 mt-1">{trip.route?.name || 'No route'}</p>
      </div>
      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-xs text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </span>
    </div>
  </div>
);

const EventItem = ({ event }) => (
  <div className="flex items-start gap-3 rounded-3xl border border-white/10 bg-slate-900/60 p-4">
    <div className={`mt-1 flex h-10 w-10 items-center justify-center rounded-2xl ${event.status === 'ARRIVED' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'}`}>
      <MapPin className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-white truncate">{event.stop?.name || `Stop ${event.stopIndex}`}</p>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${event.status === 'ARRIVED' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-sky-500/15 text-sky-300'}`}>
          {event.status}
        </span>
      </div>
      <p className="text-xs text-slate-400 mt-1">ETA: {event.etaMinutes ?? '—'} min · {new Date(event.timestamp).toLocaleTimeString()}</p>
    </div>
  </div>
);

const QuickLink = ({ to, icon: Icon, label, description }) => (
  <Link
    to={to}
    className="group block rounded-3xl border border-slate-700/50 bg-slate-800/90 p-4 transition hover:border-sky-400/40 hover:bg-slate-800/95"
  >
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-300">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-slate-100">{label}</p>
        {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
      </div>
      <ChevronRight className="w-5 h-5 text-slate-400 transition group-hover:text-white" />
    </div>
  </Link>
);

// ===== MAIN COMPONENT =====

const AdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [trips, setTrips] = useState([]);
  const [events, setEvents] = useState([]);
  const [sosAlert, setSosAlert] = useState(null);
  const [visitorCount, setVisitorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [liveBuses, setLiveBuses] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  const socketHandlers = useMemo(() => ({
    'trip:sos': setSosAlert,
    'stats:live_visitors': setVisitorCount,
    'admin:joined': () => {} // No action needed - admin room join is confirmed via socket connection
  }), []);

  const { socket, isConnected } = useSocket(socketHandlers);

  useEffect(() => {
    if (socket && isConnected) socket.emit('admin:join');
  }, [socket, isConnected]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, tripsRes, eventsRes, analyticsRes] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/trips'),
        api.get('/admin/events'),
        api.get('/admin/analytics').catch(() => ({ data: null }))
      ]);
      setStats(statsRes.data);
      setTrips(tripsRes.data);
      setEvents(eventsRes.data);
      if (analyticsRes.data) setAnalytics(analyticsRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch live bus positions every 5 seconds
  useEffect(() => {
    const fetchLiveBuses = async () => {
      try {
        const res = await api.get('/admin/live-buses');
        setLiveBuses(res.data);
      } catch { }
    };
    fetchLiveBuses();
    const interval = setInterval(fetchLiveBuses, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearEvents = async () => {
    if (!confirm('Clear all stop events?')) return;
    setClearing(true);
    try {
      await api.delete('/admin/events');
      setEvents([]);
    } catch {
      alert('Failed to clear events');
    } finally {
      setClearing(false);
    }
  };

  // Loading
  if (loading) {
    return <TrackMateLoader message="Loading dashboard..." />;
  }

  // Error
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-6 text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Failed to load</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button onClick={fetchData} className="px-6 py-2 bg-indigo-500 text-white rounded-xl font-medium">
            Try Again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-8">
      {/* SOS Alert */}
      {sosAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card-elevated p-6 max-w-sm w-full text-center bg-red-950 border-red-500/50">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Emergency Alert</h2>
            <p className="text-red-200 mb-2">{sosAlert.message}</p>
            <p className="text-red-300/60 text-xs mb-4">Trip: {sosAlert.tripId}</p>
            <button onClick={() => setSosAlert(null)} className="w-full py-3 bg-white/10 rounded-xl text-white font-medium hover:bg-white/20 transition">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.35em] text-indigo-300">Admin Control Center</p>
            <h1 className="text-3xl font-semibold text-white">Admin Dashboard</h1>
            <p className="max-w-2xl text-sm text-slate-400">Monitor live fleet operations, route updates, and alerts from a single command center.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="inline-flex items-center gap-2 rounded-2xl bg-slate-900/70 px-4 py-2 text-sm text-slate-300 border border-white/10">
              <Activity className="w-4 h-4 text-emerald-300" />
              <span>{visitorCount} visitors online</span>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 transition">
                <RefreshCw className="w-4 h-4" /> Refresh
              </button>
              <button onClick={handleClearEvents} disabled={clearing} className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition disabled:opacity-50">
                <Trash2 className="w-4 h-4" /> {clearing ? 'Clearing...' : 'Clear events'}
              </button>
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard icon={Bus} label="Total buses" value={stats.busCount} detail="Fleet size" color="indigo" />
          <StatCard icon={UserCheck} label="Drivers" value={stats.driverCount} detail="Onboard staff" color="emerald" />
          <StatCard icon={Users} label="Students" value={stats.studentCount} detail="Tracked users" color="sky" />
          <StatCard icon={Navigation} label="Active trips" value={stats.activeTrips} detail="Running routes" color="purple" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.8fr_1fr]">
          <div className="card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-indigo-300">Fleet map</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Live bus positions</h2>
                <p className="mt-2 text-sm text-slate-400">Track active buses, alerts and route status in real time.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-900/70 p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Online</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{liveBuses.length}</p>
                </div>
                <div className="rounded-3xl bg-slate-900/70 p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Events</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{analytics?.todayEvents ?? events.length}</p>
                </div>
                <div className="rounded-3xl bg-slate-900/70 p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Alerts</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{sosAlert ? 1 : 0}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10">
              <AdminMap buses={liveBuses} sosTrips={sosAlert ? [sosAlert] : []} />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Operational snapshot</p>
                  <h3 className="text-lg font-semibold text-white">Quick overview</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-400 border border-white/10">Live</span>
              </div>
              <div className="grid gap-3">
                <div className="rounded-3xl bg-slate-900/70 p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Average trip</p>
                  <p className="mt-2 text-xl font-semibold text-white">{analytics?.averageDurationMinutes ? `${analytics.averageDurationMinutes} min` : '—'}</p>
                </div>
                <div className="rounded-3xl bg-slate-900/70 p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Today's events</p>
                  <p className="mt-2 text-xl font-semibold text-white">{analytics?.todayEvents ?? events.length}</p>
                </div>
                <div className="rounded-3xl bg-slate-900/70 p-4 border border-white/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Recent trips</p>
                  <p className="mt-2 text-xl font-semibold text-white">{trips.length}</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
                <span className="text-xs uppercase tracking-[0.35em] text-slate-500">Fast access</span>
              </div>
              <div className="grid gap-3">
                <QuickLink to="/admin/buses" icon={Bus} label="Manage Buses" description="Edit fleet details" />
                <QuickLink to="/admin/drivers" icon={UserCheck} label="Manage Drivers" description="Assign staff" />
                <QuickLink to="/admin/routes" icon={Navigation} label="Manage Routes" description="Edit and publish" />
                <QuickLink to="/admin/students" icon={Users} label="Manage Students" description="View assignments" />
              </div>
            </div>
            <div className="card p-5 border border-white/10 bg-slate-900/70">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-300">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-400">Export history</p>
                  <p className="mt-1 text-white font-medium">Download last 30 days</p>
                </div>
              </div>
              <button
                onClick={() => {
                  const token = localStorage.getItem('tm_token');
                  window.open(`${API_BASE_URL}/api/admin/export-trips?days=30&token=${token}`, '_blank');
                }}
                className="mt-4 w-full rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400 transition"
              >
                Export CSV
              </button>
            </div>
          </aside>
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Active Trips</h2>
                <p className="text-sm text-slate-400">Live trip summaries</p>
              </div>
              <span className="text-xs text-slate-500">{trips.length} trips</span>
            </div>
            <div className="space-y-3">
              {trips.length > 0 ? (
                trips.map(trip => <TripCard key={trip._id} trip={trip} />)
              ) : (
                <p className="text-slate-500 text-center py-8">No active trips</p>
              )}
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Recent Events</h2>
                <p className="text-sm text-slate-400">Latest route updates</p>
              </div>
              {events.length > 0 && (
                <button
                  onClick={handleClearEvents}
                  disabled={clearing}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {clearing ? 'Clearing...' : 'Clear events'}
                </button>
              )}
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {events.length > 0 ? (
                events.slice(0, 10).map(event => <EventItem key={event._id} event={event} />)
              ) : (
                <p className="text-slate-500 text-center py-8">No events yet</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminDashboard;
