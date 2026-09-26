/**
 * API base URL for axios. Prefer explicit backend in dev to avoid CRA proxy misconfiguration.
 */
export function getApiBaseUrl() {
  const fromEnv = process.env.REACT_APP_API_BASE_URL;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3002/api';
  }
  return '/api';
}
