import { createContext, useContext, useMemo, useState } from 'react';

const translations = {
  es: {
    navDashboard: 'Dashboard',
    navExpenses: 'Gastos',
    navCategories: 'Categorías',
    navSettings: 'Ajustes',
    logout: 'Cerrar sesión',
    settingsTitle: 'Ajustes de la app',
    settingsSubtitle: 'Configura idioma y tema visual.',
    settingsLanguage: 'Idioma',
    settingsTheme: 'Tema',
    settingsCurrency: 'Moneda',
    profileTitle: 'Perfil del usuario',
    usernameLabel: 'Usuario',
    memberSince: 'Miembro desde',
    changePasswordTitle: 'Cambiar contraseña',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    resetPasswordTitle: 'Restablecer contraseña',
    resetToken: 'Token de reseteo',
    requestToken: 'Solicitar token',
    applyReset: 'Aplicar reseteo',
    recurringTitle: 'Gastos recurrentes',
    frequencyWeekly: 'Semanal',
    frequencyMonthly: 'Mensual',
    startDate: 'Fecha de inicio',
    noRecurring: 'No hay gastos recurrentes',
    savingsGoalTitle: 'Meta de ahorro mensual',
    goalTarget: 'Meta del mes',
    goalProgress: 'Progreso de la meta',
    importCsv: 'Importar CSV',
    langEs: 'Español',
    langEn: 'Inglés',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    save: 'Guardar',
    cancel: 'Cancelar',
    processing: 'Procesando…',
    loginTitle: 'Gestiona tus gastos con tu propia cuenta.',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    noAccount: '¿No tienes cuenta? Regístrate',
    hasAccount: '¿Ya tienes cuenta? Inicia sesión',
  },
  en: {
    navDashboard: 'Dashboard',
    navExpenses: 'Expenses',
    navCategories: 'Categories',
    navSettings: 'Settings',
    logout: 'Logout',
    settingsTitle: 'App settings',
    settingsSubtitle: 'Configure language and visual theme.',
    settingsLanguage: 'Language',
    settingsTheme: 'Theme',
    settingsCurrency: 'Currency',
    profileTitle: 'User profile',
    usernameLabel: 'Username',
    memberSince: 'Member since',
    changePasswordTitle: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    resetPasswordTitle: 'Reset password',
    resetToken: 'Reset token',
    requestToken: 'Request token',
    applyReset: 'Apply reset',
    recurringTitle: 'Recurring expenses',
    frequencyWeekly: 'Weekly',
    frequencyMonthly: 'Monthly',
    startDate: 'Start date',
    noRecurring: 'No recurring expenses',
    savingsGoalTitle: 'Monthly savings goal',
    goalTarget: 'Month target',
    goalProgress: 'Goal progress',
    importCsv: 'Import CSV',
    langEs: 'Spanish',
    langEn: 'English',
    themeDark: 'Dark',
    themeLight: 'Light',
    save: 'Save',
    cancel: 'Cancel',
    processing: 'Processing…',
    loginTitle: 'Track your expenses with your own account.',
    login: 'Login',
    register: 'Create account',
    noAccount: "Don't have an account? Register",
    hasAccount: 'Already have an account? Login',
  },
};

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => localStorage.getItem('spendly-language') || 'es');

  const setLang = (next) => {
    const normalized = next === 'en' ? 'en' : 'es';
    setLanguage(normalized);
    localStorage.setItem('spendly-language', normalized);
  };

  const t = (key) => translations[language]?.[key] || translations.es[key] || key;
  const locale = language === 'en' ? 'en-US' : 'es-ES';

  const value = useMemo(() => ({ language, setLanguage: setLang, t, locale }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
