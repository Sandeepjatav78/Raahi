import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  Bus, Plus, Search, Filter, Edit2, Trash2, Users, 
  Navigation, UserCheck, X, ChevronDown
} from 'lucide-react';

const createEmptyBus = () => ({
  name: '',
  numberPlate: '',
  capacity: 40,
  route: '',
  driver: ''
});

/* Stat Card Component */
const StatCard = ({ icon: Icon, label, value, subtitle, color = 'indigo' }) => {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600',
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
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
};

/* Bus Card Component */
const BusCard = ({ bus, onEdit, onDelete }) => {
  const hasRoute = Boolean(bus.route);
  
  return (
    <div className="card p-4 hover:border-indigo-500/30 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            hasRoute ? 'bg-indigo-500/20' : 'bg-slate-700'
          }`}>
            <Bus className={`w-5 h-5 ${hasRoute ? 'text-indigo-400' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">{bus.name}</h3>
            <p className="text-xs text-slate-400 font-mono">{bus.numberPlate}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
          hasRoute 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {hasRoute ? 'Active' : 'Idle'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Route</p>
          <p className="text-sm text-slate-300 truncate">{bus.route?.name || '—'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Driver</p>
          <p className="text-sm text-slate-300 truncate">{bus.driver?.name || bus.driver?.username || '—'}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Users className="w-4 h-4" />
          <span className="text-sm">{bus.capacity} seats</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(bus)}
            className="p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition"
            title="Edit bus"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(bus)}
            className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition"
            title="Delete bus"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ManageBuses = () => {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [form, setForm] = useState(() => createEmptyBus());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBus, setEditingBus] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, target: null });
  const [search, setSearch] = useState('');
  const [routeFilter, setRouteFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const loadBuses = async () => {
    try {
      const res = await api.get('/buses');
      setBuses(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load buses');
    }
  };

  const loadRoutesAndDrivers = async () => {
    try {
      const [routesRes, driversRes] = await Promise.all([api.get('/routes'), api.get('/admin/drivers')]);
      setRoutes(routesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error('Unable to load supporting data');
    }
  };

  useEffect(() => {
    loadBuses();
    loadRoutesAndDrivers();
  }, []);

  const openCreate = () => {
    setEditingBus(null);
    setForm(createEmptyBus());
    setDrawerOpen(true);
  };

  const openEdit = (bus) => {
    setEditingBus(bus);
    setForm({
      name: bus.name,
      numberPlate: bus.numberPlate,
      capacity: bus.capacity,
      route: bus.route?._id || bus.route || '',
      driver: bus.driver?._id || bus.driver || ''
    });
    setDrawerOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      numberPlate: form.numberPlate.trim().toUpperCase(),
      capacity: Number(form.capacity) || 1
    };
    if (form.route) payload.route = form.route;
    if (form.driver) payload.driver = form.driver;

    try {
      if (editingBus) {
        await api.put(`/buses/${editingBus._id}`, payload);
        toast.success('Bus updated');
      } else {
        await api.post('/buses', payload);
        toast.success('Bus added');
      }
      setDrawerOpen(false);
      setForm(createEmptyBus());
      setEditingBus(null);
      loadBuses();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save bus');
    }
  };

  const askDelete = (bus) => setConfirmState({ open: true, target: bus });

  const confirmDelete = async () => {
    if (!confirmState.target) return;
    try {
      await api.delete(`/buses/${confirmState.target._id}`);
      toast.success('Bus removed');
      setConfirmState({ open: false, target: null });
      loadBuses();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete bus');
    }
  };

  const filteredBuses = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return buses.filter((bus) => {
      const matchesSearch = needle
        ? [bus.name, bus.numberPlate, bus.driver?.name, bus.route?.name].some((value) => value?.toLowerCase().includes(needle))
        : true;
      const routeId = bus.route?._id || bus.route;
      const matchesRoute = routeFilter === 'all' ? true : routeId === routeFilter;
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'assigned'
            ? Boolean(bus.route)
            : !bus.route;
      return matchesSearch && matchesRoute && matchesStatus;
    });
  }, [buses, search, routeFilter, statusFilter]);

  const totalCapacity = buses.reduce((sum, bus) => sum + (bus.capacity || 0), 0);
  const activeBuses = buses.filter((bus) => bus.route).length;
  const hasActiveFilters = routeFilter !== 'all' || statusFilter !== 'all';

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Fleet Management</h1>
            <p className="text-sm text-slate-400 mt-1">Manage buses, routes, and drivers</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition sm:w-auto w-full"
          >
            <Plus className="w-5 h-5" />
            Add Bus
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Bus} label="Total Buses" value={buses.length} subtitle="In fleet" color="indigo" />
          <StatCard icon={Navigation} label="Active" value={activeBuses} subtitle="On routes" color="emerald" />
          <StatCard icon={Bus} label="Idle" value={buses.length - activeBuses} subtitle="Available" color="amber" />
          <StatCard icon={Users} label="Capacity" value={totalCapacity} subtitle="Total seats" color="purple" />
        </div>

        {/* Search & Filters */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search buses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition sm:w-auto w-full justify-center ${
                hasActiveFilters 
                  ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10' 
                  : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
              {hasActiveFilters && (
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center">
                  {(routeFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid sm:grid-cols-2 gap-3 pt-3 border-t border-white/5 animate-fade-in">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Route</label>
                <select
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/5 text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="all">All routes</option>
                  {routes.map((route) => (
                    <option key={route._id} value={route._id}>{route.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800/50 border border-white/5 text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="all">All buses</option>
                  <option value="assigned">On route</option>
                  <option value="idle">Idle</option>
                </select>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => { setRouteFilter('all'); setStatusFilter('all'); }}
                  className="sm:col-span-2 text-sm text-indigo-400 hover:text-indigo-300 transition"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Buses Grid */}
        {filteredBuses.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBuses.map((bus) => (
              <BusCard
                key={bus._id}
                bus={bus}
                onEdit={openEdit}
                onDelete={askDelete}
              />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Bus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No buses found</p>
            <p className="text-sm text-slate-500 mt-1">
              {search || hasActiveFilters ? 'Try adjusting your search or filters' : 'Add your first bus to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        title={editingBus ? 'Edit Bus' : 'Add New Bus'}
        subtitle="Configure bus details and assignments"
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
              form="bus-form"
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
            >
              {editingBus ? 'Save Changes' : 'Add Bus'}
            </button>
          </div>
        }
      >
        <form id="bus-form" className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Bus Name</label>
            <input
              name="name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., Bus Alpha"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Number Plate</label>
            <input
              name="numberPlate"
              value={form.numberPlate}
              onChange={(e) => setForm((prev) => ({ ...prev, numberPlate: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 uppercase"
              placeholder="e.g., TN 01 AB 1234"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Capacity</label>
            <input
              name="capacity"
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Route (Optional)</label>
            <select
              name="route"
              value={form.route}
              onChange={(e) => setForm((prev) => ({ ...prev, route: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">Unassigned</option>
              {routes.map((route) => (
                <option key={route._id} value={route._id}>{route.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Driver (Optional)</label>
            <select
              name="driver"
              value={form.driver}
              onChange={(e) => setForm((prev) => ({ ...prev, driver: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">Unassigned</option>
              {drivers.map((driver) => (
                <option key={driver._id} value={driver._id}>
                  {driver.name || driver.username}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Drawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="Delete Bus"
        message={`Are you sure you want to remove "${confirmState.target?.name}" (${confirmState.target?.numberPlate})?`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, target: null })}
      />
    </main>
  );
};

export default ManageBuses;
