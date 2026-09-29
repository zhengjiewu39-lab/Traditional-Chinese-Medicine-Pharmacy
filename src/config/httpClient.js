import axios from 'axios';
import { getApiBaseUrl } from './apiBase';
import { currentLang, translate, isChineseText } from '../i18n/lookup';

/** Shared axios instance — timeout prevents infinite loading when API is down. */
export function createApiClient() {
  return axios.create({
    baseURL: getApiBaseUrl(),
    timeout: Number(process.env.REACT_APP_API_TIMEOUT_MS || 12000),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function attachAuthInterceptors(client) {
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = String(error.config?.url || '');
      const configuringAi = url.includes('/ai/runtime/');
      if (error.response?.status === 401 && !configuringAi) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
  return client;
}

export function formatApiError(error, fallback) {
  const lang = currentLang();
  if (error.code === 'ECONNABORTED') return translate(lang, 'errors.apiTimeout');
  if (!error.response) return translate(lang, 'errors.apiDown');
  const code = error.response?.data?.error?.code;
  if (code) {
    const keyed = translate(lang, `errors.codes.${code}`);
    if (keyed !== `errors.codes.${code}`) return keyed;
  }
  const serverMsg = error.response?.data?.error?.message || error.response?.data?.message;
  if (lang === 'en' && isChineseText(serverMsg)) {
    return code ? `${translate(lang, 'errors.requestFailed')} (${code})` : translate(lang, 'errors.requestFailed');
  }
  return serverMsg || error.message || fallback || translate(lang, 'errors.requestFailed');
}
