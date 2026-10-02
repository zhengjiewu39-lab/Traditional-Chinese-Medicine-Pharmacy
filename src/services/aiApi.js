import { createApiClient, attachAuthInterceptors } from '../config/httpClient';

const api = attachAuthInterceptors(createApiClient());
const publicApi = createApiClient();

export const aiCasesApi = {
  list: (params) => api.get('/ai/cases', { params }),
  get: (id) => api.get(`/ai/cases/${id}`),
  create: (body) => api.post('/ai/cases', body),
  update: (id, body) => api.patch(`/ai/cases/${id}`, body),
  analyze: (id) => api.post(`/ai/cases/${id}/analyze`, {}),
  decide: (id, body) => api.post(`/ai/cases/${id}/pharmacist-decision`, body),
  requestInformation: (id, body) => api.post(`/ai/cases/${id}/request-information`, body),
  issuePatientConfirmation: (id) => api.post(`/ai/cases/${id}/patient-confirmation`, {}),
  dispensing: (id, body) => api.post(`/ai/cases/${id}/dispensing`, body),
  audit: (id) => api.get(`/ai/cases/${id}/audit`),
  replay: (id, analysisId) => api.post(`/ai/cases/${id}/replay`, analysisId ? { analysisId } : {}),
  workbench: () => api.get('/ai/workbench/summary'),
  reviewQueue: () => api.get('/ai/review-queue'),
};

export const aiDraftsApi = {
  create: (body) => api.post('/ai/drafts', body),
  list: () => api.get('/ai/drafts'),
  get: (id) => api.get(`/ai/drafts/${id}`),
  patch: (id, body) => api.patch(`/ai/drafts/${id}`, body),
  analyze: (id) => api.post(`/ai/drafts/${id}/analyze`, {}),
  suggestions: (id) => api.get(`/ai/drafts/${id}/suggestions`),
  dispose: (id, suggestionId, body) => api.post(`/ai/drafts/${id}/suggestions/${suggestionId}/disposition`, body),
  submit: (id) => api.post(`/ai/drafts/${id}/submit`, {}),
};

export const aiGovernanceApi = {
  models: () => api.get('/ai/models'),
  knowledge: () => api.get('/ai/knowledge/sources'),
  metrics: () => api.get('/ai/governance/metrics'),
  killSwitch: (enabled, reason) => api.post('/ai/governance/kill-switch', { enabled, reason }),
  sample: (rate, seed) => api.post('/ai/governance/sampling', {
    ...(rate != null ? { rate } : {}),
    ...(seed ? { seed } : {}),
  }),
  learningExport: () => api.post('/ai/learning/export', {}),
  learningModels: () => api.get('/ai/learning/models'),
  shadowComplete: (id, body) => api.post(`/ai/learning/models/${id}/shadow-complete`, body),
  promoteLive: (body) => api.post('/ai/runtime/promote-live', body),
  runtime: () => api.get('/ai/runtime'),
  saveProvider: (body) => api.post('/ai/runtime/provider', body, { timeout: 90000 }),
  testProvider: () => api.post('/ai/runtime/test', {}, { timeout: 90000 }),
};

export const aiFollowUpApi = {
  list: () => api.get('/ai/follow-ups'),
  act: (caseId, taskId, body) => api.post(`/ai/cases/${caseId}/follow-ups/${taskId}`, body),
};

export const researchEvalApi = {
  home: () => api.get('/research/evaluation'),
};

/** Token links are public; no session header is attached. */
export const patientPortalApi = {
  getConfirmation: (token) => publicApi.get(`/patient/confirmation/${token}`),
  submitConfirmation: (token, body) => publicApi.post(`/patient/confirmation/${token}`, body),
  submitFeedback: (token, body) => publicApi.post(`/patient/feedback/${token}`, body),
  getClarification: (token) => publicApi.get(`/patient/clarification/${token}`),
  submitClarification: (token, body) => publicApi.post(`/patient/clarification/${token}`, body),
  myCases: () => api.get('/patient/me/cases'),
  myProfile: () => api.get('/patient/me/profile'),
};

export const pickupApi = {
  redeem: (token) => publicApi.post('/pickup/redeem', { token }),
};
