import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import StudentDashboardScreen from '../screens/StudentDashboardScreen';
import DriverDashboardScreen from '../screens/DriverDashboardScreen';

const Stack = createNativeStackNavigator();

const LoadingScreen = () => (
  <View style={{ flex: 1, backgroundColor: '#07111f', alignItems: 'center', justifyContent: 'center' }}>
    <ActivityIndicator color="#38bdf8" />
    <Text style={{ color: 'white', marginTop: 12 }}>Loading Raahi...</Text>
  </View>
);

const UnsupportedMobileRoleScreen = ({ role, onLogout }) => (
  <View style={{ flex: 1, backgroundColor: '#07111f', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
    <Text style={{ color: '#38bdf8', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' }}>Raahi Mobile</Text>
    <Text style={{ color: 'white', fontSize: 28, marginTop: 8, fontWeight: '900' }}>Student App</Text>
    <Text style={{ color: '#94a3b8', marginTop: 14, textAlign: 'center', lineHeight: 22 }}>
      Mobile app abhi sirf student panel ke liye enabled hai. {role} panel ke liye web dashboard use karein.
    </Text>
    <Pressable
      style={{ marginTop: 22, backgroundColor: '#1d4ed8', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }}
      onPress={onLogout}
    >
      <Text style={{ color: 'white', fontWeight: '800' }}>Logout</Text>
    </Pressable>
  </View>
);

const AppNavigator = () => {
  const { user, loading, logout } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen
          name="Home"
          component={() =>
            user.role === 'student'
              ? <StudentDashboardScreen />
              : user.role === 'driver'
                ? <DriverDashboardScreen />
                : <UnsupportedMobileRoleScreen role={user.role} onLogout={logout} />
          }
        />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;
