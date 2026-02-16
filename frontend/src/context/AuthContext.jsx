import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAuthToken } from '../utils/api';
import { disconnectSocket, refreshSocketAuth } from '../hooks/useSocket';

const TOKEN_KEY = 'tm_token';
const USER_KEY = 'tm_user';

export const AuthContext = createContext({});

const roleRedirect = {
  admin: '/admin',
  driver: '/driver',
  student: '/student'
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuthToken(null);
    setUser(null);
    setToken(null);
    disconnectSocket();
  }, []);

  const persistSession = useCallback((nextToken, nextUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    refreshSocketAuth();
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (!savedToken) {
      setLoading(false);
      return;
    }

    setAuthToken(savedToken);
    setToken(savedToken);

    if (savedUser) {
      setUser(JSON.parse(savedUser));
      refreshSocketAuth();
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((res) => {
        localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        setUser(res.data);
        refreshSocketAuth();
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(
    async ({ username, password }) => {
      const { data } = await api.post('/auth/login', { username, password });
      persistSession(data.token, data.user);
      // Redirect to profile on first login so user changes default password
      const destination = data.user.firstLogin
        ? '/profile'
        : (roleRedirect[data.user.role] || '/login');
      navigate(destination, { replace: true });
      return data.user;
    },
    [navigate, persistSession]
  );

  const logout = useCallback(() => {
    clearSession();
    navigate('/login', { replace: true });
  }, [clearSession, navigate]);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, setUser }),
    [loading, login, logout, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
