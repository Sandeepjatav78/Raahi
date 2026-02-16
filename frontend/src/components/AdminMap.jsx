import { useMemo, useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Auto-fit bounds when buses change
const FitBounds = ({ buses }) => {
    const map = useMap();

    useEffect(() => {
        if (buses.length === 0) return;

        const bounds = buses
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
            center={activeBuses[0]?.lastPosition || defaultCenter}
            zoom={12}
            style={{ height: '100%', width: '100%', minHeight: '300px' }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
            />

            <FitBounds buses={activeBuses.map(b => b.lastPosition)} />

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
