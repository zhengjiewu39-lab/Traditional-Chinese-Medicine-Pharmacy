import axios from 'axios';
import { getApiBaseUrl } from './apiBase';

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
      if (error.response?.status === 401) {
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

function errorMessages(lang) {
  const zh = {
    timeout: 'API 请求超时：请确认后端已启动 (cd chinese-medicine-pharmacy && npm run server)',
    down: '无法连接 API (端口 3002)。请运行: npm run server 或 npm run dev',
    failed: '请求失败',
  };
  const en = {
    timeout: 'API request timed out. Start backend: npm run server (port 3002).',
    down: 'Cannot reach API (port 3002). Run: npm run server or npm run dev',
    failed: 'Request failed',
  };
  return lang === 'en' ? en : zh;
}

export function formatApiError(error, fallback) {
  const lang = localStorage.getItem('app_lang') === 'en' ? 'en' : 'zh';
  const msg = errorMessages(lang);
  if (error.code === 'ECONNABORTED') return msg.timeout;
  if (!error.response) return msg.down;
  return error.response?.data?.error?.message || error.response?.data?.message || error.message || fallback || msg.failed;
}
