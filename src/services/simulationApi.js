import { getApiBaseUrl } from '../config/apiBase';
import { createApiClient, attachAuthInterceptors } from '../config/httpClient';

const baseURL = `${getApiBaseUrl()}/simulation`;

const client = attachAuthInterceptors(createApiClient());
client.defaults.baseURL = baseURL;

export const simulationApi = {
  getMeta: () => client.get('/meta'),
  getDefaultScenario: () => client.get('/scenario/default'),
  validateScenario: async (scenario) => {
    try {
      return await client.post('/scenario/validate', scenario);
    } catch (e) {
      if (e.response?.data) return { data: e.response.data };
      throw e;
    }
  },
  getPolicies: () => client.get('/policies'),
  listExperiments: () => client.get('/experiments'),
  getExperiment: (id) => client.get(`/experiments/${id}`),
  run: (body) => client.post('/run', body),
  runGroup: (body) => client.post('/run-group', body),
  getExperimentGroup: (groupId) => client.get(`/experiment-groups/${groupId}`),
  listPresets: () => client.get('/scenario/presets'),
  getPreset: (key) => client.get(`/scenario/presets/${key}`),
  getGroupAnalysis: (groupId) => client.get(`/experiment-groups/${groupId}/analysis`),
  rerunExact: (id) => client.post(`/experiments/${id}/rerun-exact`),
  getJob: (jobId) => client.get(`/jobs/${jobId}`),
  cancelJob: (jobId) => client.post(`/jobs/${jobId}/cancel`),
  exportCsvUrl: (id) => `${baseURL}/experiments/${id}/export.csv`,
  exportJsonUrl: (id) => `${baseURL}/experiments/${id}/export.json`,
  reportMdUrl: (id) => `${baseURL}/experiments/${id}/report.md`,
  async downloadExperimentFile(id, kind) {
    const path = kind === 'csv'
      ? `/experiments/${id}/export.csv`
      : kind === 'json'
        ? `/experiments/${id}/export.json`
        : `/experiments/${id}/report.md`;
    const res = await client.get(path, { responseType: 'blob' });
    const ext = kind === 'md' ? 'md' : kind;
    const blob = new Blob([res.data], { type: res.headers['content-type'] || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${id}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

/** Shared scenario draft in sessionStorage for cross-page workflow */
const SCENARIO_KEY = 'simulation_scenario_draft';
const POLICIES_KEY = 'simulation_selected_policies';

export function loadScenarioDraft() {
  try {
    const raw = sessionStorage.getItem(SCENARIO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveScenarioDraft(scenario) {
  sessionStorage.setItem(SCENARIO_KEY, JSON.stringify(scenario));
}

export function loadSelectedPolicies() {
  try {
    const raw = sessionStorage.getItem(POLICIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSelectedPolicies(ids) {
  sessionStorage.setItem(POLICIES_KEY, JSON.stringify(ids));
}
