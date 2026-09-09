const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function getToken() {
  return localStorage.getItem('piggery_token')
}

function qs(params) {
  if (!params) return ''
  const parts = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (parts.length === 0) return ''
  return '?' + parts.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } })

  if (res.status === 401) {
    localStorage.removeItem('piggery_token')
    localStorage.removeItem('piggery_user')
    if (!path.startsWith('/auth/')) window.location.href = '/login'
    throw new Error('Session expired. Please log in again.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    let detail = err.detail
    if (Array.isArray(detail)) detail = detail.map((d) => d.msg || '').filter(Boolean).join('; ')
    throw new Error(typeof detail === 'string' && detail ? detail : res.statusText)
  }

  if (res.status === 204) return null
  return res.json()
}

const post = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) })
const put = (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) })
const del = (path) => request(path, { method: 'DELETE' })

export const api = {
  // ── Auth ──
  login: (email, password) => post('/auth/login', { email, password }),
  register: (data) => post('/auth/register', data),
  googleLogin: (credential, mode = 'id_token') => post('/auth/google', { credential, mode }),
  facebookLogin: (accessToken, userId) => post('/auth/facebook', { access_token: accessToken, user_id: userId }),
  me: () => request('/auth/me'),
  updateProfile: (data) => put('/auth/me', data),
  changePassword: (data) => post('/auth/change-password', data),
  onboard: (data) => post('/auth/onboard', data),
  forgotPassword: (data) => post('/auth/forgot-password', data),
  resetPassword: (data) => post('/auth/reset-password', data),
  users: () => request('/users'),

  // ── Batches / Production ──
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

  // ── Expenses (general ledger) ──
  getExpenses: (params) => request(`/expenses${qs(params)}`),
  createExpense: (data) => post('/expenses', data),
  updateExpense: (id, data) => put(`/expenses/${id}`, data),
  deleteExpense: (id) => del(`/expenses/${id}`),

  // ── Sales ──
  getSales: (batchId) => request(`/sales${batchId ? `?batch_id=${batchId}` : ''}`),
  createSale: (data) => post('/sales', data),
  updateSale: (id, data) => put(`/sales/${id}`, data),
  deleteSale: (id) => del(`/sales/${id}`),

  // ── Mortalities ──
  getMortalities: (batchId) => request(`/mortalities${batchId ? `?batch_id=${batchId}` : ''}`),
  createMortality: (data) => post('/mortalities', data),
  deleteMortality: (id) => del(`/mortalities/${id}`),

  // ── Inventory (feeds / medicines / vitamins / supplies) ──
  getInventory: (params) => request(`/inventory${qs(params)}`),
  getInventoryAlerts: () => request('/inventory/alerts'),
  getInventoryItem: (id) => request(`/inventory/${id}`),
  createInventoryItem: (data) => post('/inventory', data),
  updateInventoryItem: (id, data) => put(`/inventory/${id}`, data),
  deleteInventoryItem: (id) => del(`/inventory/${id}`),
  restockItem: (id, data) => post(`/inventory/${id}/restock`, data),
  issueItem: (id, data) => post(`/inventory/${id}/issue`, data),
  getInventoryTransactions: (params) => request(`/inventory/transactions${qs(params)}`),
  cancelInventoryTransaction: (id) => del(`/inventory/transactions/${id}`),
  ensureFeedTypes: () => request('/inventory/feed-types'),
  createFeedPurchase: (batchId, data) => post(`/batches/${batchId}/feed-purchase`, data),

  // ── Vitamins / health schedule ──
  getVitamins: (params) => request(`/vitamins${qs(params)}`),
  createVitamin: (data) => post('/vitamins', data),
  updateVitamin: (id, data) => put(`/vitamins/${id}`, data),
  deleteVitamin: (id) => del(`/vitamins/${id}`),

  // ── Reminders ──
  getReminders: (params) => request(`/reminders${qs(params)}`),
  createReminder: (data) => post('/reminders', data),
  updateReminder: (id, data) => put(`/reminders/${id}`, data),
  completeReminder: (id) => post(`/reminders/${id}/done`),
  deleteReminder: (id) => del(`/reminders/${id}`),

  // ── Notifications (due doses + low-stock alerts) ──
  getNotifications: () => request('/notifications'),

  // ── Support / contact (recipient stays server-side) ──
  sendContact: (data) => post('/contact', data),

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