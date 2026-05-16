import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { io } from 'socket.io-client';
import ScreenShell from '../components/ScreenShell';
import StatTile from '../components/StatTile';
import StudentLiveMap from '../components/StudentLiveMap';
import { api } from '../services/api';
import { SOCKET_ROOT } from '../config';
import { computeFallbackETA, formatETA } from '../utils/eta';
import { useAuth } from '../context/AuthContext';

const PIET_COLLEGE = { lat: 29.969, lng: 76.889 };

const normalizeLocation = (location) => {
  if (!location) return null;
  const lat = location.lat ?? location.latitude ?? location?.coords?.lat ?? location?.location?.lat;
  const lng = location.lng ?? location.longitude ?? location?.coords?.lng ?? location?.location?.lng;
  return typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null;
};

const normalizeBus = (data) => data?.bus || data?.assignment?.bus || null;
const normalizeStop = (data) => data?.stop || data?.assignment?.stop || null;

const StudentDashboardScreen = () => {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [trip, setTrip] = useState(null);
  const [etaMs, setEtaMs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [profileOpen, setProfileOpen] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceQrCode, setAttendanceQrCode] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [showTrackAnyBusModal, setShowTrackAnyBusModal] = useState(false);
  const [liveBusList, setLiveBusList] = useState([]);
  const [liveBusLoading, setLiveBusLoading] = useState(false);
  const [trackedBus, setTrackedBus] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    email: '',
    photoUrl: '',
    currentPassword: '',
    password: '',
    confirmPassword: ''
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/students/me').catch(() => api.get('/auth/me'));
      let data = response?.data;
      if (!data || !normalizeBus(data)) {
        const assignmentRes = await api.get('/students/assignment').catch(() => ({ data: null }));
        if (assignmentRes?.data) {
          data = {
            ...(data || {}),
            bus: normalizeBus(assignmentRes.data),
            stop: normalizeStop(assignmentRes.data)
          };
        }
      }

      const normalizedBus = normalizeBus(data);
      const normalizedStop = normalizeStop(data);
      setProfile({ ...(data || {}), bus: normalizedBus, stop: normalizedStop });
      const tripRes = await api.get('/students/trip').catch(() => ({ data: null }));
      setTrip(tripRes.data);
      const etaRes = await api.get('/students/eta').catch(() => ({ data: {} }));
      if (typeof etaRes.data?.etaMs === 'number') setEtaMs(etaRes.data.etaMs);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!profile) return;
    setProfileForm((prev) => ({
      ...prev,
      name: profile.name || '',
      phone: profile.phone || '',
      email: profile.email || '',
      photoUrl: profile.photoUrl || '',
      currentPassword: '',
      password: '',
      confirmPassword: ''
    }));
  }, [profile]);

  useEffect(() => {
    if (!trip?._id) return;
    const socket = io(SOCKET_ROOT, { transports: ['websocket'] });
    socket.emit('student:subscribe', { tripId: trip._id });
    socket.on('trip:eta_update', (payload) => {
      const targetSeq = String(profile?.stop?.seq ?? profile?.stop?.sequence ?? '');
      if (payload?.etasMap && typeof payload.etasMap[targetSeq] === 'number') {
        setEtaMs(payload.etasMap[targetSeq]);
      }
    });
    socket.on('trip:location_update', (payload) => {
      const busPos = normalizeLocation(payload);
      const stopPos = normalizeLocation(profile?.stop);
      if (busPos && stopPos) {
        const fallback = computeFallbackETA(busPos, stopPos, 5);
        if (fallback) setEtaMs(fallback);
      }
    });
    return () => {
      socket.emit('student:unsubscribe', { tripId: trip._id });
      socket.disconnect();
    };
  }, [trip?._id, profile]);

  const busPosition = normalizeLocation(profile?.bus?.lastKnownLocation);
  const stopPosition = normalizeLocation(profile?.stop);
  const trackedBusPosition = trackedBus ? normalizeLocation(trackedBus.lastKnownLocation) : null;
  const displayBusPosition = trackedBusPosition || busPosition;
  const displayBusLabel = trackedBus
    ? `${trackedBus.name || 'Bus'} (${trackedBus.numberPlate || 'No plate'})`
    : 'Assigned Bus';
  const etaText = useMemo(() => formatETA(etaMs), [etaMs]);
  const isDark = theme === 'dark';

  const updateProfileField = (key, value) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');

    if (!profileForm.name.trim()) {
      setProfileError('Name is required');
      return;
    }

    if (profileForm.password && profileForm.password.length < 6) {
      setProfileError('New password must be at least 6 characters');
      return;
    }

    if (profileForm.password && !profileForm.currentPassword) {
      setProfileError('Current password is required to change password');
      return;
    }

    if (profileForm.password && profileForm.password !== profileForm.confirmPassword) {
      setProfileError('New password and confirm password do not match');
      return;
    }

    const payload = {
      name: profileForm.name.trim(),
      phone: profileForm.phone.trim(),
      email: profileForm.email.trim(),
      photoUrl: profileForm.photoUrl.trim() || null
    };

    if (profileForm.password) {
      payload.currentPassword = profileForm.currentPassword;
      payload.password = profileForm.password;
    }

    setProfileSaving(true);
    try {
      const { data: updatedUser } = await api.put('/auth/profile', payload);
      setProfile((prev) => ({
        ...prev,
        ...updatedUser,
        bus: prev?.bus,
        stop: prev?.stop
      }));
      setProfileForm((prev) => ({
        ...prev,
        currentPassword: '',
        password: '',
        confirmPassword: ''
      }));
      setProfileSuccess('Profile updated successfully');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchLiveBuses = useCallback(async () => {
    setLiveBusLoading(true);
    try {
      const { data } = await api.get('/students/live-buses');
      setLiveBusList(Array.isArray(data) ? data : []);
    } catch (_error) {
      Alert.alert('Error', 'Failed to load buses');
    } finally {
      setLiveBusLoading(false);
    }
  }, []);

  const markAttendance = async () => {
    const qrValue = attendanceQrCode.trim();
    if (!qrValue) {
      Alert.alert('Required', 'Please enter or scan QR code');
      return;
    }
    setAttendanceLoading(true);
    try {
      const { data } = await api.post('/students/attendance/scan', { qrCode: qrValue });
      Alert.alert('Success', data?.message || 'Attendance marked');
      setShowAttendanceModal(false);
      setAttendanceQrCode('');
    } catch (err) {
      Alert.alert('Failed', err?.response?.data?.message || 'Attendance mark failed');
    } finally {
      setAttendanceLoading(false);
    }
  };

  const trackMyBus = () => {
    const assigned = profile?.bus;
    if (!assigned) {
      Alert.alert('Not Found', 'No assigned bus found');
      return;
    }
    setTrackedBus({
      _id: assigned._id,
      name: assigned.name,
      numberPlate: assigned.numberPlate,
      routeName: assigned.route?.name || 'Assigned route',
      lastKnownLocation: assigned.lastKnownLocation || null,
      isAssignedToMe: true
    });
    Alert.alert('Tracking', 'Now tracking your assigned bus');
  };

  const trackAnyBus = async () => {
    setShowTrackAnyBusModal(true);
    await fetchLiveBuses();
  };

  const bottomActionBar = (
    <View style={styles.bottomActionsWrap}>
      <View style={[styles.bottomActions, isDark ? styles.bottomActionsDark : styles.bottomActionsLight]}>
        <Pressable style={styles.bottomActionBtn} onPress={() => setShowAttendanceModal(true)}>
          <Text style={styles.bottomActionIcon}>QR</Text>
          <Text style={styles.bottomActionText}>Attendance</Text>
        </Pressable>
        <Pressable style={styles.bottomActionBtn} onPress={trackMyBus}>
          <Text style={styles.bottomActionIcon}>MY</Text>
          <Text style={styles.bottomActionText}>My Bus</Text>
        </Pressable>
        <Pressable style={styles.bottomActionBtn} onPress={trackAnyBus}>
          <Text style={styles.bottomActionIcon}>ALL</Text>
          <Text style={styles.bottomActionText}>Any Bus</Text>
        </Pressable>
        <Pressable style={[styles.bottomActionBtn, styles.bottomActionAccent]} onPress={() => setShowAttendanceModal(true)}>
          <Text style={[styles.bottomActionIcon, styles.bottomActionAccentText]}>GO</Text>
          <Text style={[styles.bottomActionText, styles.bottomActionAccentText]}>Scan</Text>
        </Pressable>
      </View>
    </View>
  );

  const actionBar = (
    <View style={styles.topActions}>
      <Pressable
        onPress={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        style={[styles.topActionBtn, isDark ? styles.topActionBtnDark : styles.topActionBtnLight]}
      >
        <Text style={[styles.topActionText, isDark ? styles.topActionTextDark : styles.topActionTextLight]}>
          {isDark ? 'Light' : 'Dark'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => setProfileOpen(true)}
        style={[styles.topActionBtn, isDark ? styles.topActionBtnDark : styles.topActionBtnLight]}
      >
        <Text style={[styles.topActionText, isDark ? styles.topActionTextDark : styles.topActionTextLight]}>Profile</Text>
      </Pressable>

      <Pressable
        onPress={logout}
        style={[styles.topActionBtn, styles.logoutBtn]}
      >
        <Text style={styles.logoutBtnText}>Logout</Text>
      </Pressable>
    </View>
  );

  if (loading) {
    return <ScreenShell title="Student" subtitle="Loading your live dashboard" theme={theme} right={actionBar} bottomOverlay={bottomActionBar}><ActivityIndicator color="#38bdf8" /></ScreenShell>;
  }

  return (
    <ScreenShell title={profile?.name || 'Student'} subtitle="Live commute dashboard" theme={theme} right={actionBar} bottomOverlay={bottomActionBar}>
      <View style={[styles.hero, isDark ? styles.heroDark : styles.heroLight]}>
        <Text style={[styles.heroLabel, isDark ? styles.heroLabelDark : styles.heroLabelLight]}>Estimated Arrival</Text>
        <Text style={[styles.heroValue, isDark ? styles.heroValueDark : styles.heroValueLight]}>{etaText}</Text>
        <Text style={[styles.heroSub, isDark ? styles.heroSubDark : styles.heroSubLight]}>to {profile?.stop?.name || 'your stop'}</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <StatTile label="Bus" value={profile?.bus?.name || 'N/A'} subtext={profile?.bus?.numberPlate} theme={theme} />
          <StatTile label="Your Stop" value={profile?.stop?.name || 'Unassigned'} subtext={`Stop #${profile?.stop?.seq ?? '—'}`} theme={theme} />
        </View>
        <View style={styles.gridRow}>
          <StatTile label="Status" value={trip ? 'Active' : 'Waiting'} subtext={trip ? 'Trip is ongoing' : 'No live trip yet'} theme={theme} />
          <StatTile label="College" value="P.I.E.T." subtext="Campus destination" theme={theme} />
        </View>
      </View>

      {trackedBus ? (
        <View style={styles.trackedInfoRow}>
          <Text style={styles.trackedInfoText}>Tracking: {trackedBus.name} | {trackedBus.numberPlate || 'No plate'}</Text>
          <Pressable onPress={() => setTrackedBus(null)} style={styles.trackedResetBtn}>
            <Text style={styles.trackedResetText}>Reset</Text>
          </Pressable>
        </View>
      ) : null}

      <StudentLiveMap
        busPosition={displayBusPosition}
        stopPosition={stopPosition}
        collegePosition={PIET_COLLEGE}
        theme={theme}
        busLabel={displayBusLabel}
      />

      <Pressable style={[styles.refresh, isDark ? styles.refreshDark : styles.refreshLight]} onPress={fetchData}>
        <Text style={styles.refreshText}>Refresh Live Data</Text>
      </Pressable>

      <View style={{ height: 92 }} />

      <Modal visible={showAttendanceModal} transparent animationType="fade" onRequestClose={() => setShowAttendanceModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.profileModal, isDark ? styles.profileModalDark : styles.profileModalLight]}>
            <Text style={[styles.profileTitle, isDark ? styles.profileTitleDark : styles.profileTitleLight]}>Attendance QR</Text>
            <Text style={[styles.profileLine, isDark ? styles.profileLineDark : styles.profileLineLight]}>
              Bus QR code scan ya enter karein. Assigned bus match hone par attendance mark hogi.
            </Text>
            <TextInput
              value={attendanceQrCode}
              onChangeText={setAttendanceQrCode}
              placeholder="Example: BUS:HR55AB1234"
              autoCapitalize="none"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
            <View style={styles.profileActions}>
              <Pressable style={styles.modalSaveBtn} onPress={markAttendance} disabled={attendanceLoading}>
                <Text style={styles.modalSaveBtnText}>{attendanceLoading ? 'Marking...' : 'Mark Attendance'}</Text>
              </Pressable>
              <Pressable style={styles.modalCloseBtn} onPress={() => setShowAttendanceModal(false)}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showTrackAnyBusModal} transparent animationType="fade" onRequestClose={() => setShowTrackAnyBusModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.profileModal, isDark ? styles.profileModalDark : styles.profileModalLight]}>
            <Text style={[styles.profileTitle, isDark ? styles.profileTitleDark : styles.profileTitleLight]}>Track Any Bus</Text>
            <Text style={[styles.profileLine, isDark ? styles.profileLineDark : styles.profileLineLight]}>
              Route + bus list me se select karo aur map us bus par shift ho jayega.
            </Text>

            {liveBusLoading ? (
              <ActivityIndicator color="#38bdf8" style={{ marginVertical: 14 }} />
            ) : liveBusList.length === 0 ? (
              <Text style={[styles.profileLine, isDark ? styles.profileLineDark : styles.profileLineLight]}>No buses available right now.</Text>
            ) : (
              <View style={styles.busListWrap}>
                {liveBusList.slice(0, 8).map((busItem) => (
                  <Pressable
                    key={busItem._id}
                    onPress={() => {
                      setTrackedBus(busItem);
                      setShowTrackAnyBusModal(false);
                      Alert.alert('Tracking', `Tracking ${busItem.name}`);
                    }}
                    style={[styles.busListItem, isDark ? styles.busListItemDark : styles.busListItemLight]}
                  >
                    <Text style={[styles.busTitle, isDark ? styles.profileTitleDark : styles.profileTitleLight]}>{busItem.name} | {busItem.numberPlate}</Text>
                    <Text style={[styles.busMeta, isDark ? styles.profileLineDark : styles.profileLineLight]}>
                      Route: {busItem.routeName} | {busItem.isLive ? 'Live' : 'Idle'}{busItem.isAssignedToMe ? ' | Assigned to you' : ''}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.profileActions}>
              <Pressable style={styles.modalSaveBtn} onPress={fetchLiveBuses}>
                <Text style={styles.modalSaveBtnText}>Refresh List</Text>
              </Pressable>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  setTrackedBus(null);
                  setShowTrackAnyBusModal(false);
                }}
              >
                <Text style={styles.modalCloseBtnText}>Back To My View</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={profileOpen} transparent animationType="fade" onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.profileModal, isDark ? styles.profileModalDark : styles.profileModalLight]}>
            <Text style={[styles.profileTitle, isDark ? styles.profileTitleDark : styles.profileTitleLight]}>Profile</Text>

            <Text style={[styles.readOnlyLine, isDark ? styles.profileLineDark : styles.profileLineLight]}>Username: {profile?.username || '—'}</Text>
            <Text style={[styles.readOnlyLine, isDark ? styles.profileLineDark : styles.profileLineLight]}>Role: {profile?.role || 'student'}</Text>
            <Text style={[styles.readOnlyLine, isDark ? styles.profileLineDark : styles.profileLineLight]}>Bus: {profile?.bus?.name || 'Not assigned'}</Text>
            <Text style={[styles.readOnlyLine, isDark ? styles.profileLineDark : styles.profileLineLight]}>Stop: {profile?.stop?.name || 'Not assigned'}</Text>

            <Text style={[styles.sectionLabel, isDark ? styles.profileLineDark : styles.profileLineLight]}>Edit Profile</Text>
            <TextInput
              value={profileForm.name}
              onChangeText={(value) => updateProfileField('name', value)}
              placeholder="Full name"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
            <TextInput
              value={profileForm.phone}
              onChangeText={(value) => updateProfileField('phone', value)}
              placeholder="Phone"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
            <TextInput
              value={profileForm.email}
              onChangeText={(value) => updateProfileField('email', value)}
              placeholder="Email"
              autoCapitalize="none"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
            <TextInput
              value={profileForm.photoUrl}
              onChangeText={(value) => updateProfileField('photoUrl', value)}
              placeholder="Photo URL (optional)"
              autoCapitalize="none"
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />

            <Text style={[styles.sectionLabel, isDark ? styles.profileLineDark : styles.profileLineLight]}>Change Password</Text>
            <TextInput
              value={profileForm.currentPassword}
              onChangeText={(value) => updateProfileField('currentPassword', value)}
              placeholder="Current password"
              secureTextEntry
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
            <TextInput
              value={profileForm.password}
              onChangeText={(value) => updateProfileField('password', value)}
              placeholder="New password"
              secureTextEntry
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />
            <TextInput
              value={profileForm.confirmPassword}
              onChangeText={(value) => updateProfileField('confirmPassword', value)}
              placeholder="Confirm new password"
              secureTextEntry
              placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
              style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
            />

            {profileError ? <Text style={styles.errorText}>{profileError}</Text> : null}
            {profileSuccess ? <Text style={styles.successText}>{profileSuccess}</Text> : null}

            <View style={styles.profileActions}>
              <Pressable style={styles.modalSaveBtn} onPress={handleSaveProfile} disabled={profileSaving}>
                <Text style={styles.modalSaveBtnText}>{profileSaving ? 'Saving...' : 'Save'}</Text>
              </Pressable>
              <Pressable style={styles.modalCloseBtn} onPress={() => setProfileOpen(false)}>
                <Text style={styles.modalCloseBtnText}>Close</Text>
              </Pressable>
              <Pressable
                style={styles.modalLogoutBtn}
                onPress={() => {
                  setProfileOpen(false);
                  logout();
                }}
              >
                <Text style={styles.modalLogoutBtnText}>Logout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
};

const styles = StyleSheet.create({
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topActionBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  topActionBtnDark: { backgroundColor: '#0f1b2d', borderColor: 'rgba(255,255,255,0.1)' },
  topActionBtnLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  topActionText: { fontSize: 12, fontWeight: '700' },
  topActionTextDark: { color: '#e2e8f0' },
  topActionTextLight: { color: '#0f172a' },
  logoutBtn: { backgroundColor: '#7f1d1d', borderColor: '#ef4444' },
  logoutBtnText: { color: '#fecaca', fontSize: 12, fontWeight: '800' },
  trackedInfoRow: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.4)',
    backgroundColor: 'rgba(56,189,248,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  trackedInfoText: { color: '#bae6fd', fontSize: 12, flex: 1 },
  trackedResetBtn: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(186,230,253,0.4)'
  },
  trackedResetText: { color: '#e0f2fe', fontSize: 11, fontWeight: '700' },
  hero: { borderRadius: 24, padding: 18, marginBottom: 16, borderWidth: 1 },
  heroDark: { backgroundColor: '#0f1b2d', borderColor: 'rgba(255,255,255,0.06)' },
  heroLight: { backgroundColor: '#ffffff', borderColor: '#dbeafe' },
  heroLabel: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.5 },
  heroLabelDark: { color: '#94a3b8' },
  heroLabelLight: { color: '#64748b' },
  heroValue: { fontSize: 34, fontWeight: '900', marginTop: 8 },
  heroValueDark: { color: 'white' },
  heroValueLight: { color: '#0f172a' },
  heroSub: { marginTop: 6 },
  heroSubDark: { color: '#cbd5e1' },
  heroSubLight: { color: '#334155' },
  grid: { gap: 12, marginBottom: 16 },
  gridRow: { flexDirection: 'row', gap: 12 },
  refresh: { marginTop: 16, borderRadius: 18, alignItems: 'center', paddingVertical: 14 },
  refreshDark: { backgroundColor: '#1d4ed8' },
  refreshLight: { backgroundColor: '#2563eb' },
  refreshText: { color: 'white', fontWeight: '800' },
  busListWrap: { marginTop: 12, gap: 8 },
  busListItem: { borderWidth: 1, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 10 },
  busListItemDark: { backgroundColor: '#101b31', borderColor: 'rgba(255,255,255,0.12)' },
  busListItemLight: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  busTitle: { fontWeight: '800', fontSize: 13 },
  busMeta: { fontSize: 12, marginTop: 3 },
  bottomActionsWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14
  },
  bottomActions: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch'
  },
  bottomActionsDark: { backgroundColor: 'rgba(3,7,18,0.92)', borderColor: 'rgba(148,163,184,0.25)' },
  bottomActionsLight: { backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#cbd5e1' },
  bottomActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.35)',
    borderRadius: 12,
    paddingVertical: 8,
    marginHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottomActionAccent: { backgroundColor: '#0284c7', borderColor: '#0284c7' },
  bottomActionIcon: { fontSize: 12, color: '#e2e8f0', marginBottom: 2 },
  bottomActionText: { fontSize: 10, fontWeight: '700', color: '#e2e8f0' },
  bottomActionAccentText: { color: 'white' }
  ,modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  profileModal: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    padding: 18
  },
  profileModalDark: { backgroundColor: '#0b1425', borderColor: 'rgba(255,255,255,0.1)' },
  profileModalLight: { backgroundColor: '#ffffff', borderColor: '#cbd5e1' },
  profileTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  profileTitleDark: { color: 'white' },
  profileTitleLight: { color: '#0f172a' },
  readOnlyLine: { fontSize: 13, marginTop: 4 },
  sectionLabel: { fontSize: 13, marginTop: 12, marginBottom: 6, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  inputDark: { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#101b31', color: '#e2e8f0' },
  inputLight: { borderColor: '#cbd5e1', backgroundColor: '#f8fafc', color: '#0f172a' },
  errorText: { color: '#fca5a5', marginTop: 10, fontSize: 12 },
  successText: { color: '#86efac', marginTop: 10, fontSize: 12 },
  profileLine: { fontSize: 14, marginTop: 6 },
  profileLineDark: { color: '#cbd5e1' },
  profileLineLight: { color: '#334155' },
  profileActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  modalSaveBtn: { backgroundColor: '#1d4ed8', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalSaveBtnText: { color: 'white', fontWeight: '800' },
  modalCloseBtn: { backgroundColor: '#334155', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalCloseBtnText: { color: 'white', fontWeight: '700' },
  modalLogoutBtn: { backgroundColor: '#b91c1c', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalLogoutBtnText: { color: '#fee2e2', fontWeight: '800' }
});

export default StudentDashboardScreen;
