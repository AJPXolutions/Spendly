import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { changePassword } from '../services/api';
import './Settings.css';

const CURRENCIES = ['USD', 'EUR', 'COP', 'MXN'];

export default function Settings() {
  const { theme, setThemeMode } = useApp();
  const { user, logout, updatePreferences } = useAuth();
  const { language, setLanguage, t, locale } = useI18n();
  const toast = useToast();
  const [nextTheme, setNextTheme] = useState(theme);
  const [nextLanguage, setNextLanguage] = useState(language);
  const [nextCurrency, setNextCurrency] = useState(user?.currency || 'USD');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const username = user?.email ? user.email.split('@')[0] : '-';

  const saveSettings = async () => {
    setThemeMode(nextTheme);
    setLanguage(nextLanguage);
    await updatePreferences({ currency: nextCurrency });
    toast.success(nextLanguage === 'en' ? 'Settings updated.' : 'Ajustes guardados.');
  };

  const submitPassword = async () => {
    setPasswordLoading(true);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success(language === 'en' ? 'Password updated.' : 'Contraseña actualizada.');
    } catch (error) {
      toast.error(error.response?.data?.error || (language === 'en' ? 'Could not update password' : 'No se pudo actualizar la contraseña'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>{t('settingsTitle')}</h1>
      </div>
      <p className="settings-subtitle">{t('settingsSubtitle')}</p>

      <div className="card settings-card">
        <div className="form-group">
          <label>{t('profileTitle')}</label>
          <div className="profile-box">
            <div><strong>{t('usernameLabel')}:</strong> {username}</div>
            {user?.created_at && <div><strong>{t('memberSince')}:</strong> {new Date(user.created_at).toLocaleDateString(locale)}</div>}
          </div>
        </div>

        <div className="form-group">
          <label>{t('settingsLanguage')}</label>
          <select value={nextLanguage} onChange={(e) => setNextLanguage(e.target.value)}>
            <option value="es">{t('langEs')}</option>
            <option value="en">{t('langEn')}</option>
          </select>
        </div>

        <div className="form-group">
          <label>{t('settingsTheme')}</label>
          <select value={nextTheme} onChange={(e) => setNextTheme(e.target.value)}>
            <option value="dark">{t('themeDark')}</option>
            <option value="light">{t('themeLight')}</option>
          </select>
        </div>

        <div className="form-group">
          <label>{t('settingsCurrency')}</label>
          <select value={nextCurrency} onChange={(e) => setNextCurrency(e.target.value)}>
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>{t('changePasswordTitle')}</label>
          <input
            type="password"
            placeholder={t('currentPassword')}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder={t('newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ marginTop: '0.45rem' }}
          />
          <button
            className="btn btn-ghost"
            style={{ marginTop: '0.55rem' }}
            onClick={submitPassword}
            disabled={passwordLoading || !currentPassword || !newPassword}
          >
            {passwordLoading ? t('processing') : t('changePasswordTitle')}
          </button>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveSettings}>{t('save')}</button>
          <button className="btn btn-danger-solid" onClick={logout}>{t('logout')}</button>
        </div>
      </div>
    </div>
  );
}
