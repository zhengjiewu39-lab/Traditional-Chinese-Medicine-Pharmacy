import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3002/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 拦截请求添加认证令牌
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 销售数据相关API
export const salesApi = {
  getSalesData: (timeRange) => api.get(`/sales?timeRange=${timeRange}`),
  getSalesStats: () => api.get('/sales/stats'),
  getSalesTrends: () => api.get('/sales/trends'),
};

// 库存数据相关API
export const inventoryApi = {
  getAllInventory: (params) => api.get('/inventory', { params }),
  getInventoryStats: () => api.get('/inventory/stats'),
  getInventoryItem: (id) => api.get(`/inventory/${id}`),
  createInventory: (data) => api.post('/inventory', data),
  updateInventory: (id, inventoryData) => api.put(`/inventory/${id}`, inventoryData),
  addStock: (id, stockData) => api.post(`/inventory/${id}/add`, stockData),
  reduceStock: (id, stockData) => api.post(`/inventory/${id}/reduce`, stockData),
  getInventoryHistory: (id, params) => api.get(`/inventory/${id}/history`, { params }),
  getStockAlerts: () => api.get('/inventory/alerts'),
};

// 客户数据相关API
export const customerApi = {
  getCustomerData: () => api.get('/customers'),
  getCustomerStats: () => api.get('/customers/stats'),
  getCustomerGrowth: () => api.get('/customers/growth'),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (id, data) => api.put(`/customers/${id}`, data),
};

// 订单相关API
export const ordersApi = {
  getOrders: (params) => api.get('/orders', { params }),
  getOrder: (id) => api.get(`/orders/${id}`),
  createOrder: (data) => api.post('/orders', data),
  updateOrder: (id, data) => api.put(`/orders/${id}`, data),
  deleteOrder: (id) => api.delete(`/orders/${id}`),
};

// 收银台 API
export const billingApi = {
  checkout: (data) => api.post('/billing/checkout', data),
  getBills: () => api.get('/billing'),
};

// 仪表盘 API
export const dashboardApi = {
  getOverview: () => api.get('/dashboard/overview'),
  globalSearch: (q) => api.get('/dashboard/search', { params: { q } }),
};

// 药品类别相关API
export const categoryApi = {
  getCategories: () => api.get('/categories'),
  getCategoryStats: () => api.get('/categories/stats'),
};

// 认证相关API
export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  getCurrentUser: () => api.get('/auth/me'),
  updateProfile: (userData) => api.put('/auth/profile', userData),
  changePassword: (passwordData) => api.post('/auth/change-password', passwordData),
};

// 药材管理相关API
export const herbsApi = {
  getAllHerbs: (params) => api.get('/herbs', { params }),
  getHerbById: (id) => api.get(`/herbs/${id}`),
  createHerb: (herbData) => api.post('/herbs', herbData),
  updateHerb: (id, herbData) => api.put(`/herbs/${id}`, herbData),
  deleteHerb: (id) => api.delete(`/herbs/${id}`),
  searchHerbs: (query) => api.get('/herbs/search', { params: { query } }),
};

// 处方相关API
export const prescriptionApi = {
  // 处方审理
  analyzePrescription: (prescriptionData) => api.post('/prescriptions/analyze', prescriptionData),
  analyzePrescriptionFile: (formData) => api.post('/prescriptions/analyze/file', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  
  // 处方记录
  getAllPrescriptions: (params) => api.get('/prescriptions', { params }),
  getPrescriptionById: (id) => api.get(`/prescriptions/${id}`),
  createPrescription: (prescriptionData) => api.post('/prescriptions', prescriptionData),
  updatePrescription: (id, prescriptionData) => api.put(`/prescriptions/${id}`, prescriptionData),
  deletePrescription: (id) => api.delete(`/prescriptions/${id}`),
  approvePrescription: (id, data) => api.post(`/prescriptions/${id}/approve`, data),
  dispensePrescription: (id, data) => api.post(`/prescriptions/${id}/dispense`, data),
  markReady: (id, data) => api.post(`/prescriptions/${id}/ready`, data),
  getBillingPrefill: (id) => api.get(`/prescriptions/${id}/billing-prefill`),
  getPickupByCode: (code) => api.get(`/prescriptions/pickup/${code}`),
  getPickupQueue: () => api.get('/prescriptions/pickup/queue'),
  
  // 处方模板
  getTemplates: (params) => api.get('/prescription-templates', { params }),
  getTemplateById: (id) => api.get(`/prescription-templates/${id}`),
  createTemplate: (templateData) => api.post('/prescription-templates', templateData),
  updateTemplate: (id, templateData) => api.put(`/prescription-templates/${id}`, templateData),
  deleteTemplate: (id) => api.delete(`/prescription-templates/${id}`),
  
  // 处方统计分析
  getPrescriptionTrends: (params) => api.get('/analytics/prescription-trends', { params }),
  getHerbUsageStats: (params) => api.get('/analytics/herb-usage', { params }),
  getDiagnosisStats: (params) => api.get('/analytics/diagnosis', { params }),
  getTopTemplates: (params) => api.get('/analytics/top-templates', { params }),
};

// 数据导出相关API
export const exportApi = {
  exportSalesData: (timeRange) => api.get(`/export/sales?timeRange=${timeRange}`, { responseType: 'blob' }),
  exportInventoryData: () => api.get('/export/inventory', { responseType: 'blob' }),
  exportCustomerData: () => api.get('/export/customers', { responseType: 'blob' }),
};

// 患者管理相关API
export const patientsApi = {
  getAllPatients: (params) => api.get('/patients', { params }),
  getPatientById: (id) => api.get(`/patients/${id}`),
  createPatient: (patientData) => api.post('/patients', patientData),
  updatePatient: (id, patientData) => api.put(`/patients/${id}`, patientData),
  deletePatient: (id) => api.delete(`/patients/${id}`),
  getPatientPrescriptions: (id, params) => api.get(`/patients/${id}/prescriptions`, { params }),
};

export default api; 