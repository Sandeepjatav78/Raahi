import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenShell from '../components/ScreenShell';

const AdminDashboardScreen = () => (
  <ScreenShell title="Admin" subtitle="Manage routes, buses, students, and drivers">
    <View style={styles.card}>
      <Text style={styles.heading}>Admin panels</Text>
      <Text style={styles.text}>The mobile port can reuse the same admin APIs for route, bus, and student management.</Text>
    </View>
  </ScreenShell>
);

const styles = StyleSheet.create({
  card: { backgroundColor: '#0f1b2d', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  heading: { color: 'white', fontSize: 18, fontWeight: '800' },
  text: { color: '#94a3b8', marginTop: 8, lineHeight: 20 }
});

export default AdminDashboardScreen;
