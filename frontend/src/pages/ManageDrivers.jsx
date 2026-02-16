import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  UserCheck, Plus, Search, Edit2, Trash2, Phone, 
  User, X, Bus, Shield
} from 'lucide-react';
import TrackMateLoader from '../components/TrackMateLoader';

const blankForm = { username: '', password: '', name: '', phone: '' };

/* Stat Card Component */
const StatCard = ({ icon: Icon, label, value, subtitle, color = 'indigo' }) => {
  const colors = {
    indigo: 'from-indigo-500 to-indigo-600',
    emerald: 'from-emerald-500 to-emerald-600',
    amber: 'from-amber-500 to-amber-600'
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

/* Driver Card Component */
const DriverCard = ({ driver, onEdit, onDelete }) => {
  const isAssigned = Boolean(driver.assignedBusId);
  
  return (
    <div className="card p-4 hover:border-indigo-500/30 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isAssigned ? 'bg-emerald-500/20' : 'bg-slate-700'
          }`}>
            <User className={`w-5 h-5 ${isAssigned ? 'text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">{driver.name || 'Unnamed'}</h3>
            <p className="text-xs text-slate-400">@{driver.username}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
          isAssigned 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {isAssigned ? 'Assigned' : 'Available'}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Phone className="w-4 h-4" />
          <span>{driver.phone || 'No phone'}</span>
        </div>
        {isAssigned && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Bus className="w-4 h-4" />
            <span>Bus assigned</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => onEdit(driver)}
          className="p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition"
          title="Edit driver"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(driver)}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition"
          title="Delete driver"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ManageDrivers = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blankForm);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, target: null });

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/drivers');
      setDrivers(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load drivers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  const openCreate = () => {
    setEditingDriver(null);
    setForm(blankForm);
    setDrawerOpen(true);
  };

  const openEdit = (driver) => {
    setEditingDriver(driver);
    setForm({ username: driver.username, password: '', name: driver.name || '', phone: driver.phone || '' });
    setDrawerOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      username: form.username,
      name: form.name,
      phone: form.phone
    };
    if (!editingDriver || form.password.trim()) {
      payload.password = form.password.trim() || form.username;
    }

    try {
      if (editingDriver) {
        await api.put(`/admin/drivers/${editingDriver._id}`, payload);
        toast.success('Driver updated');
      } else {
        await api.post('/admin/drivers', payload);
        toast.success('Driver created');
      }
      setDrawerOpen(false);
      setForm(blankForm);
      setEditingDriver(null);
      loadDrivers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save driver');
    }
  };

  const askDelete = (driver) => setConfirmState({ open: true, target: driver });

  const confirmDelete = async () => {
    if (!confirmState.target) return;
    try {
      await api.delete(`/admin/drivers/${confirmState.target._id}`);
      toast.success('Driver removed');
      setConfirmState({ open: false, target: null });
      loadDrivers();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete driver');
    }
  };

  const filteredDrivers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return drivers;
    return drivers.filter((driver) =>
      [driver.username, driver.name, driver.phone].some((value) => value?.toLowerCase().includes(needle))
    );
  }, [drivers, search]);

  const assignedDrivers = drivers.filter((driver) => driver.assignedBusId).length;

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Driver Management</h1>
            <p className="text-sm text-slate-400 mt-1">Manage your fleet drivers</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition sm:w-auto w-full"
          >
            <Plus className="w-5 h-5" />
            Add Driver
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={UserCheck} label="Total Drivers" value={drivers.length} subtitle="Registered" color="indigo" />
          <StatCard icon={Bus} label="Assigned" value={assignedDrivers} subtitle="To buses" color="emerald" />
          <StatCard icon={Shield} label="Available" value={drivers.length - assignedDrivers} subtitle="Unassigned" color="amber" />
        </div>

        {/* Search */}
        <div className="card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search drivers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/50 border border-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
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
        </div>

        {/* Drivers Grid */}
        {loading ? (
          <TrackMateLoader compact message="Loading drivers..." />
        ) : filteredDrivers.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrivers.map((driver) => (
              <DriverCard
                key={driver._id}
                driver={driver}
                onEdit={openEdit}
                onDelete={askDelete}
              />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <UserCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No drivers found</p>
            <p className="text-sm text-slate-500 mt-1">
              {search ? 'Try a different search term' : 'Add your first driver to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        title={editingDriver ? 'Edit Driver' : 'Add New Driver'}
        subtitle="Driver credentials for the mobile app"
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
              form="driver-form"
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
            >
              {editingDriver ? 'Save Changes' : 'Add Driver'}
            </button>
          </div>
        }
      >
        <form id="driver-form" className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Username</label>
            <input
              name="username"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., driver1"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Password</label>
            <input
              name="password"
              type="text"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder={editingDriver ? 'Leave blank to keep current' : 'Required'}
              required={!editingDriver}
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Full Name</label>
            <input
              name="name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., John Smith"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Phone Number</label>
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., +1 234 567 8900"
            />
          </div>
        </form>
      </Drawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="Remove Driver"
        message={`Are you sure you want to remove ${confirmState.target?.name || confirmState.target?.username}?`}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, target: null })}
      />
    </main>
  );
};

export default ManageDrivers;
