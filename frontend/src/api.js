const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function getToken() {
  return localStorage.getItem('piggery_token')
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })

  if (res.status === 401) {
    localStorage.removeItem('piggery_token')
    localStorage.removeItem('piggery_user')
    if (!path.startsWith('/auth/login')) window.location.href = '/login'
    throw new Error('Session expired. Please log in again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || res.statusText)
  }

  if (res.status === 204) return null
  return res.json()
}

const post = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) })
const put = (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) })
const del = (path) => request(path, { method: 'DELETE' })

export const api = {
  // ── Auth ──
  login: (username, password) => post('/auth/login', { username, password }),
  register: (data) => post('/auth/register', data),
  me: () => request('/auth/me'),
  users: () => request('/users'),

  // ── Batches ──
  getBatches: (status) => request(`/batches${status ? `?status=${status}` : ''}`),
  getBatch: (id) => request(`/batches/${id}`),
  createBatch: (data) => post('/batches', data),
  updateBatch: (id, data) => put(`/batches/${id}`, data),
  closeBatch: (id) => post(`/batches/${id}/close`),
  deleteBatch: (id) => del(`/batches/${id}`),
  getStatement: (id) => request(`/batches/${id}/statement`),

  // ── Cages ──
  createCage: (batchId, data) => post(`/cages?batch_id=${batchId}`, data),
  updateCage: (id, data) => put(`/cages/${id}`, data),
  deleteCage: (id) => del(`/cages/${id}`),

  // ── Expenses ──
  getExpenses: (batchId) => request(`/expenses${batchId ? `?batch_id=${batchId}` : ''}`),
  createExpense: (data) => post('/expenses', data),
  updateExpense: (id, data) => put(`/expenses/${id}`, data),
  deleteExpense: (id) => del(`/expenses/${id}`),

  // ── Sales (admin) ──
  getSales: (batchId) => request(`/sales${batchId ? `?batch_id=${batchId}` : ''}`),
  createSale: (data) => post('/sales', data),
  updateSale: (id, data) => put(`/sales/${id}`, data),
  deleteSale: (id) => del(`/sales/${id}`),

  // ── Feed logs ──
  getFeedLogs: (batchId) => request(`/feed-logs${batchId ? `?batch_id=${batchId}` : ''}`),
  createFeedLog: (data) => post('/feed-logs', data),
  deleteFeedLog: (id) => del(`/feed-logs/${id}`),

  // ── Mortalities ──
  getMortalities: (batchId) => request(`/mortalities${batchId ? `?batch_id=${batchId}` : ''}`),
  createMortality: (data) => post('/mortalities', data),
  deleteMortality: (id) => del(`/mortalities/${id}`),

  // ── Insights / Reports ──
  getDashboard: (batchIds) => {
    const query = batchIds && batchIds.length
      ? `?${batchIds.map((id) => `batch_ids=${id}`).join('&')}`
      : ''
    return request(`/dashboard${query}`)
  },
  getCageSummary: (batchIds) => {
    const query = batchIds && batchIds.length
      ? `?${batchIds.map((id) => `batch_ids=${id}`).join('&')}`
      : ''
    return request(`/reports/cage-summary${query}`)
  },
  getExpenseBreakdown: (batchId) => request(`/reports/expense-breakdown${batchId ? `?batch_id=${batchId}` : ''}`),
  getMonthlyReport: (batchId) => request(`/reports/monthly${batchId ? `?batch_id=${batchId}` : ''}`),
}