import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  Octagon, Plus, Edit2, Trash2, MapPin, Clock, 
  Navigation, ChevronDown
} from 'lucide-react';

const defaultStopForm = (routeId = '') => ({
  route: routeId,
  name: '',
  latitude: '',
  longitude: '',
  sequence: 1,
  averageTravelMinutes: 2
});

/* Stat Card */
const StatCard = ({ icon: Icon, label, value, color = 'indigo' }) => {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600'
  };
  
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
};

/* Stop Card */
const StopCard = ({ stop, onEdit, onDelete }) => (
  <div className="card p-4 hover:border-indigo-500/30 transition-all group">
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-400 font-bold">{stop.sequence}</span>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-white font-semibold truncate">{stop.name}</h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {Number.isFinite(Number(stop.latitude)) ? Number(stop.latitude).toFixed(4) : '—'}, 
            {Number.isFinite(Number(stop.longitude)) ? Number(stop.longitude).toFixed(4) : '—'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {stop.averageTravelMinutes} min
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(stop)}
          className="p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition"
          title="Edit stop"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(stop)}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition"
          title="Delete stop"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
);

const ManageStops = () => {
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [stops, setStops] = useState([]);
  const [form, setForm] = useState(() => defaultStopForm());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStop, setEditingStop] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, target: null });
  const [showAddForm, setShowAddForm] = useState(false);

  const loadRoutes = async () => {
    try {
      const res = await api.get('/routes');
      setRoutes(res.data);
      if (!selectedRoute && res.data[0]) {
        selectRoute(res.data[0]._id);
      }
    } catch (error) {
      toast.error('Unable to load routes');
    }
  };

  const selectRoute = (routeId) => {
    setSelectedRoute(routeId);
    setForm(defaultStopForm(routeId));
    if (routeId) {
      api
        .get(`/stops/${routeId}`)
        .then((res) => setStops(res.data))
        .catch(() => setStops([]));
    } else {
      setStops([]);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedRoute) {
      toast('Pick a route first', { icon: '⚠️' });
      return;
    }

    const payload = {
      ...form,
      route: selectedRoute,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      sequence: Number(form.sequence),
      averageTravelMinutes: Number(form.averageTravelMinutes) || 2
    };

    try {
      await api.post('/stops', payload);
      toast.success('Stop created');
      setForm((prev) => ({ ...defaultStopForm(selectedRoute), sequence: Number(prev.sequence) + 1 }));
      selectRoute(selectedRoute);
      setShowAddForm(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create stop');
    }
  };

  const openEdit = (stop) => {
    setEditingStop(stop);
    setForm({
      route: stop.route,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      sequence: stop.sequence,
      averageTravelMinutes: stop.averageTravelMinutes
    });
    setDrawerOpen(true);
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!editingStop) return;
    const payload = {
      ...form,
      route: selectedRoute,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      sequence: Number(form.sequence),
      averageTravelMinutes: Number(form.averageTravelMinutes) || 2
    };
    try {
      await api.put(`/stops/${editingStop._id}`, payload);
      toast.success('Stop updated');
      setDrawerOpen(false);
      setEditingStop(null);
      setForm(defaultStopForm(selectedRoute));
      selectRoute(selectedRoute);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update stop');
    }
  };

  const askDelete = (stop) => setConfirmState({ open: true, target: stop });

  const confirmDelete = async () => {
    if (!confirmState.target) return;
    try {
      await api.delete(`/stops/${confirmState.target._id}`);
      toast.success('Stop deleted');
      setConfirmState({ open: false, target: null });
      selectRoute(selectedRoute);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete stop');
    }
  };

  const selectedRouteName = routes.find(r => r._id === selectedRoute)?.name || 'Select Route';
  const totalTime = stops.reduce((sum, s) => sum + (s.averageTravelMinutes || 0), 0);

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Stop Management</h1>
            <p className="text-sm text-slate-400 mt-1">Manage pickup locations for routes</p>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition sm:w-auto w-full"
          >
            <Plus className="w-5 h-5" />
            Add Stop
          </button>
        </header>

        {/* Route Selector */}
        <div className="card p-4">
          <label className="text-sm text-slate-300 mb-2 block">Active Route</label>
          <div className="relative">
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select
              value={selectedRoute}
              onChange={(e) => selectRoute(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 appearance-none"
            >
              {routes.map((route) => (
                <option key={route._id} value={route._id}>{route.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={Octagon} label="Total Stops" value={stops.length} color="indigo" />
          <StatCard icon={Clock} label="Est. Time" value={`${totalTime} min`} color="emerald" />
          <StatCard icon={Navigation} label="Route" value={selectedRouteName.substring(0, 12)} color="purple" />
        </div>

        {/* Add Stop Form */}
        {showAddForm && (
          <div className="card p-5 animate-fade-in">
            <h2 className="text-lg font-semibold text-white mb-4">New Stop</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Stop Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                  placeholder="e.g., Main Street"
                  required
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                    placeholder="e.g., 12.9716"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                    placeholder="e.g., 77.5946"
                    required
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">Sequence #</label>
                  <input
                    type="number"
                    min="1"
                    value={form.sequence}
                    onChange={(e) => setForm((prev) => ({ ...prev, sequence: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">Avg. Minutes</label>
                  <input
                    type="number"
                    min="0"
                    value={form.averageTravelMinutes}
                    onChange={(e) => setForm((prev) => ({ ...prev, averageTravelMinutes: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                    placeholder="2"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
                >
                  Add Stop
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Stops List */}
        {stops.length > 0 ? (
          <div className="space-y-2">
            {stops.map((stop) => (
              <StopCard key={stop._id} stop={stop} onEdit={openEdit} onDelete={askDelete} />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Octagon className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No stops on this route</p>
            <p className="text-sm text-slate-500 mt-1">Add your first stop to get started</p>
          </div>
        )}
      </div>

      {/* Edit Drawer */}
      <Drawer
        isOpen={drawerOpen}
        title="Edit Stop"
        subtitle="Adjust location and timing"
        onClose={() => setDrawerOpen(false)}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="stop-edit-form"
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <form id="stop-edit-form" className="space-y-4" onSubmit={handleUpdate}>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Stop Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Latitude</label>
            <input
              type="number"
              step="any"
              value={form.latitude}
              onChange={(e) => setForm((prev) => ({ ...prev, latitude: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Longitude</label>
            <input
              type="number"
              step="any"
              value={form.longitude}
              onChange={(e) => setForm((prev) => ({ ...prev, longitude: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Sequence</label>
            <input
              type="number"
              min="1"
              value={form.sequence}
              onChange={(e) => setForm((prev) => ({ ...prev, sequence: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Avg. Minutes</label>
            <input
              type="number"
              min="0"
              value={form.averageTravelMinutes}
              onChange={(e) => setForm((prev) => ({ ...prev, averageTravelMinutes: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
        </form>
      </Drawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="Delete Stop"
        message={`Are you sure you want to remove "${confirmState.target?.name}" from this route?`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, target: null })}
      />
    </main>
  );
};

export default ManageStops;
