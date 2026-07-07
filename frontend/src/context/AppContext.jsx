import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCategories } from '../services/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('spendly-theme') || 'dark');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());

  const refreshCategories = useCallback(async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (e) {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    refreshCategories().finally(() => setLoading(false));
  }, [refreshCategories]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spendly-theme', theme);
  }, [theme]);

  const setThemeMode = (nextTheme) => {
    setTheme(nextTheme === 'light' ? 'light' : 'dark');
  };

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <AppContext.Provider value={{
      categories, refreshCategories,
      selectedMonth, setSelectedMonth,
      selectedYear, setSelectedYear,
      theme, toggleTheme, setThemeMode,
      loading,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
