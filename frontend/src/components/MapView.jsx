import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PIET_COLLEGE } from '../constants/geo';

const busIcon = new L.Icon({
  iconUrl: '/markers/bus.png',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
  popupAnchor: [0, -20]
});

const collegeIcon = L.divIcon({
  className: 'college-map-pin',
  html: '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,0.9);color:#fff;font-size:18px;box-shadow:0 10px 24px rgba(14,165,233,0.35);border:2px solid rgba(255,255,255,0.85)">🏫</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

const MapView = ({ busPosition, stopPosition }) => {
  const center = busPosition || stopPosition || PIET_COLLEGE;

  return (
    <MapContainer center={center} zoom={14} style={{ height: '320px', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {busPosition && (
        <Marker position={busPosition} icon={busIcon}>
          <Popup>Bus live location</Popup>
        </Marker>
      )}
      {stopPosition && (
        <Marker position={stopPosition}>
          <Popup>Your stop</Popup>
        </Marker>
      )}
      <Marker position={PIET_COLLEGE} icon={collegeIcon}>
        <Popup>College</Popup>
      </Marker>
    </MapContainer>
  );
};

export default MapView;
