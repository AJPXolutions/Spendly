import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider } from './context/I18nContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { setApiToast } from './services/api';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Categories from './pages/Categories';
import Settings from './pages/Settings';
import Login from './pages/Login';

function ApiToastBridge() {
  const toast = useToast();
  useEffect(() => { setApiToast(toast); }, [toast]);
  return null;
}

function AuthedApp() {
  const { isAuthenticated, loadingProfile } = useAuth();
  if (loadingProfile) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  if (!isAuthenticated) return <Login />;

  return (
    <AppProvider>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AppProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <I18nProvider>
          <AuthProvider>
            <ApiToastBridge />
            <AuthedApp />
          </AuthProvider>
        </I18nProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
