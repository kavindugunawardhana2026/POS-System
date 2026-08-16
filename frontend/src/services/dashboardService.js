import api from './api'

export const getMetrics = () => api.get(`/dashboard/metrics?_t=${Date.now()}`)
export const getSalesTrend = (days = 7) => api.get(`/dashboard/sales-trend?days=${days}&_t=${Date.now()}`)
export const getLowStock = (limit = 10) => api.get(`/dashboard/low-stock?limit=${limit}&_t=${Date.now()}`)
export const getRecentTransactions = (limit = 5) => api.get(`/dashboard/recent-transactions?limit=${limit}&_t=${Date.now()}`)

