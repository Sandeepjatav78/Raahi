import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

const LoginScreen = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach backend. Check API URL, backend server, and same Wi-Fi.');
      } else {
        setError(err.response?.data?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.brand}>Raahi</Text>
      <Text style={styles.heading}>School bus tracking</Text>
      <Text style={styles.subheading}>Sign in to continue</Text>

      <View style={styles.card}>
        <TextInput placeholder="Username" placeholderTextColor="#64748b" autoCapitalize="none" value={username} onChangeText={setUsername} style={styles.input} />
        <TextInput placeholder="Password" placeholderTextColor="#64748b" secureTextEntry value={password} onChangeText={setPassword} style={styles.input} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Login</Text>}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#07111f', justifyContent: 'center', padding: 20 },
  brand: { color: '#38bdf8', fontSize: 14, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '700' },
  heading: { color: 'white', fontSize: 34, fontWeight: '900', marginTop: 10 },
  subheading: { color: '#94a3b8', marginTop: 8, marginBottom: 22 },
  card: { backgroundColor: '#0f1b2d', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  input: { backgroundColor: '#132238', color: 'white', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12 },
  button: { backgroundColor: '#2563eb', borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 4 },
  buttonText: { color: 'white', fontWeight: '800', fontSize: 16 },
  error: { color: '#fca5a5', marginBottom: 10 }
});

export default LoginScreen;
