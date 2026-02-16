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

const StatCard = ({ icon: Icon, label, value, color = 'indigo' }) => {
  const colors = {
    indigo: 'bg-indigo-500/20 text-indigo-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
    orange: 'bg-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value ?? '—'}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </div>
  );
};

const TripCard = ({ trip }) => (
  <div className="p-4 bg-white/5 rounded-xl hover:bg-white/10 transition">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
        <Bus className="w-6 h-6 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white truncate">{trip.bus?.name || 'Unknown Bus'}</p>
        <p className="text-sm text-slate-400">
          Driver: {trip.driver?.name || trip.driver?.username || 'Unknown'}
        </p>
        <p className="text-xs text-slate-500 mt-1">{trip.route?.name || 'No route'}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  </div>
);

const EventItem = ({ event }) => (
  <div className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg transition">
    <div className={`p-2 rounded-lg ${event.status === 'ARRIVED' ? 'bg-emerald-500/20' : 'bg-orange-500/20'}`}>
      <MapPin className={`w-4 h-4 ${event.status === 'ARRIVED' ? 'text-emerald-400' : 'text-orange-400'}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-white truncate">{event.stop?.name || `Stop ${event.stopIndex}`}</p>
      <p className="text-xs text-slate-500">{event.status} · ETA: {event.etaMinutes ?? '—'} min</p>
    </div>
    <p className="text-xs text-slate-500">{new Date(event.timestamp).toLocaleTimeString()}</p>
  </div>
);

const QuickLink = ({ to, icon: Icon, label }) => (
  <Link
    to={to}
    className="flex items-center gap-3 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition group"
  >
    <div className="p-2 rounded-lg bg-indigo-500/20">
      <Icon className="w-5 h-5 text-indigo-400" />
    </div>
    <span className="flex-1 text-white font-medium">{label}</span>
    <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition" />
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

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 text-sm">Overview of your fleet</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white transition">
              <RefreshCw className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">{visitorCount} Online</span>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Bus} label="Total Buses" value={stats.busCount} color="indigo" />
          <StatCard icon={UserCheck} label="Drivers" value={stats.driverCount} color="emerald" />
          <StatCard icon={Users} label="Students" value={stats.studentCount} color="orange" />
          <StatCard icon={Navigation} label="Active Trips" value={stats.activeTrips} color="purple" />
          {analytics && (
            <>
              <StatCard icon={Clock} label="Avg Trip Duration" value={`${analytics.averageDurationMinutes} min`} color="emerald" />
              <StatCard icon={MapPin} label="Today's Events" value={analytics.todayEvents} color="orange" />
            </>
          )}
        </section>

        {/* Quick Links */}
        <section className="card p-4">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <QuickLink to="/admin/buses" icon={Bus} label="Manage Buses" />
            <QuickLink to="/admin/drivers" icon={UserCheck} label="Manage Drivers" />
            <QuickLink to="/admin/routes" icon={Navigation} label="Manage Routes" />
            <QuickLink to="/admin/stops" icon={Octagon} label="Manage Stops" />
            <QuickLink to="/admin/students" icon={Users} label="Manage Students" />
            <QuickLink to="/admin/assignments" icon={MapPin} label="Assignments" />
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <button
              onClick={() => {
                const token = localStorage.getItem('tm_token');
                window.open(`${API_BASE_URL}/api/admin/export-trips?days=30&token=${token}`, '_blank');
              }}
              className="w-full flex items-center gap-3 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition group"
            >
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Download className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="flex-1 text-left text-white font-medium">Export Trip History (CSV)</span>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white transition" />
            </button>
          </div>
        </section>

        {/* Live Fleet Map */}
        <section className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Map className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-white">Live Fleet Map</h2>
            </div>
            <span className="text-xs text-slate-500">{liveBuses.length} buses active</span>
          </div>
          <div className="h-80 rounded-xl overflow-hidden">
            <AdminMap buses={liveBuses} sosTrips={sosAlert ? [sosAlert] : []} />
          </div>
        </section>

        {/* Active Trips & Events */}
        <section className="grid lg:grid-cols-2 gap-6">
          {/* Active Trips */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Active Trips</h2>
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

          {/* Recent Events */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Recent Events</h2>
              {events.length > 0 && (
                <button
                  onClick={handleClearEvents}
                  disabled={clearing}
                  className="flex items-center gap-1 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3" />
                  {clearing ? 'Clearing...' : 'Clear'}
                </button>
              )}
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
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
