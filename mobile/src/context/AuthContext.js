import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { storage } from '../services/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([storage.getToken(), storage.getUser()]);
        if (storedToken) {
          setToken(storedToken);
          if (storedUser) setUser(storedUser);
          const { data } = await api.get('/auth/me');
          setUser(data);
          await storage.setUser(data);
        }
      } catch (_error) {
        await storage.clear();
      } finally {
        setLoading(false);
      }
    };

    restore();
  }, []);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    await storage.setToken(data.token);
    await storage.setUser(data.user);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await storage.clear();
    setToken(null);
    setUser(null);
  };

  const value = useMemo(() => ({ user, token, loading, login, logout }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
