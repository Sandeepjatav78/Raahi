import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ELURU_CENTER, PIET_COLLEGE, TILE_LAYER_ATTRIBUTION, TILE_LAYER_URL } from '../constants/geo';

const driverIcon = new L.Icon({
  iconUrl: '/markers/bus.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

const stopIcon = new L.Icon({
  iconUrl: '/markers/stop.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const collegeIcon = L.divIcon({
  className: 'college-map-pin',
  html: '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,0.9);color:#fff;font-size:18px;box-shadow:0 10px 24px rgba(14,165,233,0.35);border:2px solid rgba(255,255,255,0.85)">🏫</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const deriveStops = (route) => {
  if (!route) return [];
  if (Array.isArray(route?.stops) && route.stops.length && typeof route.stops[0] === 'object' && 'sequence' in route.stops[0]) {
    return route.stops
      .map((stop) => ({
        lat: stop.lat || stop.latitude,
        lng: stop.lng || stop.longitude,
        name: stop.name || `Stop ${stop.seq ?? stop.sequence}`
      }))
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng));
  }
  if (Array.isArray(route?.stops) && typeof route.stops[0] === 'string') {
    return route.stops
      .map((coord) => {
        const [lng, lat] = coord.coordinates || coord;
        return { lat, lng, name: 'Stop' };
      })
      .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng));
  }
  return [];
};

const LiveViewport = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (!map || !position) return;
    map.setView(position, map.getZoom(), { animate: true });
  }, [map, position]);
  return null;
};

const DriverMap = ({ lastPosition, route, children }) => {
  const stops = useMemo(() => deriveStops(route), [route]);
  const polylineCoords = useMemo(() => {
    if (!route?.geojson?.coordinates) return [];
    return route.geojson.coordinates.map(([lng, lat]) => [lat, lng]);
  }, [route]);
  const center = lastPosition || stops[0] || PIET_COLLEGE || ELURU_CENTER;

  return (
    <section className="surface-card rounded-2xl p-4 shadow">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sky-200">Driver map</p>
          <p className="text-sm text-slate-200">Your live GPS and assigned route</p>
        </div>
      </div>
      <MapContainer center={center} zoom={15} className="h-80 w-full rounded-xl" scrollWheelZoom>
        <TileLayer url={TILE_LAYER_URL} attribution={TILE_LAYER_ATTRIBUTION} />
        {children}
        {polylineCoords.length > 0 && <Polyline positions={polylineCoords} color="#0ea5e9" weight={5} opacity={0.8} />}
        {stops.map((stop) => (
          <Marker key={`${stop.lat}-${stop.lng}`} position={stop} icon={stopIcon} title={stop.name} />
        ))}
        <Marker position={PIET_COLLEGE} icon={collegeIcon} title="College">
          <Popup>College</Popup>
        </Marker>
        {lastPosition && <Marker position={lastPosition} icon={driverIcon} title="You" />}
        <LiveViewport position={lastPosition} />
      </MapContainer>
      <p className="mt-2 text-xs text-slate-400">
        GPS updates refresh as soon as they are emitted from your device. If the marker does not move, check the tracking
        controls above.
      </p>
    </section>
  );
};

export default DriverMap;
