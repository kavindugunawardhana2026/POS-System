import api from './api'

export const getMetrics = () => api.get('/dashboard/metrics')
export const getSalesTrend = (days = 7) => api.get(`/dashboard/sales-trend?days=${days}`)
export const getLowStock = (limit = 10) => api.get(`/dashboard/low-stock?limit=${limit}`)
export const getRecentTransactions = (limit = 5) => api.get(`/dashboard/recent-transactions?limit=${limit}`)
