import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, login as apiLogin, register as apiRegister, setAuthToken, updatePreferences as apiUpdatePreferences } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('spendly-token') || '');
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('spendly-user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loadingProfile, setLoadingProfile] = useState(Boolean(token));

  const saveSession = (nextToken, nextUser) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem('spendly-user', JSON.stringify(nextUser));
  };

  const login = async (email, password) => {
    const data = await apiLogin({ email, password });
    saveSession(data.token, data.user);
    return data.user;
  };

  const register = async (email, password) => {
    const data = await apiRegister({ email, password });
    saveSession(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    setAuthToken(null);
    setToken('');
    setUser(null);
    setLoadingProfile(false);
    localStorage.removeItem('spendly-user');
  };

  const updatePreferences = async (data) => {
    const nextUser = await apiUpdatePreferences(data);
    setUser(nextUser);
    localStorage.setItem('spendly-user', JSON.stringify(nextUser));
    return nextUser;
  };

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    setLoadingProfile(true);
    getMe()
      .then((profile) => {
        if (!mounted) return;
        setUser(profile);
        localStorage.setItem('spendly-user', JSON.stringify(profile));
      })
      .catch(() => {
        if (!mounted) return;
        setAuthToken(null);
        setToken('');
        setUser(null);
        localStorage.removeItem('spendly-user');
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingProfile(false);
      });
    return () => { mounted = false; };
  }, [token]);

  const value = useMemo(() => ({
    token,
    user,
    isAuthenticated: Boolean(token),
    loadingProfile,
    login,
    register,
    updatePreferences,
    logout,
  }), [token, user, loadingProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
