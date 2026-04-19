import { useMemo, useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PIET_COLLEGE } from '../constants/geo';

const busIcon = new L.Icon({
    iconUrl: '/markers/bus.png',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

const sosIcon = new L.Icon({
    iconUrl: '/markers/bus.png',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -21],
    className: 'animate-pulse'
});

const collegeIcon = L.divIcon({
    className: 'college-map-pin',
    html: '<div style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(14,165,233,0.9);color:#fff;font-size:18px;box-shadow:0 10px 24px rgba(14,165,233,0.35);border:2px solid rgba(255,255,255,0.85)">🏫</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18]
});

// Auto-fit bounds when buses change
const FitBounds = ({ buses }) => {
    const map = useMap();

    useEffect(() => {
        const points = [...buses, PIET_COLLEGE].filter((point) => point?.lat && point?.lng);
        if (points.length === 0) return;

        const bounds = points
            .filter(b => b.lat && b.lng)
            .map(b => [b.lat, b.lng]);

        if (bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
    }, [buses, map]);

    return null;
};

const AdminMap = ({ buses = [], sosTrips = [], onBusClick }) => {
    const defaultCenter = { lat: 17.385, lng: 78.4867 };

    const activeBuses = useMemo(() =>
        buses.filter(b => b.lastPosition?.lat && b.lastPosition?.lng),
        [buses]
    );

    const sosSet = useMemo(() =>
        new Set(sosTrips.map(t => t.tripId)),
        [sosTrips]
    );

    return (
        <MapContainer
            center={activeBuses[0]?.lastPosition || PIET_COLLEGE || defaultCenter}
            zoom={12}
            style={{ height: '100%', width: '100%', minHeight: '300px' }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
            />

            <FitBounds buses={activeBuses.map(b => b.lastPosition)} />

            <Marker position={PIET_COLLEGE} icon={collegeIcon}>
                <Popup>
                    <div className="min-w-[150px]">
                        <p className="font-bold text-sm">College</p>
                        <p className="text-xs text-gray-600">P.I.E.T - Panipat Institute of Engineering &amp; Technology</p>
                    </div>
                </Popup>
            </Marker>

            {activeBuses.map(bus => {
                const isSOS = sosSet.has(bus.tripId);
                const pos = [bus.lastPosition.lat, bus.lastPosition.lng];

                return (
                    <Marker
                        key={bus._id}
                        position={pos}
                        icon={isSOS ? sosIcon : busIcon}
                        eventHandlers={{
                            click: () => onBusClick?.(bus)
                        }}
                    >
                        <Popup>
                            <div className="min-w-[150px]">
                                <p className="font-bold text-sm">{bus.name || 'Unknown Bus'}</p>
                                <p className="text-xs text-gray-600">{bus.numberPlate}</p>
                                {bus.driverName && (
                                    <p className="text-xs mt-1">Driver: {bus.driverName}</p>
                                )}
                                {isSOS && (
                                    <p className="text-xs text-red-600 font-bold mt-1">⚠️ SOS ACTIVE</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                    {bus.studentCount || 0} students tracking
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </MapContainer>
    );
};

export default AdminMap;
