/**
 * api.js — Centralized API service layer
 * All frontend modules import from this file.
 * Handles: auth headers, 401 redirect, error normalization.
 */

const API_BASE = 'http://localhost:3000/api';

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getToken()  { return localStorage.getItem('rdmsToken'); }
function getUser()   { return JSON.parse(localStorage.getItem('rdmsUser') || 'null'); }
function setAuth(token, refreshToken, user) {
  localStorage.setItem('rdmsToken', token);
  localStorage.setItem('rdmsRefresh', refreshToken);
  localStorage.setItem('rdmsUser', JSON.stringify(user));
}
function clearAuth() {
  localStorage.removeItem('rdmsToken');
  localStorage.removeItem('rdmsRefresh');
  localStorage.removeItem('rdmsUser');
}

// ── Core request ──────────────────────────────────────────────────────────────
async function request(method, path, body = null, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = {
    method: method.toUpperCase(),
    headers,
    ...opts,
  };
  if (body && method.toUpperCase() !== 'GET') {
    config.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE}${path}`, config);

    if (res.status === 401) {
      clearAuth();
      window.location.href = 'index.html';
      return;
    }

    const data = await res.json();
    if (!res.ok) {
      throw { status: res.status, message: data.message || 'Request failed', data };
    }
    return data;
  } catch (err) {
    if (err.status) throw err;
    throw { status: 0, message: 'Network error. Check your connection.', data: null };
  }
}

// ── Convenience methods ───────────────────────────────────────────────────────
const api = {
  get:    (path, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request('GET', path + (qs ? `?${qs}` : ''));
  },
  post:   (path, body) => request('POST', path, body),
  put:    (path, body) => request('PUT',  path, body),
  patch:  (path, body) => request('PATCH',path, body),
  delete: (path)       => request('DELETE', path),
};

// ── Auth API ──────────────────────────────────────────────────────────────────
const authAPI = {
  login:         (data) => api.post('/auth/login', data),
  register:      (data) => api.post('/auth/register', data),
  logout:        ()     => api.post('/auth/logout'),
  getRoles:      ()     => api.get('/auth/roles'),
  forgotPassword:(data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe:         ()     => api.get('/auth/me'),
  changePassword:(data) => api.patch('/auth/change-password', data),
  getUsers:      ()     => api.get('/auth/all-users'),
  getPending:    ()     => api.get('/auth/pending'),
  approve:       (id)   => api.patch(`/auth/approve/${id}`),
  reject:        (id)   => api.patch(`/auth/reject/${id}`),
};

// ── Dashboard API ─────────────────────────────────────────────────────────────
const dashboardAPI = {
  getOverview: () => api.get('/dashboard'),
};

// ── Beneficiaries API ─────────────────────────────────────────────────────────
const beneficiaryAPI = {
  getAll:   (params) => api.get('/beneficiaries', params),
  getById:  (id)     => api.get(`/beneficiaries/${id}`),
  create:   (data)   => api.post('/beneficiaries', data),
  update:   (id, d)  => api.put(`/beneficiaries/${id}`, d),
  delete:   (id)     => api.delete(`/beneficiaries/${id}`),
};

// ── Donors API ────────────────────────────────────────────────────────────────
const donorAPI = {
  getAll:   (params) => api.get('/donors', params),
  getById:  (id)     => api.get(`/donors/${id}`),
  create:   (data)   => api.post('/donors', data),
  update:   (id, d)  => api.put(`/donors/${id}`, d),
  delete:   (id)     => api.delete(`/donors/${id}`),
};

// ── Donations API ─────────────────────────────────────────────────────────────
const donationAPI = {
  getAll:    (params)  => api.get('/donations', params),
  getStats:  ()        => api.get('/donations/stats'),
  create:    (data)    => api.post('/donations', data),
  update:    (id, d)   => api.put(`/donations/${id}`, d),
  delete:    (id)      => api.delete(`/donations/${id}`),
  allocate:  (id, d)   => api.post(`/donations/${id}/allocate`, d),
};

// ── Projects API ──────────────────────────────────────────────────────────────
const projectAPI = {
  getAll:        (params) => api.get('/projects', params),
  getById:       (id)     => api.get(`/projects/${id}`),
  getSummary:    ()       => api.get('/projects/summary'),
  getBudget:     ()       => api.get('/projects/budget-summary'),
  getLocations:  ()       => api.get('/projects/locations'),
  create:        (data)   => api.post('/projects', data),
  update:        (id, d)  => api.put(`/projects/${id}`, d),
  delete:        (id)     => api.delete(`/projects/${id}`),
};

// ── Volunteers API ────────────────────────────────────────────────────────────
const volunteerAPI = {
  getAll:        (params) => api.get('/volunteers', params),
  getById:       (id)     => api.get(`/volunteers/${id}`),
  getByProject:  (pid)    => api.get(`/volunteers/by-project/${pid}`),
  create:        (data)   => api.post('/volunteers', data),
  update:        (id, d)  => api.put(`/volunteers/${id}`, d),
  delete:        (id)     => api.delete(`/volunteers/${id}`),
  assign:        (id, d)  => api.post(`/volunteers/${id}/assign`, d),
};

// ── Inventory API ─────────────────────────────────────────────────────────────
const inventoryAPI = {
  getAll:       (params) => api.get('/inventory', params),
  getById:      (id)     => api.get(`/inventory/${id}`),
  getSummary:   ()       => api.get('/inventory/summary'),
  getLowStock:  (t)      => api.get('/inventory/low-stock', t ? { threshold: t } : {}),
  getCategories:()       => api.get('/inventory/categories'),
  getDropdown:  ()       => api.get('/inventory/dropdown'),
  getByProject: (pid)    => api.get(`/inventory/by-project/${pid}`),
  create:       (data)   => api.post('/inventory', data),
  update:       (id, d)  => api.put(`/inventory/${id}`, d),
  adjust:       (id, d)  => api.patch(`/inventory/${id}/adjust`, d),
  delete:       (id)     => api.delete(`/inventory/${id}`),
};

// ── Distributions API ─────────────────────────────────────────────────────────
const distributionAPI = {
  getAll:           (params) => api.get('/distributions', params),
  getById:          (id)     => api.get(`/distributions/${id}`),
  getSummary:       ()       => api.get('/distributions/summary'),
  getRecent:        (p)      => api.get('/distributions/recent', p),
  getByBeneficiary: (id)     => api.get(`/distributions/beneficiary/${id}`),
  getByProject:     (pid)    => api.get(`/distributions/by-project/${pid}`),
  create:           (data)   => api.post('/distributions', data),
  delete:           (id)     => api.delete(`/distributions/${id}`),
};

// ── Reports API ───────────────────────────────────────────────────────────────
const reportAPI = {
  financial:     ()       => api.get('/reports/financial'),
  donorImpact:   ()       => api.get('/reports/donor-impact'),
  beneficiaries: ()       => api.get('/reports/beneficiaries'),
  inventory:     ()       => api.get('/reports/inventory'),
  projects:      ()       => api.get('/reports/projects'),
  distributions: (params) => api.get('/reports/distributions', params),
};

// ── Guard: redirect to login if not authenticated ─────────────────────────────
function requireAuth() {
  if (!getToken()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// ── Role check ────────────────────────────────────────────────────────────────
function hasRole(...roles) {
  const user = getUser();
  return user && roles.includes(user.role);
}

// ── Exports (global scope for HTML pages) ─────────────────────────────────────
window.API = {
  auth:         authAPI,
  dashboard:    dashboardAPI,
  beneficiary:  beneficiaryAPI,
  donor:        donorAPI,
  donation:     donationAPI,
  project:      projectAPI,
  volunteer:    volunteerAPI,
  inventory:    inventoryAPI,
  distribution: distributionAPI,
  report:       reportAPI,
  getUser,
  setAuth,
  clearAuth,
  getToken,
  requireAuth,
  hasRole,
};
