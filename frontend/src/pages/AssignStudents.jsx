import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../utils/api';
import Drawer from '../components/Drawer';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  MapPin, Users, Bus, Search, X, Edit2, Trash2, 
  UserPlus, CheckCircle, AlertCircle, ChevronDown, Plus
} from 'lucide-react';

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

/* Assignment Row Component */
const AssignmentRow = ({ assignment, onEdit, onDelete }) => (
  <div className="card p-4 hover:border-indigo-500/30 transition-all group">
    <div className="flex items-center gap-4">
      {/* Student Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-medium truncate">{assignment.student?.name || 'Unnamed'}</p>
            <p className="text-xs text-slate-500">@{assignment.student?.username}</p>
          </div>
        </div>
      </div>

      {/* Bus */}
      <div className="hidden sm:block flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Bus className="w-4 h-4 text-slate-500" />
          <div className="min-w-0">
            <p className="text-sm text-slate-300 truncate">{assignment.bus?.name || '—'}</p>
            <p className="text-xs text-slate-500 truncate">
              {assignment.bus?.driver?.name || assignment.bus?.driver?.username || 'No driver'}
            </p>
          </div>
        </div>
      </div>

      {/* Stop */}
      <div className="hidden md:block flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-slate-500" />
          <p className="text-sm text-slate-300 truncate">
            {assignment.stop ? `${assignment.stop.sequence}. ${assignment.stop.name}` : '—'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onEdit(assignment)}
          className="p-2 rounded-lg text-indigo-400 hover:bg-indigo-500/20 transition"
          title="Edit assignment"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(assignment)}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/20 transition"
          title="Delete assignment"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>

    {/* Mobile details */}
    <div className="sm:hidden mt-3 pt-3 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-1.5 text-slate-400">
        <Bus className="w-3.5 h-3.5" />
        <span className="truncate">{assignment.bus?.name || '—'}</span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-400">
        <MapPin className="w-3.5 h-3.5" />
        <span className="truncate">
          {assignment.stop ? `${assignment.stop.sequence}. ${assignment.stop.name}` : '—'}
        </span>
      </div>
    </div>
  </div>
);

const AssignStudents = () => {
  const [buses, setBuses] = useState([]);
  const [students, setStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [formMode, setFormMode] = useState('existing');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [quickStudent, setQuickStudent] = useState({ rollNumber: '', name: '' });
  const [formBusId, setFormBusId] = useState('');
  const [formStopId, setFormStopId] = useState('');
  const [formStops, setFormStops] = useState([]);
  const [filterBus, setFilterBus] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerForm, setDrawerForm] = useState({ busId: '', stopId: '' });
  const [drawerStops, setDrawerStops] = useState([]);
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, target: null });
  const [showAssignForm, setShowAssignForm] = useState(false);

  const extractId = (entity) => {
    if (!entity) return '';
    if (typeof entity === 'string') return entity;
    if (typeof entity === 'object') return entity._id || entity.id || '';
    return '';
  };

  const loadBuses = async () => {
    try {
      const res = await api.get('/buses');
      setBuses(res.data);
      if (!formBusId && res.data[0]) {
        setFormBusId(res.data[0]._id);
        hydrateStopsForBus(res.data[0]._id, setFormStops, res.data);
      }
    } catch (error) {
      toast.error('Unable to load buses');
    }
  };

  const loadStudents = async () => {
    try {
      const res = await api.get('/admin/students');
      setStudents(res.data);
      if (!selectedStudentId && res.data[0]) {
        setSelectedStudentId(res.data[0]._id);
      }
    } catch (error) {
      toast.error('Unable to load students');
    }
  };

  const loadAssignments = async () => {
    try {
      const res = await api.get('/admin/assignments');
      setAssignments(res.data);
    } catch (error) {
      toast.error('Unable to load assignments');
    }
  };

  useEffect(() => {
    loadBuses();
    loadStudents();
    loadAssignments();
  }, []);

  const hydrateStopsForBus = async (busId, setter, source = buses) => {
    const bus = (source || buses).find((item) => item._id === busId) || {};
    const routeId = bus.route?._id || bus.route;
    if (!routeId) {
      setter([]);
      return;
    }
    try {
      const res = await api.get(`/stops/${routeId}`);
      setter(res.data);
    } catch (error) {
      setter([]);
    }
  };

  const handleBusChange = (busId) => {
    setFormBusId(busId);
    setFormStopId('');
    hydrateStopsForBus(busId, setFormStops);
  };

  const filteredStudents = useMemo(() => {
    const needle = studentSearch.trim().toLowerCase();
    if (!needle) return students;
    return students.filter((student) =>
      [student.username, student.name, student.phone].some((value) => value?.toLowerCase().includes(needle))
    );
  }, [students, studentSearch]);

  const selectedBus = useMemo(() => buses.find((bus) => bus._id === formBusId), [buses, formBusId]);
  const routeMissing = !selectedBus?.route;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formBusId || !formStopId) {
      toast('Select a bus and stop', { icon: '⚠️' });
      return;
    }

    const payload = { busId: formBusId, stopId: formStopId };
    if (formMode === 'existing') {
      if (!selectedStudentId) {
        toast('Pick a student', { icon: '⚠️' });
        return;
      }
      payload.studentId = selectedStudentId;
    } else {
      if (!quickStudent.rollNumber.trim()) {
        toast('Roll number required', { icon: '⚠️' });
        return;
      }
      payload.rollNumber = quickStudent.rollNumber.trim();
      payload.name = quickStudent.name.trim();
    }

    try {
      await api.post('/admin/assignments', payload);
      toast.success('Student assigned');
      if (formMode === 'quick') {
        setQuickStudent({ rollNumber: '', name: '' });
        loadStudents();
      }
      loadAssignments();
      setShowAssignForm(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to assign student');
    }
  };

  const filteredAssignments = useMemo(() => {
    const needle = filterQuery.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const matchesBus = filterBus === 'all' ? true : extractId(assignment.bus) === filterBus;
      const matchesQuery = needle
        ? [assignment.student?.username, assignment.student?.name, assignment.bus?.name].some((value) =>
            value?.toLowerCase().includes(needle)
          )
        : true;
      return matchesBus && matchesQuery;
    });
  }, [assignments, filterBus, filterQuery]);

  const openEditDrawer = async (assignment) => {
    setEditingAssignment(assignment);
    const busId = extractId(assignment.bus);
    const stopId = extractId(assignment.stop);
    setDrawerForm({ busId, stopId });
    setDrawerOpen(true);
    await hydrateStopsForBus(busId, setDrawerStops);
  };

  const handleDrawerSubmit = async (event) => {
    event.preventDefault();
    if (!editingAssignment) return;
    if (!drawerForm.busId || !drawerForm.stopId) {
      toast('Select both a bus and stop', { icon: '⚠️' });
      return;
    }
    try {
      await api.put(`/admin/assignments/${editingAssignment._id}`, {
        busId: drawerForm.busId,
        stopId: drawerForm.stopId
      });
      toast.success('Assignment updated');
      setDrawerOpen(false);
      setEditingAssignment(null);
      loadAssignments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update assignment');
    }
  };

  const askDelete = (assignment) => setConfirmState({ open: true, target: assignment });

  const confirmDelete = async () => {
    if (!confirmState.target) return;
    try {
      await api.delete(`/admin/assignments/${confirmState.target._id}`);
      toast.success('Assignment removed');
      setConfirmState({ open: false, target: null });
      loadAssignments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete assignment');
    }
  };

  const assignmentsPerBus = buses.reduce((acc, bus) => {
    const count = assignments.filter((assignment) => extractId(assignment.bus) === bus._id).length;
    acc[bus._id] = count;
    return acc;
  }, {});

  const unassignedStudents = Math.max(students.length - assignments.length, 0);

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Student Assignments</h1>
            <p className="text-sm text-slate-400 mt-1">Assign students to buses and stops</p>
          </div>
          <button
            onClick={() => setShowAssignForm(!showAssignForm)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition sm:w-auto w-full"
          >
            {showAssignForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {showAssignForm ? 'Close' : 'New Assignment'}
          </button>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard icon={CheckCircle} label="Assigned" value={assignments.length} subtitle="Students" color="emerald" />
          <StatCard icon={AlertCircle} label="Unassigned" value={unassignedStudents} subtitle="Need routing" color="amber" />
          <StatCard icon={Bus} label="Buses" value={buses.length} subtitle="Available" color="indigo" />
        </div>

        {/* Assignment Form */}
        {showAssignForm && (
          <div className="card p-5 animate-fade-in">
            <h2 className="text-lg font-semibold text-white mb-4">Create Assignment</h2>
            
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setFormMode('existing')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  formMode === 'existing' 
                    ? 'bg-indigo-500 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Existing Student
              </button>
              <button
                type="button"
                onClick={() => setFormMode('quick')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                  formMode === 'quick' 
                    ? 'bg-indigo-500 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Quick Add
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formMode === 'existing' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
                    required
                  >
                    <option value="">Select student</option>
                    {filteredStudents.map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.name || student.username} · {student.username}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  <input
                    placeholder="Roll number"
                    value={quickStudent.rollNumber}
                    onChange={(e) => setQuickStudent((prev) => ({ ...prev, rollNumber: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                    required
                  />
                  <input
                    placeholder="Student name (optional)"
                    value={quickStudent.name}
                    onChange={(e) => setQuickStudent((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <select
                  value={formBusId}
                  onChange={(e) => handleBusChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
                  required
                >
                  <option value="">Select bus</option>
                  {buses.map((bus) => (
                    <option key={bus._id} value={bus._id}>
                      {bus.name} ({assignmentsPerBus[bus._id] || 0} assigned)
                    </option>
                  ))}
                </select>
                <select
                  value={formStopId}
                  onChange={(e) => setFormStopId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
                  required
                  disabled={!formStops.length}
                >
                  <option value="">Select stop</option>
                  {formStops.map((stop) => (
                    <option key={stop._id} value={stop._id}>
                      {stop.sequence}. {stop.name}
                    </option>
                  ))}
                </select>
              </div>

              {routeMissing && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-400">
                    This bus has no route assigned. Add a route to the bus first.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
              >
                Assign Student
              </button>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="card p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search assignments..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-800/50 border border-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={filterBus}
              onChange={(e) => setFilterBus(e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/5 text-white focus:outline-none focus:border-indigo-500/50"
            >
              <option value="all">All buses</option>
              {buses.map((bus) => (
                <option key={bus._id} value={bus._id}>{bus.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Assignments List */}
        {filteredAssignments.length > 0 ? (
          <div className="space-y-2">
            {filteredAssignments.map((assignment) => (
              <AssignmentRow
                key={assignment._id}
                assignment={assignment}
                onEdit={openEditDrawer}
                onDelete={askDelete}
              />
            ))}
          </div>
        ) : (
          <div className="card p-12 text-center">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No assignments found</p>
            <p className="text-sm text-slate-500 mt-1">
              {filterQuery || filterBus !== 'all' ? 'Try different filters' : 'Create your first assignment above'}
            </p>
          </div>
        )}
      </div>

      {/* Edit Drawer */}
      <Drawer
        isOpen={drawerOpen}
        title="Edit Assignment"
        subtitle="Change bus or stop for this student"
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
              form="assignment-form"
              className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition"
            >
              Save Changes
            </button>
          </div>
        }
      >
        <form id="assignment-form" className="space-y-4" onSubmit={handleDrawerSubmit}>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Bus</label>
            <select
              value={drawerForm.busId}
              onChange={(e) => {
                const nextBusId = e.target.value;
                setDrawerForm((prev) => ({ ...prev, busId: nextBusId, stopId: '' }));
                hydrateStopsForBus(nextBusId, setDrawerStops);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
              required
            >
              <option value="">Select bus</option>
              {buses.map((bus) => (
                <option key={bus._id} value={bus._id}>{bus.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-300 mb-1.5 block">Stop</label>
            <select
              value={drawerForm.stopId}
              onChange={(e) => setDrawerForm((prev) => ({ ...prev, stopId: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50"
              required
            >
              <option value="">Select stop</option>
              {drawerStops.map((stop) => (
                <option key={stop._id} value={stop._id}>
                  {stop.sequence}. {stop.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Drawer>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="Remove Assignment"
        message={`Are you sure you want to unassign ${confirmState.target?.student?.name || confirmState.target?.student?.username}?`}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, target: null })}
      />
    </main>
  );
};

export default AssignStudents;
