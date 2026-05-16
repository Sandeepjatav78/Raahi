import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ScreenShell = ({ title, subtitle, children, right, theme = 'dark', bottomOverlay = null }) => {
  const insets = useSafeAreaInsets();
  const isDark = theme === 'dark';
  const pageBg = isDark ? '#07111f' : '#f1f5f9';
  const titleColor = isDark ? 'white' : '#0f172a';
  const subtitleColor = isDark ? '#94a3b8' : '#475569';

  return (
    <View style={[styles.container, { backgroundColor: pageBg }]}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: pageBg }]} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={[styles.scrollContent, { backgroundColor: pageBg, paddingTop: 10 }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
              {subtitle ? <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
      {bottomOverlay}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  safeArea: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, minHeight: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  title: { fontSize: 26, fontWeight: '800' },
  subtitle: { marginTop: 4 }
});

export default ScreenShell;
