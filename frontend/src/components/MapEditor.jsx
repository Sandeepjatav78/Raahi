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
import { ELURU_CENTER, TILE_LAYER_ATTRIBUTION, TILE_LAYER_URL } from '../constants/geo';

const DEFAULT_CENTER = [ELURU_CENTER.lat, ELURU_CENTER.lng];

const stopIcon = new L.Icon({
  iconUrl: '/markers/stop.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
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

const MapEditor = ({ initialRoute = null, initialStops = [], onSave, panelContainerRef }) => {
  const mapNode = useRef(null);
  const mapInstance = useRef(null);
  const polylineLayer = useRef(null);
  const stopMarkers = useRef(new Map());
  const [routeGeom, setRouteGeom] = useState(initialRoute);
  const [stops, setStops] = useState(reindexStops(initialStops));
  const [nameEdits, setNameEdits] = useState({});
  const [error, setError] = useState('');
  
  // Modal state for stop naming
  const [stopModal, setStopModal] = useState({ 
    isOpen: false, 
    defaultName: '', 
    mode: 'create', // 'create' or 'edit'
    stopId: null,
    pendingLayer: null 
  });

  const sortedStops = useMemo(() => reindexStops(stops), [stops]);

  // Handle modal confirm for creating new stop
  const handleStopNameConfirm = (name) => {
    if (stopModal.mode === 'create' && stopModal.pendingLayer) {
      const layer = stopModal.pendingLayer;
      const stop = markerToStop(layer, stops.length, name);
      layer.__stopId = stop.id;
      stopMarkers.current.set(stop.id, layer);
      attachMarkerHandlers(layer, stop.id);
      setStops((prev) => reorderStopsAlongLine(routeGeom, [...prev, stop]));
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
      setStops((prev) =>
        reindexStops(
          prev.map((stop) => (stop.id === stopId ? { ...stop, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) } : stop))
        )
      );
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
    setStops((prev) => reindexStops(prev.filter((stop) => stop.id !== stopId)));
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
      setStops(reindexStops(normalizedStops));
    }
  };

  useEffect(() => {
    if (!mapNode.current || mapInstance.current) return;
    mapInstance.current = L.map(mapNode.current).setView(DEFAULT_CENTER, 14);

    L.tileLayer(TILE_LAYER_URL, {
      attribution: TILE_LAYER_ATTRIBUTION
    }).addTo(mapInstance.current);

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
  };

  const moveStop = (idx, direction) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= sortedStops.length) {
      return;
    }
    const reordered = [...sortedStops];
    const [removed] = reordered.splice(idx, 1);
    reordered.splice(nextIdx, 0, removed);
    setStops(reindexStops(reordered, { sort: false }));
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

        return reindexStops(newStops, { sort: false });
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

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleSave}
          disabled={sortedStops.length < 2}
        >
          Save Route
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
          disabled={sortedStops.length < 2}
        >
          ↕️ Reverse
        </button>
      </div>

      {/* Help Text */}
      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <GripVertical size={12} className="text-slate-400" />
        Drag to reorder • Click map to add stops
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
