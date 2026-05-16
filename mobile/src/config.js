import Constants from 'expo-constants';

const resolveExpoHost = () => {
	const hostUri =
		Constants.expoConfig?.hostUri ||
		Constants.expoGoConfig?.debuggerHost ||
		Constants.manifest?.debuggerHost ||
		'';

	if (!hostUri || typeof hostUri !== 'string') return null;
	return hostUri.split(':')[0] || null;
};

const fallbackHost = resolveExpoHost() || '10.0.2.2';

export const API_ROOT = process.env.EXPO_PUBLIC_API_ROOT || `http://${fallbackHost}:5000/api`;
export const SOCKET_ROOT = process.env.EXPO_PUBLIC_SOCKET_ROOT || `http://${fallbackHost}:5000`;
