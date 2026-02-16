import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { 
  Trash2, Navigation, MapPin, Copy, RotateCcw, 
  Route, Clock, Edit3, Layers, ChevronRight,
  ChevronLeft, Check, Milestone, PenTool, ClipboardCheck,
  Plus, ArrowRight
} from 'lucide-react';
import MapEditor from '../components/MapEditor';
import { api } from '../utils/api';
import ConfirmDialog from '../components/ConfirmDialog';

const STEPS = [
  { id: 1, label: 'Details', icon: PenTool, desc: 'Name your route' },
  { id: 2, label: 'Design', icon: Milestone, desc: 'Draw path & stops' },
  { id: 3, label: 'Review', icon: ClipboardCheck, desc: 'Confirm & save' },
];

const ManageRoutes = () => {
  const [step, setStep] = useState(1);
  const [routeName, setRouteName] = useState('');
  const [saving, setSaving] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [editorKey, setEditorKey] = useState(Date.now());
  const [initialRoute, setInitialRoute] = useState(null);
  const [initialStops, setInitialStops] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, target: null });
  const panelRef = useRef(null);

  // Pending review data from Step 2
  const [pendingGeojson, setPendingGeojson] = useState(null);
  const [pendingStops, setPendingStops] = useState([]);

  const loadRoutes = async () => {
    try {
      const res = await api.get('/routes');
      setRoutes(res.data);
    } catch (error) {
      toast.error('Unable to load routes');
    }
  };

  useEffect(() => {
    loadRoutes();
  }, []);

  const resetEditor = () => {
    setRouteName('');
    setInitialRoute(null);
    setInitialStops([]);
    setSelectedRoute(null);
    setPendingGeojson(null);
    setPendingStops([]);
    setEditorKey(Date.now());
    setStep(1);
  };

  // Called from MapEditor's "Save Route" — moves to review instead of saving directly
  const handleMoveToReview = (geojson, stops) => {
    setPendingGeojson(geojson);
    setPendingStops(stops);
    setStep(3);
  };

  const handleConfirmSave = async () => {
    if (!routeName.trim()) {
      toast('Route name is required.', { icon: '⚠️' });
      setStep(1);
      return;
    }

    setSaving(true);
    const payload = { name: routeName.trim(), geojson: pendingGeojson, stops: pendingStops };
    try {
      if (selectedRoute) {
        await api.put(`/routes/${selectedRoute._id}`, payload);
        toast.success('Route updated');
      } else {
        await api.post('/routes', payload);
        toast.success('Route saved');
      }
      resetEditor();
      loadRoutes();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save route');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (route) => {
    setSelectedRoute(route);
    setRouteName(route.name);
    setInitialRoute(route.geojson);
    setInitialStops(route.stops || []);
    setEditorKey(Date.now());
    setStep(2);
  };

  const duplicateRoute = (route) => {
    if (!route) return;
    setSelectedRoute(null);
    setRouteName(`${route.name} Copy`);
    setInitialRoute(route.geojson);
    setInitialStops(route.stops || []);
    setEditorKey(Date.now());
    setStep(2);
    toast('Editing a duplicate route', { icon: 'ℹ️' });
  };

  const askDelete = (route) => setConfirmState({ open: true, target: route });

  const confirmDelete = async () => {
    if (!confirmState.target) return;
    try {
      await api.delete(`/routes/${confirmState.target._id}`);
      toast.success('Route deleted');
      setConfirmState({ open: false, target: null });
      resetEditor();
      loadRoutes();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete route');
    }
  };

  // Estimate total distance from geojson coords
  const calcDistance = (geojson) => {
    if (!geojson?.coordinates || geojson.coordinates.length < 2) return 0;
    let total = 0;
    const coords = geojson.coordinates;
    for (let i = 1; i < coords.length; i++) {
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLng = ((lng2 - lng1) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return total;
  };

  return (
    <div className="rw-page">
      {/* Progress Stepper */}
      <div className="rw-stepper-bar">
        <div className="rw-stepper">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = step === s.id;
            const isDone = step > s.id;
            return (
              <div key={s.id} className="rw-step-item">
                {i > 0 && <div className={`rw-step-line ${isDone ? 'rw-step-line-done' : ''}`} />}
                <button
                  className={`rw-step-btn ${isActive ? 'rw-step-active' : ''} ${isDone ? 'rw-step-done' : ''}`}
                  onClick={() => {
                    if (isDone) setStep(s.id);
                  }}
                  disabled={!isDone && !isActive}
                >
                  <div className={`rw-step-circle ${isActive ? 'rw-step-circle-active' : ''} ${isDone ? 'rw-step-circle-done' : ''}`}>
                    {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="rw-step-text">
                    <span className="rw-step-label">{s.label}</span>
                    <span className="rw-step-desc">{s.desc}</span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== STEP 1: Details ===== */}
      {step === 1 && (
        <div className="rw-step-content rw-step1-layout">
          {/* Left — Route Form */}
          <div className="rw-form-section">
            <div className="rw-card rw-form-card">
              <div className="rw-form-header">
                <div className="rw-form-icon-ring">
                  <Route className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="rw-form-title">
                    {selectedRoute ? 'Edit Route' : 'Create New Route'}
                  </h2>
                  <p className="rw-form-subtitle">
                    {selectedRoute ? 'Modify an existing route' : 'Start by giving your route a name'}
                  </p>
                </div>
              </div>

              <div className="rw-form-body">
                <label className="rw-input-label">
                  <Edit3 className="w-3.5 h-3.5" />
                  Route Name
                  {selectedRoute && (
                    <span className="rw-editing-badge">Editing</span>
                  )}
                </label>
                <input
                  className="rw-input"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="e.g. Route A - Main Campus"
                  autoFocus
                />

                <div className="rw-form-actions">
                  {selectedRoute && (
                    <>
                      <button onClick={() => duplicateRoute(selectedRoute)} className="rw-btn rw-btn-outline">
                        <Copy className="w-4 h-4" />
                        Duplicate
                      </button>
                      <button onClick={resetEditor} className="rw-btn rw-btn-ghost">
                        <RotateCcw className="w-4 h-4" />
                        Reset
                      </button>
                    </>
                  )}
                </div>
              </div>

              <button
                className="rw-btn rw-btn-primary rw-btn-next"
                onClick={() => {
                  if (!routeName.trim()) {
                    toast('Please enter a route name first', { icon: '⚠️' });
                    return;
                  }
                  setStep(2);
                }}
              >
                Next: Design Route
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right — Saved Routes */}
          <div className="rw-routes-section">
            <div className="rw-card rw-routes-card">
              <div className="rw-routes-header">
                <h3 className="rw-routes-title">
                  <Layers className="w-4 h-4" />
                  Saved Routes
                </h3>
                <span className="rw-routes-count">{routes.length}</span>
              </div>

              <div className="rw-routes-list">
                {routes.length === 0 ? (
                  <div className="rw-routes-empty">
                    <div className="rw-routes-empty-icon">
                      <MapPin className="w-8 h-8" />
                    </div>
                    <p className="rw-routes-empty-title">No routes yet</p>
                    <p className="rw-routes-empty-desc">Create your first route to get started</p>
                  </div>
                ) : (
                  routes.map((route) => (
                    <div
                      key={route._id}
                      className={`rw-route-item ${selectedRoute?._id === route._id ? 'rw-route-item-active' : ''}`}
                    >
                      <div className="rw-route-item-left">
                        <div className={`rw-route-icon ${selectedRoute?._id === route._id ? 'rw-route-icon-active' : ''}`}>
                          <Navigation className="w-4 h-4" />
                        </div>
                        <div className="rw-route-info">
                          <h4 className="rw-route-name">{route.name}</h4>
                          <div className="rw-route-meta">
                            <span><MapPin className="w-3 h-3" /> {route.stops?.length || 0} stops</span>
                            <span><Clock className="w-3 h-3" /> {new Date(route.updatedAt || route.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rw-route-actions">
                        <button onClick={() => startEdit(route)} className="rw-icon-btn rw-icon-btn-edit" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => askDelete(route)} className="rw-icon-btn rw-icon-btn-delete" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 2: Design (Map) ===== */}
      {step === 2 && (
        <div className="rw-step-content rw-step2-layout">
          <div className="rw-map-area">
            {/* Back button overlay */}
            <div className="rw-map-back-overlay">
              <button onClick={() => setStep(1)} className="rw-map-back-btn">
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <div className="rw-map-route-label">
                <Route className="w-4 h-4" />
                {routeName}
              </div>
            </div>

            {/* Map Editor — full area */}
            <MapEditor
              key={editorKey}
              initialRoute={initialRoute}
              initialStops={initialStops}
              onSave={handleMoveToReview}
              panelContainerRef={panelRef}
            />

            {saving && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-800/95 backdrop-blur-xl border border-orange-500/30 shadow-2xl">
                  <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-white">Saving route...</span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — Stop list portal + instructions */}
          <aside className="rw-sidebar">
            <div className="rw-sidebar-scroll">
              <div className="rw-sidebar-header">
                <h3 className="rw-sidebar-title">Route Builder</h3>
                <p className="rw-sidebar-desc">Use the map tools to draw a path and place stops</p>
              </div>

              <div className="rw-sidebar-instructions">
                <div className="rw-instruction">
                  <div className="rw-instruction-num">1</div>
                  <p>Use the <strong>polyline tool</strong> to draw the bus route path</p>
                </div>
                <div className="rw-instruction">
                  <div className="rw-instruction-num">2</div>
                  <p>Use the <strong>marker tool</strong> to place stops along the route</p>
                </div>
                <div className="rw-instruction">
                  <div className="rw-instruction-num">3</div>
                  <p>Click <strong>Save Route</strong> below to review & confirm</p>
                </div>
              </div>

              {/* Portal target for MapEditor's stop list */}
              <div ref={panelRef} className="rw-stops-portal" />
            </div>
          </aside>
        </div>
      )}

      {/* ===== STEP 3: Review ===== */}
      {step === 3 && (
        <div className="rw-step-content rw-step3-layout">
          <div className="rw-review-container">
            {/* Summary Header */}
            <div className="rw-card rw-review-header-card">
              <div className="rw-review-header">
                <div className="rw-review-icon-ring">
                  <ClipboardCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="rw-review-title">Review Route</h2>
                  <p className="rw-review-subtitle">Confirm the details before saving</p>
                </div>
              </div>
            </div>

            {/* Route Details Card */}
            <div className="rw-card rw-review-details">
              <h3 className="rw-review-section-title">Route Details</h3>
              <div className="rw-review-stats">
                <div className="rw-review-stat">
                  <Route className="w-5 h-5 rw-stat-icon" />
                  <div>
                    <span className="rw-stat-label">Name</span>
                    <span className="rw-stat-value">{routeName}</span>
                  </div>
                </div>
                <div className="rw-review-stat">
                  <MapPin className="w-5 h-5 rw-stat-icon" />
                  <div>
                    <span className="rw-stat-label">Stops</span>
                    <span className="rw-stat-value">{pendingStops.length}</span>
                  </div>
                </div>
                <div className="rw-review-stat">
                  <Navigation className="w-5 h-5 rw-stat-icon" />
                  <div>
                    <span className="rw-stat-label">Distance</span>
                    <span className="rw-stat-value">{calcDistance(pendingGeojson).toFixed(1)} km</span>
                  </div>
                </div>
                <div className="rw-review-stat">
                  <Clock className="w-5 h-5 rw-stat-icon" />
                  <div>
                    <span className="rw-stat-label">Est. Time</span>
                    <span className="rw-stat-value">~{Math.ceil((calcDistance(pendingGeojson) / 25) * 60)} min</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stop List Card */}
            <div className="rw-card rw-review-stops">
              <h3 className="rw-review-section-title">
                Stop Sequence
                <span className="rw-routes-count">{pendingStops.length}</span>
              </h3>
              <div className="rw-stop-timeline">
                {pendingStops.map((stop, idx) => (
                  <div key={idx} className="rw-stop-tl-item">
                    <div className="rw-stop-tl-marker">
                      <div className={`rw-stop-tl-dot ${idx === 0 ? 'rw-stop-tl-start' : idx === pendingStops.length - 1 ? 'rw-stop-tl-end' : ''}`}>
                        {idx + 1}
                      </div>
                      {idx < pendingStops.length - 1 && <div className="rw-stop-tl-line" />}
                    </div>
                    <div className="rw-stop-tl-info">
                      <span className="rw-stop-tl-name">{stop.name}</span>
                      <span className="rw-stop-tl-coords">
                        {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="rw-review-actions">
              <button onClick={() => setStep(2)} className="rw-btn rw-btn-outline">
                <ChevronLeft className="w-4 h-4" />
                Back to Editor
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={saving}
                className="rw-btn rw-btn-primary"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {selectedRoute ? 'Update Route' : 'Save Route'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmState.open}
        title="Delete Route"
        message={`Are you sure you want to delete "${confirmState.target?.name}"? This will also remove all associated stops.`}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmState({ open: false, target: null })}
      />
    </div>
  );
};

export default ManageRoutes;
