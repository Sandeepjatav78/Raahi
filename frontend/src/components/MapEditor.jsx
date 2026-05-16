import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, Trash2, GripVertical, MapPin, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.pm';
import 'leaflet.pm/dist/leaflet.pm.css';
import '../styles/MapEditor.css';
import { lineToGeoJSON, markerToStop, reorderStopsAlongLine, reindexStops } from '../utils/mapUtils';
import { PIET_COLLEGE, TILE_LAYER_ATTRIBUTION, TILE_LAYER_URL } from '../constants/geo';

const DEFAULT_CENTER = [PIET_COLLEGE.lat, PIET_COLLEGE.lng];
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/driving';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

const createStopId = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `stop-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const stopIcon = new L.Icon({
  iconUrl: '/markers/stop.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const startStopIcon = L.divIcon({
  className: 'start-stop-pin',
  html: '<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(16,185,129,0.95);color:#fff;font-size:12px;font-weight:700;box-shadow:0 8px 18px rgba(16,185,129,0.45);border:2px solid rgba(255,255,255,0.9)">S</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const endStopIcon = L.divIcon({
  className: 'end-stop-pin',
  html: '<div style="width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(239,68,68,0.95);color:#fff;font-size:12px;font-weight:700;box-shadow:0 8px 18px rgba(239,68,68,0.45);border:2px solid rgba(255,255,255,0.9)">E</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

const collegeIcon = L.divIcon({
  className: 'college-map-pin',
  html: '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,0.9);color:#fff;font-size:18px;box-shadow:0 10px 24px rgba(14,165,233,0.35);border:2px solid rgba(255,255,255,0.85)">🏫</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// Custom Stop Name Modal Component
const StopNameModal = ({ isOpen, defaultName, onConfirm, onCancel }) => {
  const [name, setName] = useState(defaultName);
  const inputRef = useRef(null);

  useEffect(() => {
    setName(defaultName);
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(name.trim() || defaultName);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl border border-white/10 shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Name This Stop</h3>
              <p className="text-xs text-slate-400">Enter a name for the stop location</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-2">
              Stop Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Street Station"
              className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              autoComplete="off"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 bg-slate-800/50 border border-white/10 hover:bg-slate-700/50 hover:text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all"
            >
              Add Stop
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const SortableStopRow = ({ stop, index, updateStopName, removeStop, moveStop }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative'
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-xl border border-white/10 bg-slate-800/60 p-3 transition-all hover:border-indigo-500/30 hover:bg-slate-800/80"
    >
      <div {...attributes} {...listeners} className="cursor-grab text-slate-500 hover:text-slate-300 active:cursor-grabbing transition-colors">
        <GripVertical size={16} />
      </div>

      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-xs font-bold text-indigo-400 border border-indigo-500/20">
        {index + 1}
      </span>

      <input
        className="flex-1 bg-transparent text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none"
        value={stop.name}
        onChange={(e) => updateStopName(stop.id, e.target.value)}
        placeholder="Name stop..."
      />

      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-all"
          onClick={() => removeStop(stop.id)}
          title="Remove stop"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

const MapEditor = ({ initialRoute = null, initialStops = [], onSave, panelContainerRef, saveButtonLabel = 'Continue to Review' }) => {
  const mapNode = useRef(null);
  const mapInstance = useRef(null);
  const polylineLayer = useRef(null);
  const stopMarkers = useRef(new Map());
  const [routeGeom, setRouteGeom] = useState(initialRoute);
  const [stops, setStops] = useState(reindexStops(initialStops));
  const [nameEdits, setNameEdits] = useState({});
  const [error, setError] = useState('');
  const [autoRouting, setAutoRouting] = useState(false);
  const [cityRoute, setCityRoute] = useState({ from: '', via: '', to: '' });
  const [autoBuildFromPins, setAutoBuildFromPins] = useState(true);
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);
  
  // Modal state for stop naming
  const [stopModal, setStopModal] = useState({ 
    isOpen: false, 
    defaultName: '', 
    mode: 'create', // 'create' or 'edit'
    stopId: null,
    pendingLayer: null 
  });

  const sortedStops = useMemo(() => reindexStops(stops), [stops]);

  const getStopIconByIndex = (index, total) => {
    if (total <= 1) return startStopIcon;
    if (index === 0) return startStopIcon;
    if (index === total - 1) return endStopIcon;
    return stopIcon;
  };

  const syncMarkerIcons = (orderedStops) => {
    const total = orderedStops.length;
    orderedStops.forEach((stop, index) => {
      const marker = stopMarkers.current.get(stop.id);
      if (marker) {
        marker.setIcon(getStopIconByIndex(index, total));
      }
    });
  };

  const tryAutoBuildFromPins = async (nextStops) => {
    if (!autoBuildFromPins) return;
    if (routeGeom) return;
    if (!Array.isArray(nextStops) || nextStops.length !== 2) return;

    setAutoRouting(true);
    try {
      const coordinates = await fetchRoadRoute(nextStops);
      drawRouteOnMap(coordinates);
    } catch (routeError) {
      setError(routeError.message || 'Unable to auto-generate route from start/end pins.');
    } finally {
      setAutoRouting(false);
    }
  };

  // Handle modal confirm for creating new stop
  const handleStopNameConfirm = (name) => {
    if (stopModal.mode === 'create' && stopModal.pendingLayer) {
      const layer = stopModal.pendingLayer;
      const stop = markerToStop(layer, stops.length, name);
      layer.__stopId = stop.id;
      stopMarkers.current.set(stop.id, layer);
      attachMarkerHandlers(layer, stop.id);
      const nextStops = reorderStopsAlongLine(routeGeom, [...stops, stop]);
      setStops(nextStops);
      syncMarkerIcons(nextStops);
      tryAutoBuildFromPins(nextStops);
    } else if (stopModal.mode === 'edit' && stopModal.stopId) {
      const stopId = stopModal.stopId;
      setStops((prev) => prev.map((stop) => (stop.id === stopId ? { ...stop, name } : stop)));
      setNameEdits((prevNames) => ({ ...prevNames, [stopId]: name }));
      const marker = stopMarkers.current.get(stopId);
      if (marker) {
        marker.bindPopup(`<strong>${name}</strong>`);
      }
    }
    setStopModal({ isOpen: false, defaultName: '', mode: 'create', stopId: null, pendingLayer: null });
  };

  // Handle modal cancel
  const handleStopNameCancel = () => {
    // If creating and cancelled, remove the pending layer
    if (stopModal.mode === 'create' && stopModal.pendingLayer) {
      stopModal.pendingLayer.remove();
    }
    setStopModal({ isOpen: false, defaultName: '', mode: 'create', stopId: null, pendingLayer: null });
  };

  const attachMarkerHandlers = (marker, stopId) => {
    marker.on('pm:dragend', () => {
      const { lat, lng } = marker.getLatLng();
      setStops((prev) => {
        const nextStops = reindexStops(
          prev.map((stop) => (stop.id === stopId ? { ...stop, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) } : stop))
        );
        syncMarkerIcons(nextStops);
        return nextStops;
      });
    });

    marker.on('pm:remove', () => removeStop(stopId));

    marker.on('click', () => {
      // Use functional update pattern to get current stop name
      setStops((prev) => {
        const current = prev.find((stop) => stop.id === stopId);
        setStopModal({
          isOpen: true,
          defaultName: current?.name || '',
          mode: 'edit',
          stopId: stopId,
          pendingLayer: null
        });
        return prev; // Return unchanged
      });
    });
  };

  const removeStop = (stopId) => {
    const marker = stopMarkers.current.get(stopId);
    if (marker) {
      marker.removeFrom(mapInstance.current);
      stopMarkers.current.delete(stopId);
    }
    setStops((prev) => {
      const nextStops = reindexStops(prev.filter((stop) => stop.id !== stopId));
      syncMarkerIcons(nextStops);
      return nextStops;
    });
  };

  const updateStopName = (stopId, name) => {
    setStops((prev) => prev.map((stop) => (stop.id === stopId ? { ...stop, name } : stop)));
    setNameEdits((prev) => ({ ...prev, [stopId]: name }));
    const marker = stopMarkers.current.get(stopId);
    if (marker) {
      marker.bindPopup(`<strong>${name}</strong>`);
    }
  };

  const addMarkerLayer = (stop) => {
    const marker = L.marker([stop.lat, stop.lng], { draggable: true, icon: stopIcon });
    marker.bindPopup(`<strong>${stop.name}</strong>`);
    marker.addTo(mapInstance.current);
    stopMarkers.current.set(stop.id, marker);
    attachMarkerHandlers(marker, stop.id);
  };

  const rebuildStopsOnMap = (nextStops) => {
    stopMarkers.current.forEach((marker) => marker.remove());
    stopMarkers.current.clear();
    nextStops.forEach(addMarkerLayer);
    const orderedStops = reindexStops(nextStops, { sort: false });
    setStops(orderedStops);
    syncMarkerIcons(orderedStops);
  };

  const drawRouteOnMap = (coordinates) => {
    if (!mapInstance.current) return;
    if (polylineLayer.current) {
      polylineLayer.current.remove();
      polylineLayer.current = null;
    }
    const latLngs = coordinates.map(([lng, lat]) => [lat, lng]);
    const layer = L.polyline(latLngs, {
      color: '#6366f1',
      weight: 4
    }).addTo(mapInstance.current);
    layer.pm.enable();
    handlePolylineUpdate(layer);
    mapInstance.current.fitBounds(layer.getBounds(), { padding: [24, 24] });
  };

  const fetchRoadRoute = async (inputStops) => {
    const waypoints = inputStops
      .filter((stop) => Number.isFinite(stop?.lat) && Number.isFinite(stop?.lng))
      .map((stop) => `${stop.lng},${stop.lat}`)
      .join(';');

    if (!waypoints || inputStops.length < 2) {
      throw new Error('Add at least two valid stops to auto-generate route.');
    }

    const response = await fetch(
      `${OSRM_ROUTE_URL}/${waypoints}?overview=full&geometries=geojson&steps=false&alternatives=false`
    );

    if (!response.ok) {
      throw new Error('Auto route service is currently unavailable.');
    }

    const data = await response.json();
    const coordinates = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error('Could not generate route for the selected stops.');
    }
    return coordinates;
  };

  const geocodePlace = async (query) => {
    const response = await fetch(
      `${NOMINATIM_SEARCH_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`Could not find location for "${query}".`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || !data[0]) {
      throw new Error(`Location not found: "${query}".`);
    }

    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
      name: data[0].display_name?.split(',')?.[0] || query
    };
  };

  const handleAutoRouteFromStops = async () => {
    setError('');
    if (sortedStops.length < 2) {
      setError('Add at least two stops, then tap Auto Route.');
      return;
    }

    setAutoRouting(true);
    try {
      const coordinates = await fetchRoadRoute(sortedStops);
      drawRouteOnMap(coordinates);
    } catch (routeError) {
      setError(routeError.message || 'Unable to auto-generate route.');
    } finally {
      setAutoRouting(false);
    }
  };

  const handleAutoRouteFromCities = async () => {
    setError('');
    const from = cityRoute.from.trim();
    const to = cityRoute.to.trim();
    const viaStops = cityRoute.via
      .split(',')
      .map((place) => place.trim())
      .filter(Boolean);

    if (!from || !to) {
      setError('Enter both start and destination (e.g. Panipat -> Kurukshetra).');
      return;
    }

    setAutoRouting(true);
    try {
      const queries = [from, ...viaStops, to];
      const resolvedPlaces = await Promise.all(queries.map((query) => geocodePlace(query)));
      const nextStops = resolvedPlaces.map((place, index) => ({
        id: createStopId(),
        name: place.name,
        lat: place.lat,
        lng: place.lng,
        seq: index
      }));

      rebuildStopsOnMap(nextStops);
      const coordinates = await fetchRoadRoute(nextStops);
      drawRouteOnMap(coordinates);
    } catch (routeError) {
      setError(routeError.message || 'Unable to create route from city names.');
    } finally {
      setAutoRouting(false);
    }
  };

  const handlePolylineUpdate = (layer) => {
    if (polylineLayer.current) {
      mapInstance.current.removeLayer(polylineLayer.current);
    }
    polylineLayer.current = layer;
    if (!polylineLayer.current.pm.enabled()) {
      polylineLayer.current.pm.enable();
    }
    setRouteGeom(lineToGeoJSON(layer));
    setStops((prev) => reorderStopsAlongLine(lineToGeoJSON(layer), prev));
  };

  const handleMarkerCreate = (layer) => {
    layer.setIcon(stopIcon);
    // Open modal to get stop name
    setStopModal({
      isOpen: true,
      defaultName: `Stop ${stops.length + 1}`,
      mode: 'create',
      stopId: null,
      pendingLayer: layer
    });
  };

  const initExistingData = () => {
    if (initialRoute && mapInstance.current) {
      const layer = L.polyline(initialRoute.coordinates.map(([lng, lat]) => [lat, lng]), {
        color: '#6366f1',
        weight: 4
      }).addTo(mapInstance.current);
      layer.pm.enable();
      handlePolylineUpdate(layer);
      mapInstance.current.fitBounds(layer.getBounds(), { padding: [24, 24] });
    }

    if (initialStops.length) {
      const normalizedStops = initialStops.map((stop, index) => ({
        ...stop,
        id: stop.id || stop._id || `stop-${index}-${stop.seq ?? ''}`
      }));
      normalizedStops.forEach(addMarkerLayer);
      const orderedStops = reindexStops(normalizedStops);
      setStops(orderedStops);
      syncMarkerIcons(orderedStops);
    }
  };

  useEffect(() => {
    if (!mapNode.current || mapInstance.current) return;
    mapInstance.current = L.map(mapNode.current).setView(DEFAULT_CENTER, 14);

    L.tileLayer(TILE_LAYER_URL, {
      attribution: TILE_LAYER_ATTRIBUTION
    }).addTo(mapInstance.current);

    L.marker([PIET_COLLEGE.lat, PIET_COLLEGE.lng], { icon: collegeIcon })
      .addTo(mapInstance.current)
      .bindPopup('College');

    mapInstance.current.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawCircleMarker: false,
      drawMarker: true,
      drawRectangle: false,
      drawPolygon: false,
      drawPolyline: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true
    });



    mapInstance.current.on('pm:create', (event) => {
      if (event.shape === 'Line') {
        handlePolylineUpdate(event.layer);
      }
      if (event.shape === 'Marker') {
        handleMarkerCreate(event.layer);
      }
    });

    mapInstance.current.on('pm:remove', (event) => {
      const { layer } = event;
      if (layer === polylineLayer.current) {
        polylineLayer.current = null;
        setRouteGeom(null);
      } else if (layer.__stopId) {
        removeStop(layer.__stopId);
      }
    });

    initExistingData();

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      stopMarkers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    setError('');
    if (!routeGeom || !routeGeom.coordinates || routeGeom.coordinates.length < 2) {
      setError('Draw a route polyline with at least two points.');
      return;
    }
    if (sortedStops.length < 2) {
      setError('Add at least two stops to save the route.');
      return;
    }
    const payloadStops = sortedStops.map((stop, index) => ({
      name: stop.name?.trim() || `Stop ${index + 1}`,
      lat: stop.lat,
      lng: stop.lng,
      seq: index
    }));
    onSave(routeGeom, payloadStops);
  };

  const handleClear = () => {
    if (polylineLayer.current) {
      polylineLayer.current.remove();
      polylineLayer.current = null;
    }
    stopMarkers.current.forEach((marker) => marker.remove());
    stopMarkers.current.clear();
    setRouteGeom(null);
    setStops([]);
    setError('');
    setCityRoute({ from: '', via: '', to: '' });
  };

  const moveStop = (idx, direction) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= sortedStops.length) {
      return;
    }
    const reordered = [...sortedStops];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(nextIdx, 0, removed);
    const orderedStops = reindexStops(reordered, { sort: false });
    setStops(orderedStops);
    syncMarkerIcons(orderedStops);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setStops((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const newStops = arrayMove(items, oldIndex, newIndex);

        // Redraw Polyline to match new order
        if (polylineLayer.current) {
          polylineLayer.current.remove();
        }
        const latlngs = newStops.map((s) => [s.lat, s.lng]);
        if (latlngs.length > 1) {
          const newPolyline = L.polyline(latlngs, {
            color: '#6366f1',
            weight: 4
          }).addTo(mapInstance.current);
          newPolyline.pm.enable();
          polylineLayer.current = newPolyline;
          setRouteGeom(lineToGeoJSON(newPolyline));
        }

        const orderedStops = reindexStops(newStops, { sort: false });
        syncMarkerIcons(orderedStops);
        return orderedStops;
      });
    }
  };

  const panelContent = (
    <div className="map-editor__panel-content space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center border border-emerald-500/20">
            <GripVertical size={14} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Stops</h3>
            <p className="text-xs text-slate-500">{sortedStops.length} stops added</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
        <p className="text-[11px] uppercase tracking-wider text-emerald-200">Simple Setup</p>
        <div className="mt-2 space-y-1.5 text-xs text-emerald-100/90">
          <p>{routeGeom ? '1. Route line: done' : '1. Draw route line from left toolbar'}</p>
          <p>{sortedStops.length >= 2 ? `2. Stops added: ${sortedStops.length}` : '2. Add at least 2 stops with marker tool'}</p>
          <p>3. Click "{saveButtonLabel}"</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <div className="rounded-xl border border-white/10 bg-slate-800/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Advanced Tools</p>
            <button
              type="button"
              className="rounded-md border border-white/15 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700/60"
              onClick={() => setShowAdvancedTools((prev) => !prev)}
            >
              {showAdvancedTools ? 'Hide' : 'Show'}
            </button>
          </div>

          {showAdvancedTools && (
            <>
              <p className="text-[11px] text-slate-400">Auto route by city names (optional)</p>
              <label className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
                <span>Auto-build on 2 pins (start + end)</span>
                <input
                  type="checkbox"
                  checked={autoBuildFromPins}
                  onChange={(e) => setAutoBuildFromPins(e.target.checked)}
                  className="h-4 w-4 accent-cyan-500"
                />
              </label>
              <div className="grid grid-cols-1 gap-2">
                <input
                  type="text"
                  value={cityRoute.from}
                  onChange={(e) => setCityRoute((prev) => ({ ...prev, from: e.target.value }))}
                  placeholder="From (e.g. Panipat)"
                  className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                />
                <input
                  type="text"
                  value={cityRoute.via}
                  onChange={(e) => setCityRoute((prev) => ({ ...prev, via: e.target.value }))}
                  placeholder="Via (optional, comma-separated)"
                  className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                />
                <input
                  type="text"
                  value={cityRoute.to}
                  onChange={(e) => setCityRoute((prev) => ({ ...prev, to: e.target.value }))}
                  placeholder="To (e.g. Kurukshetra)"
                  className="w-full rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
              <button
                type="button"
                className="w-full rounded-lg border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-sm font-medium text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAutoRouteFromCities}
                disabled={autoRouting}
              >
                {autoRouting ? 'Generating Route...' : 'Auto Route by City Names'}
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSave}
          disabled={sortedStops.length < 2 || autoRouting}
        >
          {saveButtonLabel}
        </button>

        <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 border border-white/10 transition hover:bg-slate-700/80 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleAutoRouteFromStops}
          disabled={sortedStops.length < 2 || autoRouting}
        >
          {autoRouting ? 'Generating...' : 'Auto Draw Route'}
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 border border-white/10 transition hover:bg-slate-700/80 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => {
            setStops((prev) => {
              const manualReindex = prev.slice().reverse().map((s, i) => ({ ...s, seq: i }));
              // Trigger polyline update
              if (polylineLayer.current) polylineLayer.current.remove();
              if (manualReindex.length > 1) {
                const latlngs = manualReindex.map((s) => [s.lat, s.lng]);
                const newPolyline = L.polyline(latlngs, { color: '#6366f1', weight: 4 }).addTo(mapInstance.current);
                newPolyline.pm.enable();
                polylineLayer.current = newPolyline;
                setRouteGeom(lineToGeoJSON(newPolyline));
              }
              return manualReindex;
            });
          }}
          disabled={sortedStops.length < 2 || autoRouting}
        >
          Reverse Stops
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 px-4 py-2.5 text-sm font-medium text-slate-300 border border-white/10 transition hover:bg-slate-700/80 hover:text-white"
          onClick={handleClear}
        >
          Reset Map
        </button>
        </div>
      </div>

      {/* Help Text */}
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <GripVertical size={12} className="text-slate-400" />
        Simple flow: draw line -&gt; add stops -&gt; continue. Use advanced tools only if needed.
      </p>

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
          {error}
        </div>
      )}

      {/* Stops List */}
      <div className="space-y-2">
        {sortedStops.length === 0 && (
          <div className="py-10 text-center rounded-xl border-2 border-dashed border-white/10 bg-slate-800/30">
            <div className="w-12 h-12 rounded-xl bg-slate-800/50 flex items-center justify-center mx-auto mb-3">
              <GripVertical size={20} className="text-slate-600" />
            </div>
            <p className="text-sm font-medium text-slate-400">No stops yet</p>
            <p className="text-xs text-slate-500 mt-1">Click on the map to add stops</p>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedStops}
            strategy={verticalListSortingStrategy}
          >
            {sortedStops.map((stop, index) => (
              <SortableStopRow
                key={stop.id}
                stop={stop}
                index={index}
                updateStopName={updateStopName}
                removeStop={removeStop}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );

  return (
    <div className="map-editor relative h-full w-full rounded-2xl overflow-hidden">
      <div className="map-editor__canvas h-full w-full" ref={mapNode} aria-label="Route map editor" />
      {/* If a panel ref is provided, portal the content there. Otherwise fallback to overlay (or hide) */}
      {panelContainerRef && panelContainerRef.current
        ? createPortal(panelContent, panelContainerRef.current)
        : null}
      
      {/* Stop Name Modal */}
      <StopNameModal
        isOpen={stopModal.isOpen}
        defaultName={stopModal.defaultName}
        onConfirm={handleStopNameConfirm}
        onCancel={handleStopNameCancel}
      />
    </div>
  );
};

export default MapEditor;
