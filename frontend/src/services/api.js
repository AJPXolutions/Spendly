import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

const api = axios.create({ baseURL: API_BASE_URL });
let _authToken = localStorage.getItem('spendly-token');

export const setAuthToken = (token) => {
  _authToken = token || null;
  if (token) {
    localStorage.setItem('spendly-token', token);
  } else {
    localStorage.removeItem('spendly-token');
  }
};

// Inject toast globally so interceptor can use it without React hooks
let _toastFn = null;
export const setApiToast = (toast) => { _toastFn = toast; };

api.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const skipToast = err.config?.skipGlobalErrorToast;
    const shouldShowGlobalToast = !skipToast && (!status || status >= 500);

    if (_toastFn && shouldShowGlobalToast) {
      if (!status) {
        _toastFn.error('No se pudo conectar con el servidor. ¿Está el backend corriendo?');
      } else {
        const msg = err.response.data?.error || `Error ${status}`;
        _toastFn.error(msg);
      }
    }
    return Promise.reject(err);
  }
);

export const getCategories = () => api.get('/categories').then(r => r.data);
export const createCategory = (data) => api.post('/categories', data).then(r => r.data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data).then(r => r.data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

export const getExpenses = (params) => api.get('/expenses', { params }).then(r => r.data);
export const getSummary = (params) => api.get('/expenses/summary', { params }).then(r => r.data);
export const createExpense = (data) => api.post('/expenses', data).then(r => r.data);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data).then(r => r.data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);

export const login = (data) => api.post('/auth/login', data).then((r) => r.data);
export const register = (data) => api.post('/auth/register', data).then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data.user);
export const updatePreferences = (data) => api.patch('/auth/preferences', data).then((r) => r.data.user);
export const changePassword = (data) => api.post('/auth/change-password', data).then((r) => r.data);
export const requestPasswordReset = (data) => api.post('/auth/reset-password/request', data).then((r) => r.data);
export const confirmPasswordReset = (data) => api.post('/auth/reset-password/confirm', data).then((r) => r.data);
export const getRecurringExpenses = () => api.get('/expenses/recurring').then((r) => r.data);
export const createRecurringExpense = (data) => api.post('/expenses/recurring', data).then((r) => r.data);
export const deleteRecurringExpense = (id) => api.delete(`/expenses/recurring/${id}`);
export const setSavingsGoal = (data) => api.put('/expenses/goal', data).then((r) => r.data.goal);
export const importExpenses = (rows) => api.post('/expenses/import', { rows }).then((r) => r.data);
