import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import { confirmPasswordReset, requestPasswordReset } from '../services/api';
import './Login.css';

export default function Login() {
  const { login, register } = useAuth();
  const toast = useToast();
  const { t, language } = useI18n();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('demo@spendly.local');
  const [password, setPassword] = useState('demo1234');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [issuedToken, setIssuedToken] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        toast.success(language === 'en' ? 'Logged in.' : 'Sesión iniciada.');
      } else if (mode === 'register') {
        await register(email, password);
        toast.success(language === 'en' ? 'Account created.' : 'Cuenta creada.');
      } else if (mode === 'reset-request') {
        const data = await requestPasswordReset({ email });
        setIssuedToken(data.reset_token || '');
        toast.success(language === 'en' ? 'Reset token generated.' : 'Token de reseteo generado.');
      } else if (mode === 'reset-confirm') {
        await confirmPasswordReset({ email, token: resetToken, new_password: resetNewPassword });
        toast.success(language === 'en' ? 'Password reset complete.' : 'Reseteo completado.');
        setMode('login');
      }
    } catch (err) {
      setError(err.response?.data?.error || (language === 'en' ? 'Could not process request' : 'No se pudo procesar la solicitud'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card card">
        <h1>💸 Spendly</h1>
        <p>{t('loginTitle')}</p>
        <form onSubmit={submit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {(mode === 'login' || mode === 'register') && (
            <div className="form-group">
              <label>{language === 'en' ? 'Password' : 'Contraseña'}</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
          )}
          {mode === 'reset-confirm' && (
            <>
              <div className="form-group">
                <label>{t('resetToken')}</label>
                <input value={resetToken} onChange={(e) => setResetToken(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>{t('newPassword')}</label>
                <input type="password" value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} minLength={6} required />
              </div>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          {issuedToken && (
            <p className="form-error" style={{ color: 'var(--success)' }}>
              {language === 'en' ? 'Use this token:' : 'Usa este token:'} <strong>{issuedToken}</strong>
            </p>
          )}
          <button className="btn btn-primary login-submit" type="submit" disabled={loading}>
            {loading
              ? t('processing')
              : mode === 'login'
                ? t('login')
                : mode === 'register'
                  ? t('register')
                  : mode === 'reset-request'
                    ? t('requestToken')
                    : t('applyReset')}
          </button>
        </form>
        <div className="login-links">
          <button className="btn btn-ghost login-switch" type="button" onClick={() => setMode((prev) => (prev === 'login' ? 'register' : 'login'))}>
            {mode === 'login' ? t('noAccount') : t('hasAccount')}
          </button>
          <button className="btn btn-ghost login-switch" type="button" onClick={() => setMode('reset-request')}>
            {t('requestToken')}
          </button>
          <button className="btn btn-ghost login-switch" type="button" onClick={() => setMode('reset-confirm')}>
            {t('applyReset')}
          </button>
        </div>
      </div>
    </div>
  );
}
