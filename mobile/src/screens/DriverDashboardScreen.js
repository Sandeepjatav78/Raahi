import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ScreenShell from '../components/ScreenShell';

const normalizeLocation = (location) => {
  if (!location) return null;
  const lat = location.lat ?? location.latitude ?? location?.coords?.lat ?? location?.location?.lat;
  const lng = location.lng ?? location.longitude ?? location?.coords?.lng ?? location?.location?.lng;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
};

const DEFAULT_REGION = {
  latitude: 29.969,
  longitude: 76.889,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03
};

const DriverDashboardScreen = () => {
  const { user, logout } = useAuth();
  const [assignedBus, setAssignedBus] = useState(null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Loading driver dashboard...');
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastSentAt, setLastSentAt] = useState(null);
  const [sending, setSending] = useState(false);
  const [region, setRegion] = useState(DEFAULT_REGION);

  const subscriptionRef = useRef(null);
  const tripRef = useRef(null);
  const mapViewRef = useRef(null);

  const busLocation = useMemo(() => normalizeLocation(assignedBus?.lastKnownLocation), [assignedBus]);

  useEffect(() => {
    tripRef.current = trip;
  }, [trip]);

  const stopTracking = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    setIsTracking(false);
  }, []);

  const sendLocation = useCallback(async (locationPoint) => {
    const activeTrip = tripRef.current;
    if (!activeTrip) return;
    const tripId = activeTrip._id || activeTrip.id;
    const payload = {
      tripId,
      busId: activeTrip?.bus?._id || activeTrip?.bus?.id || activeTrip?.bus || user?.assignedBusId,
      lat: locationPoint.latitude,
      lng: locationPoint.longitude,
      accuracy: locationPoint.accuracy ?? null,
      speed: locationPoint.speed ?? null,
      heading: locationPoint.heading ?? null,
      timestamp: Date.now()
    };

    setSending(true);
    try {
      await api.post('/drivers/trips/location', payload);
      setLastSentAt(new Date());
      setStatusMessage('Broadcasting live location');
    } catch (error) {
      setStatusMessage(error?.response?.data?.message || 'Failed to send location');
    } finally {
      setSending(false);
    }
  }, [user?.assignedBusId]);

  const startTracking = useCallback(async () => {
    if (subscriptionRef.current) return;

    // Check if location services are enabled on device
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      setStatusMessage('Location service is disabled on device');
      setPermissionStatus('service-disabled');
      Alert.alert(
        'Location service disabled',
        'Enable location in device settings:\n\n1. Go to Settings\n2. Select Apps or Apps & notifications\n3. Find "Raahi"\n4. Tap "Permissions"\n5. Enable "Location"\n\nThen return to the app to start tracking.',
        [{ text: 'Got it', onPress: () => {} }]
      );
      return;
    }

    // Request location permission
    const permission = await Location.requestForegroundPermissionsAsync();
    setPermissionStatus(permission.status);
    if (permission.status !== 'granted') {
      setStatusMessage('Location permission denied. Enable it to broadcast live GPS.');
      Alert.alert(
        'Location permission required',
        'This app needs permission to access your location in order to show the bus position in real-time and broadcast accurate GPS coordinates to the backend.',
        [{ text: 'Dismiss', onPress: () => {} }]
      );
      return;
    }

    // Start location tracking with high accuracy
    try {
      // Get immediate position for faster initial display
      const currentFix = await Location.getCurrentPositionAsync({ 
        accuracy: Location.Accuracy.Highest,
        maxAge: 5000,
        timeout: 10000
      });
      const normalizedFix = {
        latitude: Number(currentFix.coords.latitude.toFixed(6)),
        longitude: Number(currentFix.coords.longitude.toFixed(6)),
        accuracy: currentFix.coords.accuracy ?? null,
        speed: currentFix.coords.speed ?? null,
        heading: currentFix.coords.heading ?? null
      };
      setCurrentLocation(normalizedFix);
      setRegion((prev) => ({
        ...prev,
        latitude: normalizedFix.latitude,
        longitude: normalizedFix.longitude
      }));
      setIsTracking(true);
      if (tripRef.current) {
        sendLocation(normalizedFix);
      }
    } catch (_error) {
      // Ignore initial-fix failures; watchPositionAsync will continue trying.
    }

    // Watch position with high accuracy for continuous tracking
    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,
        timeInterval: 3000,
        distanceInterval: 5,
        mayShowUserSettingsDialog: true
      },
      (locationPoint) => {
        const normalized = {
          latitude: Number(locationPoint.coords.latitude.toFixed(6)),
          longitude: Number(locationPoint.coords.longitude.toFixed(6)),
          accuracy: locationPoint.coords.accuracy ?? null,
          speed: locationPoint.coords.speed ?? null,
          heading: locationPoint.coords.heading ?? null
        };

        setCurrentLocation(normalized);
        setRegion((prev) => ({
          ...prev,
          latitude: normalized.latitude,
          longitude: normalized.longitude
        }));
        setIsTracking(true);
        sendLocation(normalized);
      }
    );

    subscriptionRef.current = sub;
    setIsTracking(true);
    setStatusMessage('GPS tracking active - broadcasting live location');
  }, [sendLocation]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [busRes, tripRes] = await Promise.all([
        api.get('/drivers/bus').catch(() => ({ data: null })),
        api.get('/drivers/trip').catch(() => ({ data: null }))
      ]);

      setAssignedBus(busRes.data || null);
      setTrip(tripRes.data || null);
      tripRef.current = tripRes.data || null;

      if (tripRes.data) {
        setStatusMessage('Active trip loaded');
      } else {
        setStatusMessage('Ready to start trip');
      }
    } catch (error) {
      setStatusMessage(error?.response?.data?.message || 'Failed to load driver data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Start GPS tracking immediately on mount to show live location
    startTracking();
    return () => stopTracking();
  }, [fetchData, stopTracking, startTracking]);

  useEffect(() => {
    // Only broadcast location to backend when there's an active trip
    if (trip && currentLocation && !sending) {
      sendLocation(currentLocation);
    }
  }, [trip, currentLocation, sendLocation, sending]);

  const handleStartTrip = async () => {
    const busId = assignedBus?._id || user?.assignedBusId;
    if (!busId) {
      setStatusMessage('No bus assigned. Contact admin.');
      return;
    }

    try {
      const { data } = await api.post('/drivers/trips/start', { busId });
      setTrip(data);
      tripRef.current = data;
      setStatusMessage('Trip started');
      await startTracking();
    } catch (error) {
      setStatusMessage(error?.response?.data?.message || 'Failed to start trip');
    }
  };

  const handleEndTrip = async () => {
    if (!tripRef.current) return;

    try {
      stopTracking();
      const tripId = tripRef.current._id || tripRef.current.id;
      await api.post('/drivers/trips/end', { tripId });
      setTrip(null);
      tripRef.current = null;
      setStatusMessage('Trip ended');
    } catch (error) {
      setStatusMessage(error?.response?.data?.message || 'Failed to end trip');
    }
  };

  const handleTrackBus = () => {
    if (!busLocation) {
      setStatusMessage('Bus location not available yet');
      return;
    }
    if (mapViewRef.current) {
      mapViewRef.current.animateToRegion({
        latitude: busLocation.latitude || busLocation.lat,
        longitude: busLocation.longitude || busLocation.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015
      }, 500);
      setStatusMessage('Centered on bus location');
    }
  };

  const handleTrackMe = () => {
    if (!currentLocation) {
      setStatusMessage('Your location not available yet');
      return;
    }
    if (mapViewRef.current) {
      mapViewRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015
      }, 500);
      setStatusMessage('Centered on your location');
    }
  };

  const currentRegion = currentLocation
    ? {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015
      }
    : busLocation
    ? {
        latitude: busLocation.latitude || busLocation.lat,
        longitude: busLocation.longitude || busLocation.lng,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta
      }
    : region;
  const liveBusPosition = currentLocation || busLocation;

  if (loading) {
    return (
      <ScreenShell title="Driver" subtitle="Trip controls and live updates">
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#38bdf8" />
          <Text style={styles.loadingText}>Loading driver dashboard...</Text>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      title="Driver"
      subtitle={trip ? 'Live trip active' : 'Trip controls and live GPS'}
      right={
        <Pressable onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      }
      bottomOverlay={
        <View style={styles.floatingButtonsContainer}>
          <Pressable style={styles.floatingButton} onPress={handleTrackMe}>
            <Text style={styles.floatingButtonText}>📍</Text>
          </Pressable>
          <Pressable style={styles.floatingButton} onPress={handleTrackBus}>
            <Text style={styles.floatingButtonText}>🚌</Text>
          </Pressable>
        </View>
      }
    >
      <View style={styles.card}>
        <Text style={styles.heading}>{trip ? 'Trip Active' : 'Ready to Start'}</Text>
        <Text style={styles.text}>{statusMessage}</Text>
        <Text style={styles.meta}>GPS permission: {permissionStatus === 'service-disabled' ? 'Service disabled' : permissionStatus}</Text>
        <Text style={styles.meta}>Tracking: {isTracking ? 'active' : 'stopped'}</Text>
        <Text style={styles.meta}>Last sent: {lastSentAt ? lastSentAt.toLocaleTimeString() : 'n/a'}</Text>
        <Text style={styles.meta}>Sending: {sending ? 'yes' : 'no'}</Text>

        <View style={styles.row}>
          {!trip ? (
            <Pressable style={styles.primary} onPress={handleStartTrip}>
              <Text style={styles.primaryText}>Start Trip</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.secondary} onPress={handleEndTrip}>
              <Text style={styles.secondaryText}>End Trip</Text>
            </Pressable>
          )}
          <Pressable style={styles.secondary} onPress={startTracking}>
            <Text style={styles.secondaryText}>Start GPS</Text>
          </Pressable>
          <Pressable style={styles.trackBusButton} onPress={handleTrackBus}>
            <Text style={styles.trackBusText}>🚌 Track Bus</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mapCard}>
        <Text style={styles.heading}>Live location</Text>
        <Text style={styles.text}>The bus marker follows the driver phone's live GPS.</Text>
        <MapView ref={mapViewRef} style={styles.map} region={currentRegion} showsUserLocation followsUserLocation>
          {liveBusPosition && <Marker coordinate={{ latitude: liveBusPosition.latitude, longitude: liveBusPosition.longitude }} title="Bus / driver phone" pinColor="#38bdf8" />}
        </MapView>
        {liveBusPosition ? (
          <Text style={styles.coords}>
            {liveBusPosition.latitude}, {liveBusPosition.longitude}
          </Text>
        ) : (
          <Text style={styles.coordsMuted}>No GPS fix yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Assigned bus</Text>
        {assignedBus ? (
          <>
            <Text style={styles.text}>{assignedBus.name} · {assignedBus.numberPlate || 'No plate'}</Text>
            <Text style={styles.meta}>Route: {assignedBus.route?.name || 'Unassigned route'}</Text>
            <Text style={styles.meta}>Bus marker: {liveBusPosition ? `${liveBusPosition.latitude}, ${liveBusPosition.longitude}` : 'No GPS fix yet'}</Text>
            {busLocation && !currentLocation ? (
              <Text style={styles.meta}>Last known: {busLocation.lat}, {busLocation.lng}</Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.text}>No assigned bus loaded.</Text>
        )}
      </View>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: '#0f1b2d', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },
  mapCard: { backgroundColor: '#0f1b2d', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 14 },
  map: { width: '100%', height: 250, borderRadius: 18, marginTop: 12 },
  heading: { color: 'white', fontSize: 18, fontWeight: '800' },
  text: { color: '#94a3b8', marginTop: 8, lineHeight: 20 },
  meta: { color: '#cbd5e1', marginTop: 6, fontSize: 13 },
  coords: { color: '#e2e8f0', marginTop: 10, fontWeight: '700' },
  coordsMuted: { color: '#64748b', marginTop: 10 },
  row: { flexDirection: 'row', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  primary: { backgroundColor: '#2563eb', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 },
  secondary: { backgroundColor: '#132238', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 },
  primaryText: { color: 'white', fontWeight: '800' },
  secondaryText: { color: '#dbeafe', fontWeight: '700' },
  loadingBox: { backgroundColor: '#0f1b2d', borderRadius: 24, padding: 24, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#cbd5e1', marginTop: 12 },
  logoutButton: { backgroundColor: '#1e293b', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  logoutText: { color: 'white', fontWeight: '800' },
  trackBusButton: { backgroundColor: '#ea580c', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, flex: 1 },
  trackBusText: { color: 'white', fontWeight: '800', textAlign: 'center' },
  floatingButtonsContainer: { position: 'absolute', bottom: 20, right: 16, gap: 12, alignItems: 'center' },
  floatingButton: { backgroundColor: '#2563eb', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 8, zIndex: 1000 },
  floatingButtonText: { fontSize: 28 }
});

export default DriverDashboardScreen;
