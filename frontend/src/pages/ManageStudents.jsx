import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  Users, Plus, Search, Edit2, Trash2, Phone, 
  User, X, Bus, MapPin, CheckCircle, Clock
} from 'lucide-react';
import TrackMateLoader from '../components/TrackMateLoader';

const blankForm = { username: '', name: '', phone: '', email: '', busId: '', stopId: '' };

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

/* Student Card Component */
const StudentCard = ({ student, assignment, onEdit, onDelete }) => {
  const isAssigned = Boolean(assignment);
  
  return (
    <div className="card p-4 hover:border-indigo-500/30 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isAssigned ? 'bg-emerald-500/20' : 'bg-amber-500/20'
          }`}>
            <User className={`w-5 h-5 ${isAssigned ? 'text-emerald-400' : 'text-amber-400'}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold truncate">{student.name || 'Unnamed'}</h3>
            <p className="text-xs text-slate-400">@{student.username}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
          isAssigned 
            ? 'bg-emerald-500/20 text-emerald-400' 
            : 'bg-amber-500/20 text-amber-400'
        }`}>
          {isAssigned ? 'Assigned' : 'Pending'}
        </span>
      </div>

      {student.phone && (
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Phone className="w-4 h-4" />
          <span>{student.phone}</span>
        </div>
      )}
      
      {student.email && (
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
          <span className="text-xs">✉️</span>
          <span className="truncate">{student.email}</span>
        </div>
      )}

      {assignment && (
        <div className="bg-slate-800/50 rounded-lg p-3 space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Bus className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-300">{assignment.bus?.name || 'No bus'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-300 truncate">
              {assignment.stop ? `${assignment.stop.sequence}. ${assignment.stop.name}` : 'No stop'}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => onEdit(student)}
          className="p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition"
          title="Edit student"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(student)}
          disabled={isAssigned}
          className={`p-2 rounded-lg transition ${
            isAssigned 
              ? 'text-slate-600 cursor-not-allowed' 
              : 'text-red-400 hover:bg-red-500/20'
          }`}
          title={isAssigned ? 'Remove assignment first' : 'Delete student'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const ManageStudents = () => {
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [buses, setBuses] = useState([]);
  const [stops, setStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [confirmState, setConfirmState] = useState({ open: false, target: null });
  const [loading, setLoading] = useState(true);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const [studentsRes, assignmentsRes, busesRes] = await Promise.all([
        api.get('/admin/students'), 
        api.get('/admin/assignments'),
        api.get('/buses')
      ]);
      setStudents(studentsRes.data);
      const assignmentMap = assignmentsRes.data.reduce((acc, assignment) => {
        if (assignment.student?._id) {
          acc[assignment.student._id] = assignment;
        }
        return acc;
      }, {});
      setAssignments(assignmentMap);
      setBuses(busesRes.data || []);
    } catch (error) {
      toast.error('Unable to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const openCreate = () => {
    setEditingStudent(null);
    setForm(blankForm);
    setStops([]);
    setDrawerOpen(true);
  };

  const openEdit = (student) => {
    setEditingStudent(student);
    setForm({ username: student.username, password: '', name: student.name || '', phone: student.phone || '', email: student.email || '' });
    setDrawerOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      username: form.username.trim(),
      name: form.name,
      phone: form.phone,
      email: form.email.trim()
    };
    // Only include password for edit mode (manual reset by admin)
    if (editingStudent && form.password?.trim()) {
      payload.password = form.password.trim();
    }
    
    // Add bus and stop for new students
    if (!editingStudent) {
      payload.busId = form.busId || null;
      payload.stopId = form.stopId || null;
    }

    try {
      if (editingStudent) {
        await api.put(`/admin/students/${editingStudent._id}`, payload);
        toast.success('Student updated');
      } else {
        await api.post('/admin/students', payload);
        toast.success('Student created. Welcome email sent!');
      }
      setDrawerOpen(false);
      setEditingStudent(null);
      setForm(blankForm);
      loadStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save student');
    }
  };

  const askDelete = (student) => setConfirmState({ open: true, target: student });

  const confirmDelete = async () => {
    if (!confirmState.target) return;
    try {
      await api.delete(`/admin/students/${confirmState.target._id}`);
      toast.success('Student removed');
      setConfirmState({ open: false, target: null });
      loadStudents();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete student');
    }
  };

  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.username, student.name, student.phone, student.email].some((value) => value?.toLowerCase().includes(needle))
    );
  }, [students, search]);

  const assignedCount = Object.keys(assignments).length;
  const unassigned = Math.max(students.length - assignedCount, 0);

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Student Directory</h1>
            <p className="text-sm text-slate-400 mt-1">Manage student accounts and view assignments</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition sm:w-auto w-full"
          >
            <Plus className="w-5 h-5" />
            Add Student
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={Users} label="Total Students" value={students.length} subtitle="Registered" color="indigo" />
          <StatCard icon={CheckCircle} label="Assigned" value={assignedCount} subtitle="To buses" color="emerald" />
          <StatCard icon={Clock} label="Pending" value={unassigned} subtitle="Awaiting" color="amber" />
        </div>

        {/* Search */}
        <div className="card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or roll number..."
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

        {/* Students Grid */}
        {loading ? (
          <TrackMateLoader compact message="Loading students..." />
        ) : filteredStudents.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStudents.map((student) => (
              <StudentCard
                key={student._id}
                student={student}
                assignment={assignments[student._id]}
                onEdit={openEdit}
                onDelete={askDelete}
              />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No students found</p>
            <p className="text-sm text-slate-500 mt-1">
              {search ? 'Try a different search term' : 'Add your first student to get started'}
            </p>
          </div>
        )}
      </div>

      {/* Drawer */}
      <Drawer
        isOpen={drawerOpen}
        title={editingStudent ? 'Edit Student' : 'Add New Student'}
        subtitle="Student credentials for the mobile app"
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
              form="student-form"
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
            >
              {editingStudent ? 'Save Changes' : 'Add Student'}
            </button>
          </div>
        }
      >
        <form id="student-form" className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Roll Number / Username</label>
            <input
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., 21CS101"
              required
            />
          </div>
          {editingStudent && (
            <div>
              <label className="text-sm text-slate-300 mb-1.5 block">Reset Password</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                placeholder="Leave blank to keep current"
              />
            </div>
          )}
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Full Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., John Doe"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., +1 234 567 8900"
            />
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Email Address <span className="text-red-400">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              placeholder="e.g., student@example.com"
              required
            />
            <p className="text-xs text-slate-400 mt-1">Welcome email will be sent to this address</p>
          </div>
          
          {!editingStudent && (
            <>
              <div>
                <label className="text-sm text-slate-300 mb-1.5 block">Assign Bus (Optional)</label>
                <select
                  value={form.busId}
                  onChange={async (e) => {
                    const busId = e.target.value;
                    setForm((prev) => ({ ...prev, busId, stopId: '' }));
                    setStops([]);
                    if (busId) {
                      const selectedBus = buses.find(b => b._id === busId);
                      if (selectedBus?.route?._id || selectedBus?.route) {
                        const routeId = selectedBus.route._id || selectedBus.route;
                        try {
                          setLoadingStops(true);
                          const { data } = await api.get(`/stops/${routeId}`);
                          setStops(data);
                        } catch {
                          toast.error('Failed to load stops');
                        } finally {
                          setLoadingStops(false);
                        }
                      }
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="">Select a bus (optional)</option>
                  {buses.map((bus) => (
                    <option key={bus._id} value={bus._id}>
                      {bus.numberPlate} - {bus.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {form.busId && (
                <div>
                  <label className="text-sm text-slate-300 mb-1.5 block">Assign Stop (Optional)</label>
                  {loadingStops ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-400">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                      Loading stops...
                    </div>
                  ) : stops.length > 0 ? (
                    <select
                      value={form.stopId}
                      onChange={(e) => setForm((prev) => ({ ...prev, stopId: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="">Select a stop (optional)</option>
                      {stops.map((stop) => (
                        <option key={stop._id} value={stop._id}>
                          {stop.sequence}. {stop.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-amber-400 px-1">No stops found for this bus&apos;s route. Add stops to the route first.</p>
                  )}
                </div>
              )}
            </>
          )}
        </form>
      </Drawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="Delete Student"
        message={`Are you sure you want to remove ${confirmState.target?.name || confirmState.target?.username}?`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, target: null })}
      />
    </main>
  );
};

export default ManageStudents;
