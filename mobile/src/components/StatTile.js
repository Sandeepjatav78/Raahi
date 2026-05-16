import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const StatTile = ({ label, value, subtext, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  return (
    <View style={[styles.card, isDark ? styles.cardDark : styles.cardLight]}>
      <Text style={[styles.label, isDark ? styles.labelDark : styles.labelLight]}>{label}</Text>
      <Text style={[styles.value, isDark ? styles.valueDark : styles.valueLight]}>{value}</Text>
      {subtext ? <Text style={[styles.subtext, isDark ? styles.subtextDark : styles.subtextLight]}>{subtext}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 20, padding: 14, borderWidth: 1 },
  cardDark: { backgroundColor: '#0f1b2d', borderColor: 'rgba(255,255,255,0.06)' },
  cardLight: { backgroundColor: '#ffffff', borderColor: '#dbeafe' },
  label: { fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  labelDark: { color: '#94a3b8' },
  labelLight: { color: '#64748b' },
  value: { fontSize: 18, fontWeight: '700', marginTop: 6 },
  valueDark: { color: 'white' },
  valueLight: { color: '#0f172a' },
  subtext: { marginTop: 4, fontSize: 12 },
  subtextDark: { color: '#64748b' },
  subtextLight: { color: '#475569' }
});

export default StatTile;
