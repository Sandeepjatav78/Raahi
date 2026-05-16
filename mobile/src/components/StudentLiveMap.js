import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const StudentLiveMap = ({ busPosition, stopPosition, collegePosition, theme = 'dark', busLabel = 'Bus' }) => {
  const center = useMemo(() => busPosition || stopPosition || collegePosition || { lat: 28.9, lng: 76.95 }, [busPosition, stopPosition, collegePosition]);
  const isDark = theme === 'dark';
  const mapKey = `${center.lat}-${center.lng}`;

  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <Text style={[styles.header, isDark ? styles.headerDark : styles.headerLight]}>Live Map</Text>
      <MapView
        key={mapKey}
        style={styles.map}
        initialRegion={{
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04
        }}
      >
        {busPosition ? (
          <Marker coordinate={{ latitude: busPosition.lat, longitude: busPosition.lng }} title={busLabel}>
            <View style={styles.busMarkerWrap}>
              <Text style={styles.busMarkerText}>BUS</Text>
            </View>
          </Marker>
        ) : null}
        {stopPosition ? <Marker coordinate={{ latitude: stopPosition.lat, longitude: stopPosition.lng }} title="Your Stop" pinColor="#f97316" /> : null}
        {collegePosition ? <Marker coordinate={{ latitude: collegePosition.lat, longitude: collegePosition.lng }} title="College" pinColor="#22c55e" /> : null}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 12, borderWidth: 1 },
  cardDark: { backgroundColor: '#0f1b2d', borderColor: 'rgba(255,255,255,0.06)' },
  cardLight: { backgroundColor: '#ffffff', borderColor: '#dbeafe' },
  header: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  headerDark: { color: 'white' },
  headerLight: { color: '#0f172a' },
  map: { height: 260, borderRadius: 18 },
  busMarkerWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  busMarkerText: { fontSize: 10, color: 'white', fontWeight: '800', letterSpacing: 0.4 }
});

export default StudentLiveMap;
