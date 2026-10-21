// Centralized API client. All requests go through here so the base URL, auth
// header, and error shape are handled in exactly one place.

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getToken() {
  return localStorage.getItem('smartresolve_token');
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection.');
  }

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = (payload && payload.error) || {};
    throw new ApiError(
      res.status,
      err.code || 'ERROR',
      err.message || `Request failed (${res.status}).`,
      err.details
    );
  }

  return payload ? payload.data : null;
}

export const api = {
  baseUrl: BASE_URL,

  register: (body) => request('/auth/register', { method: 'POST', body, auth: false }),
  login: (body) => request('/auth/login', { method: 'POST', body, auth: false }),
  me: () => request('/auth/me'),

  listIssues: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
    ).toString();
    return request(`/issues${qs ? `?${qs}` : ''}`);
  },
  getIssue: (id) => request(`/issues/${id}`),
  createIssue: (body) => request('/issues', { method: 'POST', body }),
  deleteIssue: (id) => request(`/issues/${id}`, { method: 'DELETE' }),
  addFollowUp: (id, note) => request(`/issues/${id}/follow-up`, { method: 'POST', body: { note } }),
  updateStatus: (id, status, note) =>
    request(`/issues/${id}/status`, { method: 'POST', body: { status, note } }),
  assignIssue: (id, assignedTo, note) =>
    request(`/issues/${id}/assign`, { method: 'POST', body: { assignedTo, note } }),
  updateDepartment: (id, department, note) =>
    request(`/issues/${id}/department`, { method: 'PATCH', body: { department, note } }),
  markDuplicate: (id, duplicateOf, note) =>
    request(`/issues/${id}/duplicate`, { method: 'POST', body: { duplicateOf, note } }),
  getDuplicates: (id) => request(`/issues/${id}/duplicates`),

  dashboard: () => request('/dashboard/summary'),
  reports: () => request('/reports/summary'),
  listUsers: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users${qs ? `?${qs}` : ''}`);
  },
  createStaff: (body) => request('/users/staff', { method: 'POST', body }),
  updateUser: (id, body) => request(`/users/${id}`, { method: 'PATCH', body }),
};
